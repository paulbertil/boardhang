import { describe, expect, it } from 'vitest'
import { describeActiveFilters, type ChipContext } from './activeFilterChips'
import { DEFAULT_FILTERS, type FilterState } from './filters'

const READY: ChipContext = { inSession: false, statusReady: true, listsById: new Map() }

function state(over: Partial<FilterState>): FilterState {
  return { ...DEFAULT_FILTERS, ...over }
}

const listsById = (entries: [string, string][]): ReadonlyMap<string, { name: string }> =>
  new Map(entries.map(([id, name]) => [id, { name }]))

describe('describeActiveFilters', () => {
  it('returns no chips for the default state', () => {
    expect(describeActiveFilters(DEFAULT_FILTERS, READY)).toEqual([])
  })

  it('emits chips in fixed category order with expected labels', () => {
    const s = state({
      gradeRange: [3, 8],
      minStars: 2,
      methods: ['Footless', 'No kickboard'],
      statusFilters: ['unlogged', 'sent'],
      holdsFilter: ['3-5', '4-6', '5-7'],
    })
    const chips = describeActiveFilters(s, READY)
    // Grade → Min-stars → Methods (option order) → Status (key order) → Holds.
    // (Benchmark and Favorites are pinned toggles, not chips — see below.)
    expect(chips.map((c) => c.id)).toEqual([
      'grade',
      'stars',
      'method:No kickboard',
      'method:Footless',
      'status:sent',
      'status:unlogged',
      'holds',
    ])
    const byId = Object.fromEntries(chips.map((c) => [c.id, c.label]))
    expect(byId['stars']).toBe('≥2★')
    expect(byId['status:sent']).toBe('Sent')
    expect(byId['status:unlogged']).toBe('Not logged')
    expect(byId['holds']).toBe('Holds (3)')
    // Grade label uses the font-grade names, not raw ordinals.
    expect(byId['grade']).toMatch(/–/)
  })

  it('never emits a Favorites chip (it is a pinned toggle, not a removable pill)', () => {
    const chips = describeActiveFilters(state({ favoritesOnly: true }), READY)
    expect(chips).toEqual([])
  })

  it('omits the grade chip for a full-span (null) range', () => {
    expect(describeActiveFilters(state({ gradeRange: null }), READY)).toEqual([])
  })

  it('suppresses status chips in a session, keeping the rest', () => {
    const s = state({ minStars: 2, statusFilters: ['sent'] })
    const chips = describeActiveFilters(s, { inSession: true, statusReady: true, listsById: new Map() })
    expect(chips.map((c) => c.id)).toEqual(['stars'])
  })

  it('suppresses status chips when not statusReady (e.g. signed-out deep link)', () => {
    const s = state({ minStars: 2, statusFilters: ['sent'] })
    const chips = describeActiveFilters(s, { inSession: false, statusReady: false, listsById: new Map() })
    expect(chips.map((c) => c.id)).toEqual(['stars'])
  })

  it('emits one chip per selected list, labelled with the list name, right after grade', () => {
    const s = state({ gradeRange: [3, 8], listFilter: ['a', 'b'], minStars: 2 })
    const ctx: ChipContext = { ...READY, listsById: listsById([['a', 'Projects'], ['b', 'Warm-ups']]) }
    const chips = describeActiveFilters(s, ctx)
    expect(chips.map((c) => c.id)).toEqual(['grade', 'list:a', 'list:b', 'stars'])
    const byId = Object.fromEntries(chips.map((c) => [c.id, c.label]))
    expect(byId['list:a']).toBe('Projects')
    expect(byId['list:b']).toBe('Warm-ups')
    // Each patch removes only its own id.
    const patches = Object.fromEntries(chips.map((c) => [c.id, c.patch]))
    expect(patches['list:a']).toEqual({ listFilter: ['b'] })
    expect(patches['list:b']).toEqual({ listFilter: ['a'] })
  })

  it('drops a selected list id with no matching live list (stale/foreign, not yet pruned)', () => {
    const s = state({ listFilter: ['a', 'gone'] })
    const ctx: ChipContext = { ...READY, listsById: listsById([['a', 'Projects']]) }
    const chips = describeActiveFilters(s, ctx)
    expect(chips.map((c) => c.id)).toEqual(['list:a'])
  })

  it('disambiguates two selected lists that share a name', () => {
    const s = state({ listFilter: ['a', 'b'] })
    const ctx: ChipContext = { ...READY, listsById: listsById([['a', 'Projects'], ['b', 'Projects']]) }
    const labels = describeActiveFilters(s, ctx).map((c) => c.label)
    expect(labels).toEqual(['Projects (1)', 'Projects (2)'])
    expect(new Set(labels).size).toBe(2) // distinguishable
  })

  it("each chip's patch clears exactly its own filter", () => {
    const s = state({
      gradeRange: [3, 8],
      minStars: 2,
      methods: ['Footless', 'No kickboard'],
      statusFilters: ['sent', 'unlogged'],
      holdsFilter: ['3-5'],
    })
    const byId = Object.fromEntries(describeActiveFilters(s, READY).map((c) => [c.id, c.patch]))
    expect(byId['grade']).toEqual({ gradeRange: null })
    expect(byId['stars']).toEqual({ minStars: 0 })
    expect(byId['holds']).toEqual({ holdsFilter: [] })
    // Removing one method leaves the other selected.
    expect(byId['method:Footless']).toEqual({ methods: ['No kickboard'] })
    // Removing one status leaves the other selected.
    expect(byId['status:sent']).toEqual({ statusFilters: ['unlogged'] })
  })
})
