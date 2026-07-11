// On-demand beta-videos store, one entry per problem. Fetches a problem's APPROVED beta
// clips (RLS enforces approved+not-deleted; we also filter explicitly) ordered best-viewed
// first, and caches them in a per-session in-memory map so re-opening a problem is instant.
// Modeled on sessions/memberAscentsStore but simpler: public data, no max-age/revocation —
// there is nothing user-scoped to bound. No IndexedDB/offline persistence in v1.

import { useEffect } from 'react'
import { useSyncExternalStore } from 'react'
import { supabase } from '../supabase/client'
import type { BetaVideo } from './betaTypes'

export type BetaStatus = 'loading' | 'ready' | 'error'

export interface BetaEntry {
  status: BetaStatus
  videos: BetaVideo[]
  error: string | null
}

const COLS = 'id,source_catalog_id,provider,video_id,title,channel,duration_s,is_short,views'
const LOADING: BetaEntry = { status: 'loading', videos: [], error: null }

const cache = new Map<string, BetaEntry>()
const listeners = new Set<() => void>()
const inflight = new Set<string>()

function notify(): void {
  for (const l of listeners) l()
}

function set(id: string, entry: BetaEntry): void {
  cache.set(id, entry)
  notify()
}

async function fetchBeta(id: string): Promise<void> {
  if (inflight.has(id)) return
  inflight.add(id)
  if (!cache.has(id)) set(id, LOADING)
  try {
    if (!supabase) {
      // Unconfigured build: no backend, so no betas — a clean empty state, not an error.
      set(id, { status: 'ready', videos: [], error: null })
      return
    }
    const { data, error } = await supabase
      .from('problem_beta_videos')
      .select(COLS)
      .eq('source_catalog_id', id)
      .eq('status', 'approved')
      .eq('deleted', false)
      .order('views', { ascending: false })
    if (error) {
      set(id, { status: 'error', videos: [], error: error.message })
      return
    }
    set(id, { status: 'ready', videos: (data ?? []) as BetaVideo[], error: null })
  } catch (e) {
    set(id, { status: 'error', videos: [], error: e instanceof Error ? e.message : 'load failed' })
  } finally {
    inflight.delete(id)
  }
}

/** Drop the cached entry and re-fetch (the error-state "Try again" action). */
export function refetchBeta(id: string): void {
  cache.delete(id)
  void fetchBeta(id)
}

/** Test hook: clear the module-level singleton between cases. */
export function _resetBetaCache(): void {
  cache.clear()
  inflight.clear()
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

function snapshotFor(id: string): BetaEntry {
  return cache.get(id) ?? LOADING
}

/** Reactive per-problem beta entry; fetches lazily on first use of an id. */
export function useBetaVideos(sourceCatalogId: string): BetaEntry {
  useEffect(() => {
    if (!cache.has(sourceCatalogId)) void fetchBeta(sourceCatalogId)
  }, [sourceCatalogId])
  return useSyncExternalStore(subscribe, () => snapshotFor(sourceCatalogId))
}
