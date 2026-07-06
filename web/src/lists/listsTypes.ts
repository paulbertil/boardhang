// Pure foundation for Saved Lists — row interfaces (snake_case, matching migration
// 0003), camelCase domain types, and side-effect-free mappers. No Supabase, no
// IndexedDB: every other lists module imports from here and this file stays trivially
// unit-testable. Mirrors the row-interface + `fromRow` shape of logbook/ascents.ts.

/**
 * A `lists` row as the client reads it. Deliberately EXCLUDES `invite_token`: sharing
 * is out of scope this phase and the capability secret must never reach the client or
 * the offline cache (KTD-I10). The sync projection selects exactly these columns.
 */
export interface ListRow {
  id: string
  owner_id: string
  name: string
  board_layout_id: number
  created_at: string
  updated_at: string
  deleted: boolean
}

/**
 * Explicit column projections for every `lists` / `list_problems` read and reconcile —
 * NEVER `*`. This is the single source of the KTD-I10 invariant that `invite_token` (the
 * share-link capability secret) never leaves the server or lands in the offline cache.
 * Both the sync pull (listsSync) and the write reconciles (listsStore) select these.
 */
export const LIST_COLUMNS = 'id, owner_id, name, board_layout_id, created_at, updated_at, deleted'
export const LIST_PROBLEM_COLUMNS =
  'id, list_id, source_catalog_id, board_layout_id, added_by, created_at, updated_at, deleted'

/** A `list_problems` row — one catalog problem in a list's pile. */
export interface ListProblemRow {
  id: string
  list_id: string
  source_catalog_id: string
  board_layout_id: number
  added_by: string | null
  created_at: string
  updated_at: string
  deleted: boolean
}

/** A saved list (one board per list; membership handled elsewhere). */
export interface SavedList {
  id: string
  ownerId: string
  name: string
  boardLayoutId: number
  createdAt: string
  updatedAt: string
  deleted: boolean
}

/** A catalog problem saved into a list. */
export interface SavedListProblem {
  id: string
  listId: string
  sourceCatalogId: string
  boardLayoutId: number
  addedBy: string | null
  createdAt: string
  updatedAt: string
  deleted: boolean
}

export function fromListRow(r: ListRow): SavedList {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    boardLayoutId: r.board_layout_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deleted: r.deleted,
  }
}

export function fromListProblemRow(r: ListProblemRow): SavedListProblem {
  return {
    id: r.id,
    listId: r.list_id,
    sourceCatalogId: r.source_catalog_id,
    boardLayoutId: r.board_layout_id,
    addedBy: r.added_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deleted: r.deleted,
  }
}

/**
 * A compact board label for list rows and the add-to-list sheet header. `CatalogBoardDef`
 * has no `shortName`, so derive one by dropping the shared "MoonBoard" word (KTD-I5) —
 * e.g. "Mini MoonBoard 2025" → "Mini 2025", "MoonBoard Masters 2019" → "Masters 2019".
 * Unknown / empty names fall back to the trimmed original, then a generic "Board".
 */
export function boardShortLabel(name: string): string {
  const short = name.replace(/moonboard/gi, '').replace(/\s+/g, ' ').trim()
  return short || name.trim() || 'Board'
}

/** Max stored/displayed list-name length (soft UI cap; ids are the real key). */
export const MAX_LIST_NAME = 60

/** Normalize a raw list-name input: trim whitespace, cap length. Empty stays empty
 *  (the caller rejects a blank name). */
export function trimListName(raw: string): string {
  return raw.trim().slice(0, MAX_LIST_NAME)
}
