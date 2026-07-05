// Which hold set each grid position belongs to, ported from
// ios/MoonBoardLED/Board/HoldSetMembership.swift (+ ActiveHoldSets). Answers
// "can this problem be climbed with only these hold sets installed?" and which
// overlay layers to render. Membership JSON is bundled (derived by
// scripts/derive_holdset_membership.py) so browsing works offline.

import type { CatalogHold } from '../catalog/catalogSync'

export interface HoldSetInfo {
  id: number
  name: string
}

export interface MembershipData {
  sets: HoldSetInfo[]
  /** "col-row" (col 0-10, row 1 = bottom) -> hold-set id. */
  membership: Record<string, number>
}

const EMPTY: MembershipData = { sets: [], membership: {} }

// Bundle every board's membership map into the app (small, and guarantees the
// filter/render works offline). Keyed by resource base name (e.g.
// "MiniMoonBoard2025HoldSets"), matching CatalogBoardDef.membershipResource.
const files = import.meta.glob<MembershipData>('./membership/*.json', {
  eager: true,
  import: 'default',
})

const byResource: Record<string, MembershipData> = {}
for (const path in files) {
  const name = path.replace(/^.*\//, '').replace(/\.json$/, '')
  byResource[name] = files[path]
}

/** A board's membership data by resource name; empty (never-filters) if absent. */
export function membershipFor(resource: string): MembershipData {
  return byResource[resource] ?? EMPTY
}

/** Hold-set id owning a position, or undefined if none does. */
export function setIdAt(data: MembershipData, col: number, row: number): number | undefined {
  return data.membership[`${col}-${row}`]
}

/**
 * True if every hold is owned by one of `activeSetIds`. An empty membership map
 * (board not bundled) never filters — every problem is climbable.
 */
export function isClimbable(
  data: MembershipData,
  holds: CatalogHold[],
  activeSetIds: Set<number>,
): boolean {
  if (Object.keys(data.membership).length === 0) return true
  return holds.every((hold) => {
    const id = setIdAt(data, hold.c, hold.r)
    return id !== undefined && activeSetIds.has(id)
  })
}

/** Set ids that own >=1 grid hold — these participate in filtering and the editor. */
export function filterableSetIds(data: MembershipData): number[] {
  const owning = new Set(Object.values(data.membership))
  return data.sets.map((s) => s.id).filter((id) => owning.has(id))
}

/** Set ids that own no grid holds (e.g. Screw-on Feet) — always-on render art. */
export function alwaysOnSetIds(data: MembershipData): number[] {
  const owning = new Set(Object.values(data.membership))
  return data.sets.map((s) => s.id).filter((id) => !owning.has(id))
}

// ─── Installed hold-set selection (ActiveHoldSets port) ───────────────────────
// The persisted string (boardStore's activeHoldSets_<id>) is interpreted here,
// against the board's filterable sets. "" (or all-active) means the board is
// full — no filtering.

/** Parse the stored string into active filterable set ids; empty -> all active. */
export function activeSetIds(csv: string, data: MembershipData): Set<number> {
  const filterable = new Set(filterableSetIds(data))
  const stored = new Set(
    csv
      .split('|')
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && filterable.has(n)),
  )
  return stored.size === 0 ? filterable : stored
}

/** Canonical storage string. All filterable sets active -> "" (filter off). */
export function activeCsv(ids: Set<number>, data: MembershipData): string {
  if (ids.size >= filterableSetIds(data).length) return ''
  return [...ids].sort((a, b) => a - b).join('|')
}

/** Whether every filterable set is active (board is full). */
export function isAllActive(ids: Set<number>, data: MembershipData): boolean {
  return ids.size >= filterableSetIds(data).length
}

/** Hold-set ids to RENDER: active filterable sets plus always-on feet, so feet
 *  art never disappears when filtering. */
export function visibleSetIds(activeIds: Set<number>, data: MembershipData): Set<number> {
  return new Set([...activeIds, ...alwaysOnSetIds(data)])
}
