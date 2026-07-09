// The "last opened problem" for the catalog last-opened bar, per board+angle.
// Deliberately IN-MEMORY only (no localStorage): the bar is session-only, so a cold
// load must start empty even though recentsStore has persisted history. Scoping the
// entry by layoutId+angle means switching board or angle naturally clears the bar
// (a different key has no entry). Mirrors the recentsStore reactive pattern
// (listeners + emit + cache-per-key snapshot) minus persistence and the cross-tab
// storage listener.

import { useSyncExternalStore } from 'react'

const key = (layoutId: number, angle: number) => `${layoutId}_${angle}`

// The single source of truth: most-recently-opened id per slab key. In-memory only.
const opened = new Map<string, string>()

const listeners = new Set<() => void>()
// Cache the snapshot per key so useSyncExternalStore gets a stable value between
// writes (React bails out of re-render when the reference is unchanged). Cleared on
// every emit so the next read reflects the mutated map.
const cache = new Map<string, string | null>()

function emit(): void {
  cache.clear()
  for (const l of listeners) l()
}

function snapshotFor(k: string): string | null {
  if (!cache.has(k)) cache.set(k, opened.get(k) ?? null)
  return cache.get(k) ?? null
}

/** The last-opened problem id for a slab this session, or null. */
export function getLastOpened(layoutId: number, angle: number): string | null {
  return snapshotFor(key(layoutId, angle))
}

/** Record that a problem was opened (drawer) — seeds/updates the bar for this slab. */
export function recordOpened(layoutId: number, angle: number, id: string): void {
  opened.set(key(layoutId, angle), id)
  emit()
}

/** Dismiss the bar for a slab (× tap). The next open re-records and re-shows it. */
export function dismissLastOpened(layoutId: number, angle: number): void {
  opened.delete(key(layoutId, angle))
  emit()
}

/** Clear every slab's last-opened entry. Test support: the store is an in-memory
 *  session singleton with no localStorage to clear between tests. */
export function resetLastOpened(): void {
  opened.clear()
  emit()
}

/** Reactive last-opened id for a slab. */
export function useLastOpened(layoutId: number, angle: number): string | null {
  const k = key(layoutId, angle)
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => snapshotFor(k),
  )
}
