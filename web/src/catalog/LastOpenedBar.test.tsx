import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { boardByLayoutId } from '../board/boards'
import type { CatalogProblem } from './catalogSync'
import { LastOpenedBar } from './LastOpenedBar'
import { dismissLastOpened, recordOpened } from './lastOpenedStore'
import { isFavorite } from './favoritesStore'

// Isolate the bar from board-art rendering, the previews toggle, and the auth-gated sheet.
vi.mock('../board/CatalogBoard', () => ({
  CatalogBoard: () => <div data-testid="thumb" />,
}))
vi.mock('./previewsStore', () => ({ useShowPreviews: () => true }))

const lightUp = vi.fn()
vi.mock('../ble/useLightUp', () => ({
  useLightUp: () => ({
    lightUp: (holds: unknown) => lightUp(holds),
    lit: false,
    busy: null,
    error: null,
    state: 'disconnected',
  }),
}))

const board = boardByLayoutId(7)!
const ANGLE = 40

function problem(id: string, name: string): CatalogProblem {
  return {
    source_catalog_id: id,
    layout_id: 7,
    angle: ANGLE,
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

const a = problem('a', 'Alpha')
const b = problem('b', 'Bravo')
const c = problem('c', 'Charlie')
const list = [a, b, c]

const onOpen = vi.fn()
const onDismiss = vi.fn()

function mount(displayed = list, problems = list) {
  return render(
    <LastOpenedBar
      board={board}
      angle={ANGLE}
      displayed={displayed}
      problems={problems}
      onOpen={onOpen}
      onDismiss={onDismiss}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  dismissLastOpened(7, ANGLE)
})

describe('LastOpenedBar', () => {
  it('renders nothing on a cold load (no last-opened)', () => {
    const { container } = mount()
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the last-opened problem (name, grade, setter)', () => {
    recordOpened(7, ANGLE, 'b')
    mount()
    expect(screen.getByText('Bravo')).toBeInTheDocument()
    expect(screen.getByText('6B')).toBeInTheDocument()
    expect(screen.getByText('by Alice')).toBeInTheDocument()
  })

  it('body tap opens the drawer on the shown problem', () => {
    recordOpened(7, ANGLE, 'b')
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Open Bravo' }))
    expect(onOpen).toHaveBeenCalledWith('b')
  })

  it('› scrubs to the next in the filtered list without opening the drawer', () => {
    recordOpened(7, ANGLE, 'a')
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Next problem' }))
    expect(screen.getByText('Bravo')).toBeInTheDocument()
    expect(onOpen).not.toHaveBeenCalled()
    // ‹ goes back.
    fireEvent.click(screen.getByRole('button', { name: 'Previous problem' }))
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('keeps showing a filtered-out climb; › lands on the first filtered entry (R8)', () => {
    recordOpened(7, ANGLE, 'a')
    // `a` is not in the filtered list [b, c] but stays shown, resolved from the full slab.
    mount([b, c], list)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next problem' }))
    expect(screen.getByText('Bravo')).toBeInTheDocument()
  })

  it('disables ‹ at the list start and › at the list end', () => {
    recordOpened(7, ANGLE, 'a')
    mount()
    expect(screen.getByRole('button', { name: 'Previous problem' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next problem' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Next problem' })) // → b
    fireEvent.click(screen.getByRole('button', { name: 'Next problem' })) // → c (last)
    expect(screen.getByText('Charlie')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next problem' })).toBeDisabled()
  })

  it('re-seeds to a new last-opened, discarding the scrub position (R9)', () => {
    recordOpened(7, ANGLE, 'a')
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Next problem' })) // scrub → b
    expect(screen.getByText('Bravo')).toBeInTheDocument()
    // A fresh open elsewhere updates the store → bar jumps to it, scrub cleared.
    act(() => recordOpened(7, ANGLE, 'c'))
    expect(screen.getByText('Charlie')).toBeInTheDocument()
  })

  it('♡ toggles favorite for the shown problem', () => {
    recordOpened(7, ANGLE, 'b')
    mount()
    expect(isFavorite('b')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Favorite' }))
    expect(isFavorite('b')).toBe(true)
  })

  it('💡 lights up the shown problem’s holds', () => {
    recordOpened(7, ANGLE, 'b')
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Light up' }))
    expect(lightUp).toHaveBeenCalledWith(b.holds)
  })

  it('× calls onDismiss', () => {
    recordOpened(7, ANGLE, 'b')
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
