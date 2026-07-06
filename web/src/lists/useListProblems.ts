// Per-list reactive read of a list's saved problems, keyed by listId (KTD-I2). Mirrors
// catalog/useSlab.ts: paint from the IndexedDB cache immediately, then a best-effort
// refresh (which pulls list_problems deltas), flagging `degraded` when the pull couldn't
// reach the server. Re-reads whenever a store mutation nudges the problem cache, so an
// optimistic add/remove reflects here without a full store subscription.

import { useEffect, useState } from 'react'
import { refreshLists, subscribeListProblemsChanged } from './listsStore'
import { readListProblems } from './listsSync'
import type { SavedListProblem } from './listsTypes'

export interface ListProblemsState {
  problems: SavedListProblem[]
  /** True until the first refresh for this list resolves. */
  loading: boolean
  /** True when served from cache because the refresh couldn't reach the server. */
  degraded: boolean
}

const INITIAL: ListProblemsState = { problems: [], loading: true, degraded: false }

export function useListProblems(listId: string): ListProblemsState {
  const [state, setState] = useState<ListProblemsState>(INITIAL)

  useEffect(() => {
    let cancelled = false
    setState({ problems: [], loading: true, degraded: false })

    const reread = () => {
      readListProblems(listId)
        .then((problems) => {
          if (!cancelled) setState((s) => ({ ...s, problems }))
        })
        .catch(() => {
          /* cache read failures are non-fatal */
        })
    }

    async function load() {
      // Fast path: whatever is cached, before the network round-trip.
      try {
        const cached = await readListProblems(listId)
        if (!cancelled) setState({ problems: cached, loading: true, degraded: false })
      } catch {
        /* non-fatal */
      }
      // Best-effort refresh: pull list_problems deltas, then re-read from the cache.
      const { synced } = await refreshLists()
      try {
        const fresh = await readListProblems(listId)
        if (!cancelled) setState({ problems: fresh, loading: false, degraded: !synced })
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false, degraded: true }))
      }
    }

    void load()
    const unsub = subscribeListProblemsChanged(reread)
    return () => {
      cancelled = true
      unsub()
    }
  }, [listId])

  return state
}
