import { describe, expect, it } from 'vitest'
import { describeBleError } from './moonboard'

describe('describeBleError', () => {
  it('passes through a readable Error message', () => {
    expect(describeBleError(new Error('GATT Server is disconnected'))).toBe(
      'GATT Server is disconnected',
    )
  })

  it('reads .message off a non-Error object (DOMException-like)', () => {
    expect(describeBleError({ name: 'NetworkError', message: 'Write failed' })).toBe('Write failed')
  })

  it('passes through a readable string rejection', () => {
    expect(describeBleError('Bluetooth is off')).toBe('Bluetooth is off')
  })

  it('falls back for a bare numeric code (the iOS Bluefy "2" case)', () => {
    // A rejection that String()s to "2" carries no letters → unactionable.
    expect(describeBleError(2)).toContain("Couldn't reach the board")
    expect(describeBleError(new Error('2'))).toContain("Couldn't reach the board")
    expect(describeBleError({ message: 2 })).toContain("Couldn't reach the board")
  })

  it('falls back for empty/nullish rejections', () => {
    expect(describeBleError(new Error(''))).toContain("Couldn't reach the board")
    expect(describeBleError(null)).toContain("Couldn't reach the board")
    expect(describeBleError(undefined)).toContain("Couldn't reach the board")
  })
})
