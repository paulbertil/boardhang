import { describe, expect, it } from 'vitest'
import {
  boardShortLabel,
  formatListDate,
  fromListProblemRow,
  fromListRow,
  trimListName,
  type ListProblemRow,
  type ListRow,
} from './listsTypes'

describe('fromListRow', () => {
  it('maps a full row including deleted and board_layout_id', () => {
    const row: ListRow = {
      id: 'list-1',
      owner_id: 'user-1',
      name: 'Projects',
      board_layout_id: 7,
      created_at: '2026-07-06T00:00:00Z',
      updated_at: '2026-07-06T01:00:00Z',
      deleted: true,
    }
    expect(fromListRow(row)).toEqual({
      id: 'list-1',
      ownerId: 'user-1',
      name: 'Projects',
      boardLayoutId: 7,
      createdAt: '2026-07-06T00:00:00Z',
      updatedAt: '2026-07-06T01:00:00Z',
      deleted: true,
    })
  })
})

describe('fromListProblemRow', () => {
  it('maps a row, preserving source_catalog_id and a null added_by', () => {
    const row: ListProblemRow = {
      id: 'lp-1',
      list_id: 'list-1',
      source_catalog_id: 'cat-42',
      board_layout_id: 7,
      added_by: null,
      created_at: '2026-07-06T00:00:00Z',
      updated_at: '2026-07-06T00:00:00Z',
      deleted: false,
    }
    expect(fromListProblemRow(row)).toEqual({
      id: 'lp-1',
      listId: 'list-1',
      sourceCatalogId: 'cat-42',
      boardLayoutId: 7,
      addedBy: null,
      createdAt: '2026-07-06T00:00:00Z',
      updatedAt: '2026-07-06T00:00:00Z',
      deleted: false,
    })
  })
})

describe('boardShortLabel', () => {
  it('drops the shared MoonBoard word for a compact label', () => {
    expect(boardShortLabel('Mini MoonBoard 2025')).toBe('Mini 2025')
    expect(boardShortLabel('MoonBoard Masters 2019')).toBe('Masters 2019')
    expect(boardShortLabel('MoonBoard 2024')).toBe('2024')
  })

  it('falls back sanely for an unknown or empty name', () => {
    expect(boardShortLabel('Kilter')).toBe('Kilter')
    expect(boardShortLabel('')).toBe('Board')
    expect(boardShortLabel('MoonBoard')).toBe('MoonBoard')
  })
})

describe('trimListName', () => {
  it('trims surrounding whitespace', () => {
    expect(trimListName('  Endurance  ')).toBe('Endurance')
  })

  it('caps at the max length', () => {
    const long = 'x'.repeat(200)
    expect(trimListName(long)).toHaveLength(60)
  })

  it('leaves an empty/whitespace-only name empty (the caller rejects it)', () => {
    expect(trimListName('   ')).toBe('')
    expect(trimListName('')).toBe('')
  })
})

describe('formatListDate', () => {
  it('formats as weekday, month, day with no year', () => {
    // 2026-07-07 is a Tuesday (constructed with local components → no tz date shift).
    expect(formatListDate(new Date(2026, 6, 7))).toBe('Tue, Jul 7')
  })

  it('always matches the "Ddd, Mmm D" shape', () => {
    expect(formatListDate(new Date(2026, 11, 25))).toMatch(/^\w{3}, \w{3} \d{1,2}$/)
  })
})
