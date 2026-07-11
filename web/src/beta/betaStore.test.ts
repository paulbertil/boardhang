import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

// Mock supabase with a chainable query builder whose terminal .order() resolves a
// per-test-controlled { data, error } — the shape betaStore awaits.
let nextResult: { data: unknown; error: unknown } = { data: [], error: null }
vi.mock('../supabase/client', () => {
  const builder: Record<string, unknown> = {}
  builder.select = () => builder
  builder.eq = () => builder
  builder.order = () => Promise.resolve(nextResult)
  return { supabase: { from: () => builder }, isConfigured: true }
})

import { useBetaVideos, refetchBeta, _resetBetaCache } from './betaStore'
import type { BetaVideo } from './betaTypes'

function vid(id: string, views: number): BetaVideo {
  return {
    id, source_catalog_id: 'p1', provider: 'youtube', video_id: id,
    title: id, channel: 'c', duration_s: 30, is_short: true, views,
  }
}

beforeEach(() => {
  _resetBetaCache()
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('betaStore', () => {
  it('goes loading → ready and preserves the server (views-desc) order', async () => {
    nextResult = { data: [vid('b', 9), vid('a', 5)], error: null }
    const { result } = renderHook(() => useBetaVideos('p1'))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.videos.map((v) => v.id)).toEqual(['b', 'a'])
  })

  it('reports a clean empty state when a problem has no betas', async () => {
    nextResult = { data: [], error: null }
    const { result } = renderHook(() => useBetaVideos('p2'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.videos).toEqual([])
  })

  it('surfaces an error and recovers on refetch', async () => {
    nextResult = { data: null, error: { message: 'boom' } }
    const { result } = renderHook(() => useBetaVideos('p3'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    nextResult = { data: [vid('x', 1)], error: null }
    act(() => refetchBeta('p3'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.videos).toHaveLength(1)
  })

  it('serves a cached entry instantly on re-open (no loading flash)', async () => {
    nextResult = { data: [vid('a', 1)], error: null }
    const first = renderHook(() => useBetaVideos('p4'))
    await waitFor(() => expect(first.result.current.status).toBe('ready'))
    const second = renderHook(() => useBetaVideos('p4'))
    expect(second.result.current.status).toBe('ready')
  })
})
