import { describe, expect, it } from 'vitest'
import type { CatalogHold } from '../catalog/catalogSync'
import {
  activeCsv,
  activeSetIds,
  alwaysOnSetIds,
  filterableSetIds,
  isAllActive,
  isClimbable,
  membershipFor,
  setIdAt,
  visibleSetIds,
} from './holdSetMembership'

const mini = membershipFor('MiniMoonBoard2025HoldSets') // all sets filterable
const masters = membershipFor('MoonBoardMasters2019HoldSets') // set 20 = Screw-on Feet (always-on)

const hold = (c: number, r: number): CatalogHold => ({ c, r, t: 'start' })

describe('filterable vs always-on derivation', () => {
  it('marks sets owning no grid holds as always-on (Masters 2019 feet = 20)', () => {
    expect(filterableSetIds(masters)).toEqual([17, 18, 19, 21, 22, 23])
    expect(alwaysOnSetIds(masters)).toEqual([20])
  })

  it('marks every set filterable when all own grid holds (Mini 2025)', () => {
    expect(filterableSetIds(mini)).toEqual([28, 29, 30, 31])
    expect(alwaysOnSetIds(mini)).toEqual([])
  })
})

describe('isClimbable', () => {
  it('hides a problem whose hold is on an uninstalled set (AE1)', () => {
    const pos = hold(0, 1)
    const owningSet = setIdAt(mini, 0, 1)!
    const problem = [pos, hold(5, 6)]

    const withoutOwning = new Set([28, 29, 30, 31].filter((id) => id !== owningSet))
    expect(isClimbable(mini, problem, withoutOwning)).toBe(false)

    const allInstalled = new Set([28, 29, 30, 31])
    expect(isClimbable(mini, problem, allInstalled)).toBe(true)
  })

  it('treats a hold with no owning set as not climbable', () => {
    // Distinct from the empty-map case: a populated board where the hold sits on
    // a position no set owns (setIdAt undefined) must fail the guard.
    expect(setIdAt(mini, 99, 99)).toBeUndefined()
    expect(isClimbable(mini, [hold(99, 99)], new Set([28, 29, 30, 31]))).toBe(false)
  })

  it('never filters when the membership map is empty', () => {
    const empty = membershipFor('DoesNotExist')
    expect(isClimbable(empty, [hold(0, 1)], new Set())).toBe(true)
  })
})

describe('visibleSetIds', () => {
  it('always includes always-on feet sets, even when filtering down', () => {
    const visible = visibleSetIds(new Set([17]), masters)
    expect(visible.has(17)).toBe(true)
    expect(visible.has(20)).toBe(true) // feet never disappear
    expect(visible.has(18)).toBe(false)
  })
})

describe('active set string round-trip', () => {
  it('empty string means all filterable sets active', () => {
    const ids = activeSetIds('', masters)
    expect(ids).toEqual(new Set([17, 18, 19, 21, 22, 23]))
    expect(isAllActive(ids, masters)).toBe(true)
  })

  it('a subset parses back to those ids and canonicalises to a sorted string', () => {
    const ids = activeSetIds('21|17', masters)
    expect(ids).toEqual(new Set([17, 21]))
    expect(isAllActive(ids, masters)).toBe(false)
    expect(activeCsv(ids, masters)).toBe('17|21')
  })

  it('all filterable active canonicalises to the empty (filter-off) string', () => {
    const all = new Set([17, 18, 19, 21, 22, 23])
    expect(activeCsv(all, masters)).toBe('')
  })

  it('ignores non-filterable and garbage ids in the stored string', () => {
    const ids = activeSetIds('20|999|abc|17', masters) // 20 is always-on, not filterable
    expect(ids).toEqual(new Set([17]))
  })
})
