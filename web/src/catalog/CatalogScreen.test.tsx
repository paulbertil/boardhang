import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogProblem } from './catalogSync'
import { recordRecent } from './recentsStore'
import { DEFAULT_FILTERS } from './filters'
import { CatalogScreen } from './CatalogScreen'
import { AuthProvider } from '../auth/AuthProvider'

// Board 7 / angle 40 is the default board+angle with a clean localStorage
// (DEFAULT_ACTIVE = 7, board 7's only angle is 40), so CatalogScreen resolves
// to that slab without any seeding.
const LAYOUT = 7
const ANGLE = 40

function problem(id: string, name: string, stars: number): CatalogProblem {
  return {
    source_catalog_id: id,
    layout_id: LAYOUT,
    angle: ANGLE,
    name,
    grade: '6B',
    user_grade: null,
    setter: 'Alice',
    stars,
    repeats: 0,
    is_benchmark: false,
    method: null,
    holds: [{ c: 0, r: 1, t: 'start' }],
  }
}

// Full slab: 'Visible' passes a minStars filter, 'Hidden' does not.
const SLAB = [problem('a', 'Visible', 5), problem('b', 'Hidden', 0)]

// Feed CatalogScreen a fixed slab instead of the async cache/sync layer.
vi.mock('./useSlab', () => ({
  useSlab: () => ({ problems: SLAB, loading: false, degraded: false }),
}))

// ProblemDetail (opened by tapping a recent) reaches for Web Bluetooth.
vi.mock('../ble/useBle', () => ({
  useBle: vi.fn(() => ({ state: 'disconnected', deviceName: null, error: null })),
  connectBoard: vi.fn(),
  isConnected: vi.fn(() => false),
  setBleError: vi.fn(),
  bleClient: { send: vi.fn(), state: 'disconnected' },
}))

beforeEach(() => {
  localStorage.clear()
  window.dispatchEvent(new StorageEvent('storage'))
  vi.clearAllMocks()
  // Active grade/stars filter that narrows the displayed list to 'Visible'.
  localStorage.setItem(
    `catalogFilters_${LAYOUT}_${ANGLE}`,
    JSON.stringify({ ...DEFAULT_FILTERS, minStars: 1 }),
  )
})

describe('CatalogScreen — recents open regardless of filters', () => {
  it('opens a recent that is filtered out of the displayed list, over the full slab', () => {
    // 'Hidden' was viewed but is excluded by the active minStars filter.
    recordRecent(LAYOUT, ANGLE, 'b')
    render(
      <AuthProvider>
        <CatalogScreen />
      </AuthProvider>,
    )

    // Precondition: the filter hides 'Hidden' from the main list.
    expect(screen.getByText('Visible')).toBeInTheDocument()
    expect(screen.queryByText('Hidden')).toBeNull()

    // Open the recents sheet and tap the filtered-out recent.
    fireEvent.click(screen.getByRole('button', { name: /recently viewed/i }))
    fireEvent.click(screen.getByText('Hidden'))

    // The detail pager opened on 'Hidden' — its nav controls are detail-only,
    // proving the recent opened despite being filtered out of `displayed`.
    expect(screen.getByText('Hidden')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next problem/i })).toBeInTheDocument()
  })
})
