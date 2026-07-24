// The catalog's pinnable filter facets — the single source of truth shared by the filter
// sheet (per-row pin icons) and the header nav (the unified pinned-control / chip render).
//
// A facet is either a `toggle` (a boolean flipped inline in the nav — Benchmarks, Favorites)
// or `rich` (opens a popover / picker in the nav — Grade, Holds, Sort, min-stars, Status,
// Methods). Lists is a rich opener but is only offered when the board actually has lists.
//
// CANONICAL_ORDER is the fixed left-to-right order pinned controls render in, so a pinned
// filter always sits in the same spot (muscle memory). It is intentionally NOT selection
// order.

import { FONT_GRADES } from '../board/grades'
import {
  BENCHMARK_LABEL,
  FAVORITES_LABEL,
  SORT_LABELS,
  STATUS_LABELS,
  type FilterState,
  type StatusKey,
} from './filters'

export type PinnableFacetId =
  | 'sort'
  | 'grade'
  | 'holds'
  | 'benchmarks'
  | 'favorites'
  | 'stars'
  | 'status'
  | 'methods'
  | 'lists'

export type FacetKind = 'toggle' | 'rich'

export interface PinnableFacet {
  id: PinnableFacetId
  /** Shown in the sheet row and (for rich facets, when inactive) as the nav control label. */
  label: string
  kind: FacetKind
}

/** Fixed nav order for pinned controls; also the order pin rows read in the sheet. */
export const CANONICAL_ORDER: readonly PinnableFacet[] = [
  { id: 'sort', label: 'Sort', kind: 'rich' },
  { id: 'grade', label: 'Grade', kind: 'rich' },
  { id: 'holds', label: 'Holds', kind: 'rich' },
  { id: 'benchmarks', label: BENCHMARK_LABEL, kind: 'toggle' },
  { id: 'favorites', label: FAVORITES_LABEL, kind: 'toggle' },
  { id: 'stars', label: 'Min rating', kind: 'rich' },
  { id: 'status', label: 'Ascent status', kind: 'rich' },
  { id: 'methods', label: 'Method', kind: 'rich' },
  { id: 'lists', label: 'Lists', kind: 'rich' },
]

export const FACET_BY_ID: Record<PinnableFacetId, PinnableFacet> = Object.fromEntries(
  CANONICAL_ORDER.map((f) => [f.id, f]),
) as Record<PinnableFacetId, PinnableFacet>

/** Gating context — mirrors describeActiveFilters/activeFilterCount so a facet reads "active"
 *  only when it is actually narrowing the list. */
export interface FacetContext {
  /** A collab session targets this board — status is per-member, so single-user status is off. */
  inSession: boolean
  /** Signed in AND ascents loaded — gates the status dimension. */
  statusReady: boolean
}

/**
 * Whether a facet is currently narrowing the list. Sort is never "active" (it always has a
 * value but never filters); toggles/opener reflect their boolean/selection.
 */
export function isFacetActive(id: PinnableFacetId, s: FilterState, ctx: FacetContext): boolean {
  switch (id) {
    case 'sort':
      return false
    case 'grade':
      return s.gradeRange !== null
    case 'holds':
      return s.holdsFilter.length > 0
    case 'benchmarks':
      return s.benchmarkOnly
    case 'favorites':
      return s.favoritesOnly
    case 'stars':
      return s.minStars > 0
    case 'status':
      return ctx.statusReady && !ctx.inSession && s.statusFilters.length > 0
    case 'methods':
      return s.methods.length > 0
    case 'lists':
      return s.listFilter.length > 0
  }
}

/** The value shown on a rich facet's nav control when active (collapsed for multi-selects). */
export function facetActiveLabel(id: PinnableFacetId, s: FilterState): string {
  switch (id) {
    case 'grade': {
      if (!s.gradeRange) return FACET_BY_ID.grade.label
      const [lo, hi] = s.gradeRange
      return `${FONT_GRADES[lo]}–${FONT_GRADES[hi]}`
    }
    case 'holds':
      return `Holds (${s.holdsFilter.length})`
    case 'stars':
      return `≥${s.minStars}★`
    case 'methods':
      return s.methods.length === 1 ? s.methods[0] : `Methods (${s.methods.length})`
    case 'status': {
      const keys = s.statusFilters
      return keys.length === 1 ? STATUS_LABELS[keys[0] as StatusKey] : `Status (${keys.length})`
    }
    case 'sort':
      return SORT_LABELS[s.sortPrimary]
    default:
      return FACET_BY_ID[id].label
  }
}

/** The patch that clears a facet (used by rich facets' popover "Clear"). Sort has no cleared
 *  state, so it maps to no-op-ish empty patch and is never offered a Clear. */
export function facetClearPatch(id: PinnableFacetId): Partial<FilterState> {
  switch (id) {
    case 'grade':
      return { gradeRange: null }
    case 'holds':
      return { holdsFilter: [] }
    case 'stars':
      return { minStars: 0 }
    case 'status':
      return { statusFilters: [] }
    case 'methods':
      return { methods: [] }
    case 'lists':
      return { listFilter: [] }
    case 'benchmarks':
      return { benchmarkOnly: false }
    case 'favorites':
      return { favoritesOnly: false }
    case 'sort':
      return {}
  }
}

/** Map a removable chip's id (from describeActiveFilters) back to its facet, so the nav can
 *  suppress a chip whose facet is pinned (it renders as a pinned control instead). */
export function chipFacetId(chipId: string): PinnableFacetId {
  const head = chipId.split(':')[0]
  if (head === 'method') return 'methods'
  if (head === 'status') return 'status'
  return head as PinnableFacetId
}
