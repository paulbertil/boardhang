import { describe, expect, it } from 'vitest'
import { gradeHistogram, latestSession } from './profileStats'
import type { SendItem } from './socialTypes'

function send(over: Partial<SendItem>): SendItem {
  return {
    ascentId: 'a',
    actorId: 'u',
    handle: 'h',
    displayName: 'H',
    avatarUrl: null,
    sourceCatalogId: null,
    userProblemId: null,
    problemName: 'P',
    problemGrade: '6A',
    boardLayoutId: 1,
    climbedAt: '2026-07-10T12:00:00.000Z',
    firstSentAt: '2026-07-10T12:00:00.000Z',
    ...over,
  }
}

describe('gradeHistogram', () => {
  it('counts sends per grade, hardest first', () => {
    const bars = gradeHistogram([
      send({ ascentId: '1', problemGrade: '6A' }),
      send({ ascentId: '2', problemGrade: '7A' }),
      send({ ascentId: '3', problemGrade: '6A' }),
      send({ ascentId: '4', problemGrade: '6B' }),
    ])
    expect(bars).toEqual([
      { grade: '7A', count: 1 },
      { grade: '6B', count: 1 },
      { grade: '6A', count: 2 },
    ])
  })

  it('is empty for no sends', () => {
    expect(gradeHistogram([])).toEqual([])
  })
})

describe('latestSession', () => {
  it('returns null for no sends', () => {
    expect(latestSession([])).toBeNull()
  })

  it('groups the sends from the most recent local day', () => {
    const s = latestSession([
      send({ ascentId: 'old', climbedAt: '2026-07-01T10:00:00.000Z' }),
      send({ ascentId: 'new1', climbedAt: '2026-07-10T09:00:00.000Z' }),
      send({ ascentId: 'new2', climbedAt: '2026-07-10T18:00:00.000Z' }),
    ])
    expect(s?.sends.map((x) => x.ascentId)).toEqual(['new2', 'new1'])
  })

  it('ignores input order — the latest climbed day wins', () => {
    const s = latestSession([
      send({ ascentId: 'new', climbedAt: '2026-07-10T09:00:00.000Z' }),
      send({ ascentId: 'newer', climbedAt: '2026-07-12T09:00:00.000Z' }),
    ])
    expect(s?.sends.map((x) => x.ascentId)).toEqual(['newer'])
  })
})
