// A user's sends on their profile (R19) — the same projection as the feed, filtered to one
// actor via get_user_sends (single-actor wrapper over the revoked _sends_for_actors core). The
// server applies the R6/R12 gate: a blocked pair or an effectively-private non-follower gets an
// empty set, which renders here as the gated empty state (indistinguishable from "no sends yet",
// by design — a private account must not leak whether it has activity).
//
// Keyset-paged on (first_sent_at, id): "Load more" passes the last row's cursor. Read-only.

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase/client'
import { boardByLayoutId } from '../board/boards'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { sendFromRow, type SendItem, type SendRow } from './socialTypes'

const PAGE = 30

/** Compact relative time ("3d", "5h", "just now") for a climb date. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const s = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.round(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.round(mo / 12)}y ago`
}

type LoadState = 'loading' | 'loaded' | 'error'

export function UserSendsList({ userId }: { userId: string }) {
  const [sends, setSends] = useState<SendItem[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [done, setDone] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // Guards against a stale response overwriting a newer userId's list.
  const reqId = useRef(0)

  const fetchPage = useCallback(
    async (cursor: SendItem | null): Promise<SendItem[] | null> => {
      if (!supabase) return []
      const { data, error } = await supabase.rpc('get_user_sends', {
        p_target: userId,
        p_limit: PAGE,
        p_before_first_sent: cursor?.firstSentAt ?? null,
        p_before_id: cursor?.ascentId ?? null,
      })
      if (error) return null
      return ((data ?? []) as SendRow[]).map(sendFromRow)
    },
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
      setDone(rows.length < PAGE)
    })
  }, [fetchPage])

  async function loadMore() {
    const cursor = sends[sends.length - 1]
    if (!cursor) return
    const id = reqId.current
    setLoadingMore(true)
    const rows = await fetchPage(cursor)
    setLoadingMore(false)
    if (id !== reqId.current || rows === null) return
    setSends((prev) => [...prev, ...rows])
    setDone(rows.length < PAGE)
  }

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
    <div className="flex flex-col">
      <p className="px-1 pb-2 text-sm font-medium text-muted-foreground">
        {sends.length}
        {done ? '' : '+'} send{sends.length === 1 ? '' : 's'}
      </p>
      <ul className="flex flex-col divide-y divide-border">
        {sends.map((s) => {
          const board = boardByLayoutId(s.boardLayoutId)
          return (
            <li key={s.ascentId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{s.problemName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {s.problemGrade}
                  {board ? ` · ${board.name}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(s.climbedAt)}</span>
            </li>
          )
        })}
      </ul>
      {!done && (
        <Button variant="ghost" className="mt-2 self-center" disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  )
}
