import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithRouter } from './test/renderWithRouter'
import { addBoard, getAngle } from './board/boardStore'
import { boardByLayoutId } from './board/boards'
import type { CatalogProblem } from './catalog/catalogSync'

// Keep the slab deterministic and network-free so route behavior is what's tested.
function problem(id: string, name: string): CatalogProblem {
  return {
    source_catalog_id: id,
    layout_id: 7,
    angle: 40,
    name,
    grade: '6B',
    user_grade: null,
    setter: 'Alice',
    stars: 0,
    repeats: 0,
    is_benchmark: false,
    method: null,
    holds: [{ c: 0, r: 1, t: 'start' }],
  }
}
const SLAB = [problem('a', 'Alpha'), problem('b', 'Bravo'), problem('c', 'Charlie')]

vi.mock('./catalog/useSlab', () => ({
  useSlab: () => ({ problems: SLAB, loading: false, degraded: false }),
}))

beforeEach(() => {
  localStorage.clear()
  window.dispatchEvent(new StorageEvent('storage')) // reset the boardStore snapshot
})

describe('bare-/ redirect', () => {
  it('lands on My Boards when no boards are added', async () => {
    renderWithRouter('/')
    expect(await screen.findByText('Add your first board')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
  })

  it('redirects to the active board catalog once a board is added', async () => {
    addBoard(7)
    renderWithRouter('/')
    // The catalog list renders the mocked slab.
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Search problems' })).toBeInTheDocument()
  })
})

describe('catalog route guards', () => {
  it('bounces an unknown board id to My Boards', async () => {
    addBoard(7)
    renderWithRouter('/board/999/catalog')
    expect(await screen.findByText(/my boards/i)).toBeInTheDocument()
  })

  it('previews a registry-valid but un-added board (does not bounce)', async () => {
    addBoard(7) // board 5 is valid but NOT added
    renderWithRouter('/board/5/catalog')
    expect(await screen.findByText('Add this board')).toBeInTheDocument()
    // Still browsable — the slab renders behind the preview banner.
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })
})

describe('URL is the source of truth', () => {
  it('seeds the search field from ?q on a deep link', async () => {
    addBoard(7)
    renderWithRouter('/board/7/catalog?q=crimp')
    const field = await screen.findByRole('textbox', { name: 'Search problems' })
    expect(field).toHaveValue('crimp')
  })

  it('opens a deep-linked problem drawer', async () => {
    addBoard(7)
    renderWithRouter('/board/7/catalog?problem=b')
    // ProblemDetail renders the problem's name as a heading (uppercased via CSS).
    expect(await screen.findByRole('heading', { name: 'Bravo' })).toBeInTheDocument()
  })

  it('mirrors a deep-linked ?angle back into boardStore', async () => {
    addBoard(5) // board 5 supports [40, 25]
    renderWithRouter('/board/5/catalog?angle=25')
    await screen.findByText('Alpha')
    await waitFor(() => expect(getAngle(boardByLayoutId(5)!)).toBe(25))
  })
})

describe('drawer history semantics', () => {
  it('Back closes a push-opened drawer without exiting the catalog', async () => {
    addBoard(7)
    const { router } = renderWithRouter('/board/7/catalog')
    await screen.findByText('Alpha')

    // Open a problem (push).
    fireEvent.click(screen.getByText('Bravo'))
    expect(await screen.findByRole('heading', { name: 'Bravo' })).toBeInTheDocument()
    expect(router.state.location.search).toMatchObject({ problem: 'b' })

    // Back closes the drawer (removes ?problem) and stays on the catalog.
    router.history.back()
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('problem'))
    expect(router.state.location.pathname).toBe('/board/7/catalog')
  })
})
