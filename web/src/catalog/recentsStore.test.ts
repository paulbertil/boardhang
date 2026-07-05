import { beforeEach, describe, expect, it } from 'vitest'
import { clearRecents, getRecentIds, recordRecent } from './recentsStore'

beforeEach(() => localStorage.clear())

describe('recentsStore', () => {
  it('records views most-recent-first, deduped and capped at 5', () => {
    expect(getRecentIds(7, 40)).toEqual([])
    for (const id of ['a', 'b', 'c']) recordRecent(7, 40, id)
    expect(getRecentIds(7, 40)).toEqual(['c', 'b', 'a'])

    recordRecent(7, 40, 'a') // re-view moves to front, no duplicate
    expect(getRecentIds(7, 40)).toEqual(['a', 'c', 'b'])

    for (const id of ['d', 'e', 'f']) recordRecent(7, 40, id)
    expect(getRecentIds(7, 40)).toEqual(['f', 'e', 'd', 'a', 'c']) // capped at 5
  })

  it('is scoped per board+angle', () => {
    recordRecent(7, 40, 'mini')
    recordRecent(5, 25, 'masters')
    expect(getRecentIds(7, 40)).toEqual(['mini'])
    expect(getRecentIds(5, 25)).toEqual(['masters'])
  })

  it('clears a slab without touching others', () => {
    recordRecent(7, 40, 'a')
    recordRecent(5, 25, 'b')
    clearRecents(7, 40)
    expect(getRecentIds(7, 40)).toEqual([])
    expect(getRecentIds(5, 25)).toEqual(['b'])
  })
})
