// Covers the useMemberSenders HOOK behaviour that the pure buildSenders does not: the
// off-board `undefined` gate and the ready/paused/loading state derivation that drives
// sendersDimmed (paused) and the loading suppression. The stores are mocked so the hook
// is exercised in isolation.

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { boardByLayoutId } from '../board/boards'
import type { MemberAscentsState } from '../sessions/memberAscentsStore'
import { useMemberSenders } from './useMemberSenders'

const mockUseSessions = vi.fn()
const mockUseMemberAscents = vi.fn()
const mockSelfSends = vi.fn(() => ({ sentIds: new Set<string>(), loggedIds: new Set<string>() }))

vi.mock('../sessions/sessionsStore', () => ({ useSessions: () => mockUseSessions() }))
// Keep the real withSelfSends; only stub the reactive useMemberAscents hook.
vi.mock('../sessions/memberAscentsStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sessions/memberAscentsStore')>()
  return { ...actual, useMemberAscents: (id: string | null) => mockUseMemberAscents(id) }
})
vi.mock('./useBoardSelfSends', () => ({ useBoardSelfSends: () => mockSelfSends() }))

const board = boardByLayoutId(7)!

function ascents(over: Partial<MemberAscentsState> = {}): MemberAscentsState {
  return { ready: false, bySets: {}, members: [], error: null, stale: false, fetchedAt: null, ...over }
}

function withSession(boardLayoutId: number) {
  mockUseSessions.mockReturnValue({
    activeSession: { id: 's1', boardLayoutId },
    roster: [],
    selfId: 'me',
  })
}

beforeEach(() => {
  mockUseSessions.mockReset()
  mockUseMemberAscents.mockReset()
  mockUseMemberAscents.mockReturnValue(ascents())
  mockSelfSends.mockReset()
  mockSelfSends.mockReturnValue({ sentIds: new Set(), loggedIds: new Set() })
})

describe('useMemberSenders (hook)', () => {
  it('returns undefined when no session is active', () => {
    mockUseSessions.mockReturnValue({ activeSession: null, roster: [], selfId: 'me' })
    const { result } = renderHook(() => useMemberSenders(board))
    expect(result.current).toBeUndefined()
  })

  it('returns undefined when the active session targets a different board', () => {
    withSession(99) // not board 7
    const { result } = renderHook(() => useMemberSenders(board))
    expect(result.current).toBeUndefined()
  })

  it('maps ready -> "ready"', () => {
    withSession(7)
    mockUseMemberAscents.mockReturnValue(ascents({ ready: true }))
    expect(renderHook(() => useMemberSenders(board)).result.current!.state).toBe('ready')
  })

  it('maps a max-age drop (stale) -> "paused"', () => {
    withSession(7)
    mockUseMemberAscents.mockReturnValue(ascents({ ready: false, stale: true }))
    expect(renderHook(() => useMemberSenders(board)).result.current!.state).toBe('paused')
  })

  it('maps an errored projection -> "paused"', () => {
    withSession(7)
    mockUseMemberAscents.mockReturnValue(ascents({ ready: false, error: 'boom' }))
    expect(renderHook(() => useMemberSenders(board)).result.current!.state).toBe('paused')
  })

  it('maps a first-load (not ready, not stale/error) -> "loading"', () => {
    withSession(7)
    mockUseMemberAscents.mockReturnValue(ascents())
    expect(renderHook(() => useMemberSenders(board)).result.current!.state).toBe('loading')
  })

  it('shows self in the pill from the LOCAL logbook even when the projection lacks the send', () => {
    withSession(7)
    // Projection: self is a member but its sent set is stale/empty (your fresh send hasn't
    // round-tripped through session_member_ascents yet).
    mockUseMemberAscents.mockReturnValue(
      ascents({ ready: true, members: ['me'], bySets: { me: { sentIds: new Set(), loggedIds: new Set() } } }),
    )
    // Local logbook: you just logged a send on P1.
    mockSelfSends.mockReturnValue({ sentIds: new Set(['P1']), loggedIds: new Set(['P1']) })
    const chips = renderHook(() => useMemberSenders(board)).result.current!.senders.get('P1')
    expect(chips?.map((c) => c.userId)).toEqual(['me'])
    expect(chips?.[0].isSelf).toBe(true)
  })
})
