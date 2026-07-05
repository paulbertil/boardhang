// Per-slab "recently viewed" history: catalog problem ids in most-recent-first
// order, deduped and capped, persisted to localStorage. Mirrors iOS's per
// board+angle recents (move-to-front on view). Interpreted against the slab's
// problems by the UI (an id with no current problem is simply skipped).

const RECENT_CAP = 5
const key = (layoutId: number, angle: number) => `catalogRecents_${layoutId}_${angle}`

function read(k: string): string[] {
  try {
    const raw = localStorage.getItem(k)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function write(k: string, ids: string[]): void {
  try {
    localStorage.setItem(k, JSON.stringify(ids))
  } catch {
    // Best-effort; recents simply won't persist.
  }
}

/** Recently-viewed catalog ids for a slab, most-recent first (capped). */
export function getRecentIds(layoutId: number, angle: number): string[] {
  return read(key(layoutId, angle))
}

/** Record a viewed problem: move it to the front, dedupe, cap the list. */
export function recordRecent(layoutId: number, angle: number, id: string): void {
  const k = key(layoutId, angle)
  const next = [id, ...read(k).filter((existing) => existing !== id)].slice(0, RECENT_CAP)
  write(k, next)
}

/** Clear a slab's recently-viewed history. */
export function clearRecents(layoutId: number, angle: number): void {
  write(key(layoutId, angle), [])
}
