// A user's sends on their profile (R19) — the projection is get_user_sends (single-actor
// wrapper over the revoked _sends_for_actors core). The server applies the R6/R12 gate: a
// blocked pair or an effectively-private non-follower gets an empty set, which renders here as
// the gated empty state (indistinguishable from "no sends yet", by design — a private account
// must not leak whether it has activity).
//
// One fetch feeds three sections: the grade pyramid, the latest climbing session, and the full
// keyset-paged list. All derive from the accumulated sends, so "Load more" grows the pyramid
// too. Rows are the shared logbook `AscentRow` (read-only — no edit pencil), enriched from the
// viewer's own synced catalog (setter/benchmark) when the problem resolves, exactly like the
// logbook.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getCatalogProblemsByIds, type CatalogProblem } from '../catalog/catalogSync'
import { AscentRow } from '../logbook/AscentRow'
import type { Ascent } from '../logbook/ascents'
import { GradePyramid } from '../logbook/GradePyramid'
import type { PyramidInput } from '../logbook/sessions'
import { fetchSendsPage, SENDS_PAGE } from './sendsPage'
import { latestSession } from './profileStats'
import type { SendItem } from './socialTypes'

/** Map profile sends to the pyramid's minimal shape — projection sends are all `sent`. */
function toPyramidInput(sends: SendItem[]): PyramidInput[] {
  return sends.map((s) => ({
    sent: true,
    sourceCatalogId: s.sourceCatalogId,
    problemName: s.problemName,
    problemGrade: s.problemGrade,
    date: s.climbedAt,
    tries: s.tries,
  }))
}

/** A send → the Ascent shape AscentRow renders. The projection omits vote/stars/comment, so
 *  those default to "no vote arrow, no stars, no comment"; every projected row is a send. */
function toAscent(s: SendItem): Ascent {
  return {
    id: s.ascentId,
    date: s.climbedAt,
    sourceCatalogId: s.sourceCatalogId,
    userProblemId: s.userProblemId,
    problemName: s.problemName,
    problemGrade: s.problemGrade,
    votedGrade: s.problemGrade,
    tries: s.tries,
    stars: 0,
    comment: '',
    sent: true,
    boardLayoutId: s.boardLayoutId,
  }
}

type LoadState = 'loading' | 'loaded' | 'error'

const sessionDate = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

export function ProfileSends({ userId }: { userId: string }) {
  const [sends, setSends] = useState<SendItem[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [done, setDone] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [catalogById, setCatalogById] = useState<Map<string, CatalogProblem>>(new Map())
  // Guards against a stale response overwriting a newer userId's list.
  const reqId = useRef(0)

  const fetchPage = useCallback(
    (cursor: SendItem | null) => fetchSendsPage('get_user_sends', cursor, { p_target: userId }),
    [userId],
  )

  useEffect(() => {
    const id = ++reqId.current
    setSends([])
    setStatus('loading')
    setDone(false)
    void fetchPage(null).then((rows) => {
      if (id !== reqId.current) return
      if (rows === null) {
        setStatus('error')
        return
      }
      setSends(rows)
      setStatus('loaded')
      setDone(rows.length < SENDS_PAGE)
    })
  }, [fetchPage])

  // Enrich rows from the viewer's own cached catalog (setter/benchmark), same as the logbook —
  // resolves for boards the viewer has synced; the rest fall back gracefully.
  useEffect(() => {
    const ids = sends.map((s) => s.sourceCatalogId).filter((v): v is string => v !== null)
    if (ids.length === 0) return
    let live = true
    void getCatalogProblemsByIds(ids).then((map) => {
      if (live) setCatalogById(map)
    })
    return () => {
      live = false
    }
  }, [sends])

  async function loadMore() {
    const cursor = sends[sends.length - 1]
    if (!cursor) return
    const id = reqId.current
    setLoadingMore(true)
    const rows = await fetchPage(cursor)
    setLoadingMore(false)
    if (id !== reqId.current || rows === null) return
    setSends((prev) => [...prev, ...rows])
    setDone(rows.length < SENDS_PAGE)
  }

  const session = useMemo(() => latestSession(sends), [sends])
  const pyramidInput = useMemo(() => toPyramidInput(sends), [sends])

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  if (status === 'error') {
    return <p className="py-8 text-center text-sm text-muted-foreground">Couldn't load sends.</p>
  }

  if (sends.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No sends to show.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="px-1 pb-2 text-sm font-semibold text-foreground">Grades</h2>
        <GradePyramid items={pyramidInput} />
      </section>

      {session && (
        <section>
          <div className="flex items-baseline justify-between px-1 pb-2">
            <h2 className="text-sm font-semibold text-foreground">Latest session</h2>
            <span className="text-xs text-muted-foreground">
              {sessionDate.format(session.date)} · {session.sends.length} climb
              {session.sends.length === 1 ? '' : 's'}
            </span>
          </div>
          <SendRows sends={session.sends} catalogById={catalogById} />
        </section>
      )}

      <section className="flex flex-col">
        <SendRows sends={sends} catalogById={catalogById} />
        {!done && (
          <Button variant="ghost" className="mt-2 self-center" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        )}
      </section>
    </div>
  )
}

/** Read-only list of sends as shared AscentRows (no edit pencil, not tappable in v1). */
function SendRows({
  sends,
  catalogById,
}: {
  sends: SendItem[]
  catalogById: Map<string, CatalogProblem>
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border">
      {sends.map((s) => (
        <AscentRow
          key={s.ascentId}
          ascent={toAscent(s)}
          catalog={s.sourceCatalogId ? catalogById.get(s.sourceCatalogId) : undefined}
        />
      ))}
    </div>
  )
}
