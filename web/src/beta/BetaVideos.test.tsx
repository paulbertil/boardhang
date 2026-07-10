import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { BetaEntry } from './betaStore'
import type { BetaVideo } from './betaTypes'

// Drive the section purely by store state; the player sheet stays closed (video=null).
let entry: BetaEntry = { status: 'loading', videos: [], error: null }
const refetch = vi.fn()
vi.mock('./betaStore', () => ({
  useBetaVideos: () => entry,
  refetchBeta: (id: string) => refetch(id),
}))

import { BetaVideos } from './BetaVideos'

function vid(id: string): BetaVideo {
  return {
    id, source_catalog_id: 'p', provider: 'youtube', video_id: id,
    title: id, channel: `Chan ${id}`, duration_s: 30, is_short: true, views: 1,
  }
}

describe('BetaVideos', () => {
  it('shows the empty state when there are no betas', () => {
    entry = { status: 'ready', videos: [], error: null }
    render(<BetaVideos sourceCatalogId="p" />)
    expect(screen.getByText('No beta videos yet.')).toBeTruthy()
  })

  it('renders a labelled card per video', () => {
    entry = { status: 'ready', videos: [vid('a'), vid('b')], error: null }
    render(<BetaVideos sourceCatalogId="p" />)
    const cards = screen.getAllByRole('button', { name: /Beta by/ })
    expect(cards).toHaveLength(2)
    expect(cards[0].getAttribute('aria-label')).toContain('Chan a')
  })

  it('offers a Try again action on error that re-fetches', () => {
    entry = { status: 'error', videos: [], error: 'boom' }
    render(<BetaVideos sourceCatalogId="p" />)
    expect(screen.getByText(/Couldn.t load beta videos/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalledWith('p')
  })
})
