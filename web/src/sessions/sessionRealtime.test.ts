import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface FakeChannel {
  name: string
  opts: { config?: { private?: boolean } }
  cb?: (msg: { payload?: { author?: string } }) => void
  subscribed: boolean
}

const h = vi.hoisted(() => ({
  nullClient: false,
  session: { access_token: 'tok', user: { id: 'self' } } as
    | { access_token: string; user: { id: string } }
    | null,
  channels: [] as FakeChannel[],
  removed: [] as FakeChannel[],
  setAuthCalls: [] as (string | undefined)[],
  refetchCalls: 0,
}))

vi.mock('./memberAscentsStore', () => ({
  refreshMemberAscents: () => {
    h.refetchCalls += 1
    return Promise.resolve()
  },
}))

vi.mock('../supabase/client', () => ({
  get supabase() {
    if (h.nullClient) return null
    return {
      auth: { getSession: () => Promise.resolve({ data: { session: h.session } }) },
      realtime: { setAuth: (t?: string) => h.setAuthCalls.push(t) },
      channel: (name: string, opts: FakeChannel['opts']) => {
        // One object carries both the recorded fields and the chained API, so the same
        // reference the module stores is what removeChannel() receives.
        const ch = { name, opts, subscribed: false } as FakeChannel & {
          on: (t: string, f: unknown, cb: FakeChannel['cb']) => typeof ch
          subscribe: () => typeof ch
        }
        ch.on = (_type, _filter, cb) => {
          ch.cb = cb
          return ch
        }
        ch.subscribe = () => {
          ch.subscribed = true
          return ch
        }
        h.channels.push(ch)
        return ch
      },
      removeChannel: (ch: unknown) => h.removed.push(ch as FakeChannel),
    }
  },
  isConfigured: true,
}))

import { NUDGE_DEBOUNCE_MS, activateSessionRealtime } from './sessionRealtime'

/** Flush the getSession().then microtask chain that sets up the channel. */
async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  vi.useFakeTimers()
  h.nullClient = false
  h.session = { access_token: 'tok', user: { id: 'self' } }
  h.channels = []
  h.removed = []
  h.setAuthCalls = []
  h.refetchCalls = 0
})

afterEach(() => {
  activateSessionRealtime(null)
  vi.useRealTimers()
})

describe('sessionRealtime', () => {
  it('opens a private session:<id> channel, authorizes the socket, and subscribes', async () => {
    activateSessionRealtime('S1')
    await flush()
    expect(h.channels).toHaveLength(1)
    expect(h.channels[0].name).toBe('session:S1')
    expect(h.channels[0].opts.config?.private).toBe(true)
    expect(h.channels[0].subscribed).toBe(true)
    expect(h.setAuthCalls).toEqual(['tok'])
  })

  it('debounce-refetches once on a co-member nudge', async () => {
    activateSessionRealtime('S1')
    await flush()
    h.channels[0].cb?.({ payload: { author: 'other' } })
    expect(h.refetchCalls).toBe(0) // debounced, not yet
    vi.advanceTimersByTime(NUDGE_DEBOUNCE_MS)
    expect(h.refetchCalls).toBe(1)
  })

  it('coalesces a burst of nudges into a single refetch', async () => {
    activateSessionRealtime('S1')
    await flush()
    h.channels[0].cb?.({ payload: { author: 'other' } })
    h.channels[0].cb?.({ payload: { author: 'other' } })
    h.channels[0].cb?.({ payload: { author: 'other' } })
    vi.advanceTimersByTime(NUDGE_DEBOUNCE_MS)
    expect(h.refetchCalls).toBe(1)
  })

  it('skips our own send (self author) — no refetch', async () => {
    activateSessionRealtime('S1')
    await flush()
    h.channels[0].cb?.({ payload: { author: 'self' } })
    vi.advanceTimersByTime(NUDGE_DEBOUNCE_MS)
    expect(h.refetchCalls).toBe(0)
  })

  it('tears down the channel on deactivate and does not leak on switch', async () => {
    activateSessionRealtime('S1')
    await flush()
    activateSessionRealtime('S2')
    await flush()
    // Previous channel removed; a fresh channel opened for S2.
    expect(h.removed).toHaveLength(1)
    expect(h.removed[0].name).toBe('session:S1')
    expect(h.channels).toHaveLength(2)
    expect(h.channels[1].name).toBe('session:S2')

    activateSessionRealtime(null)
    expect(h.removed).toHaveLength(2)
    expect(h.removed[1].name).toBe('session:S2')
  })

  it('is idempotent on the same id (no duplicate channel)', async () => {
    activateSessionRealtime('S1')
    await flush()
    activateSessionRealtime('S1')
    await flush()
    expect(h.channels).toHaveLength(1)
  })

  it('does not leak a channel on same-id re-activation with overlapping getSession', async () => {
    // S1 → null → S1 with two getSession() promises in flight. An id-based guard would let the
    // superseded first activation create a second, orphaned channel; the activation-token guard
    // must drop it so exactly one channel exists and it tears down cleanly.
    activateSessionRealtime('S1') // token 1, getSession #1 queued
    activateSessionRealtime(null) // token 2, teardown (no channel yet)
    activateSessionRealtime('S1') // token 3, getSession #2 queued
    await flush()
    expect(h.channels).toHaveLength(1)
    expect(h.channels[0].name).toBe('session:S1')
    activateSessionRealtime(null)
    expect(h.removed).toHaveLength(1) // the one real channel removed; no orphan left behind
  })

  it('no-ops when the client is unconfigured (pull-model fallback)', async () => {
    h.nullClient = true
    activateSessionRealtime('S1')
    await flush()
    expect(h.channels).toHaveLength(0)
    expect(h.refetchCalls).toBe(0)
  })

  it('does not skip when self id is unresolved (refetches to be safe)', async () => {
    h.session = null // no session → selfId stays null
    activateSessionRealtime('S1')
    await flush()
    h.channels[0].cb?.({ payload: { author: 'other' } })
    vi.advanceTimersByTime(NUDGE_DEBOUNCE_MS)
    expect(h.refetchCalls).toBe(1)
  })
})
