// Pure derivations over a user's sends for the profile page (R19): the grade histogram
// and the most-recent climbing "session" (a local calendar day's cluster). No storage /
// no React here so it stays unit-testable. Fed by the get_user_sends projection, which
// carries grade + climbed-at but no attempt counts — so the histogram is a simple per-grade
// count, not the try-bucket pyramid the owner sees on their own logbook.

import { gradeIndex } from '../board/grades'
import type { SendItem } from './socialTypes'

export interface GradeBar {
  grade: string
  count: number
}

/**
 * Count sends per grade, ordered hardest-first (the chart reads top = hardest). Unknown /
 * unmapped grades sort to the bottom via gradeIndex. Reflects whatever sends are loaded —
 * it grows as the caller pages in more, so it is a breakdown of loaded sends, not a
 * guaranteed lifetime total.
 */
export function gradeHistogram(sends: SendItem[]): GradeBar[] {
  const counts = new Map<string, number>()
  for (const s of sends) counts.set(s.problemGrade, (counts.get(s.problemGrade) ?? 0) + 1)
  return [...counts.entries()]
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => gradeIndex(b.grade) - gradeIndex(a.grade))
}

export interface SessionCluster {
  /** A representative Date in that day (for formatting). */
  date: Date
  /** The sends climbed that day, newest first. */
  sends: SendItem[]
}

/** Local calendar-day key for a Date (mirrors logbook `sessions.ts` / iOS startOfDay). */
function localDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * The most recent climbing session = the sends from the latest local calendar day, grouped by
 * `climbedAt` (when the climb happened), newest first. Null when there are no sends. Derived
 * from loaded sends; since sends arrive newest-first the latest day is fully present unless a
 * single day exceeds one page (not a real case here).
 */
export function latestSession(sends: SendItem[]): SessionCluster | null {
  if (sends.length === 0) return null
  const byRecent = [...sends].sort((a, b) => b.climbedAt.localeCompare(a.climbedAt))
  const dayKey = localDayKey(new Date(byRecent[0].climbedAt))
  const group = byRecent.filter((s) => localDayKey(new Date(s.climbedAt)) === dayKey)
  return { date: new Date(group[0].climbedAt), sends: group }
}
