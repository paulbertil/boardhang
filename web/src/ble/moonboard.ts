// Web Bluetooth client for the DIY MoonBoard LED controller.
// TS port of shared/spec/ble-protocol.md (from
// ios/MoonBoardLED/BLE/MoonBoardBLEManager.swift). Separate reimplementation,
// not a shared binary.

import type { HoldAssignment } from '../types'
import { displayed, protocolLetter } from '../types'
import { ledIndex } from '../board/geometry'

// Nordic UART Service UUIDs (must be lowercase for Web Bluetooth).
export const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
export const RX_CHAR = '6e400002-b5a3-f393-e0a9-e50e24dcca9e' // write (app → board)

/**
 * The firmware characteristic stores at most 20 bytes per write and silently
 * truncates the rest, so every message MUST be split into ≤20-byte writes. Do
 * NOT size from the MTU — modern stacks report ~180 but the firmware still only
 * keeps 20. See shared/spec/ble-protocol.md.
 */
const MAX_CHUNK_LENGTH = 20

export type ConnectionState = 'disconnected' | 'connecting' | 'connected'

export interface MessageOptions {
  rows: number
  flipped: boolean
  showBeta: boolean
}

/**
 * Build the firmware message string for a set of holds. With beta off, the
 * left/right/match roles all light blue (right). Mirrors Swift `message(for:)`.
 */
export function buildMessage(holds: HoldAssignment[], opts: MessageOptions): string {
  const tokens = holds.map((h) => {
    const led = ledIndex(h.col, h.row, opts.rows, opts.flipped)
    const letter = protocolLetter[displayed(h.type, opts.showBeta)]
    return `${letter}${led}`
  })
  return 'l#' + tokens.join(',') + '#'
}

// Web Bluetooth API types come from @types/web-bluetooth (dev dependency).

function getBluetooth(): Bluetooth {
  const bt = navigator.bluetooth
  if (!bt) {
    throw new Error(
      'Web Bluetooth is not available. Use desktop Chrome/Edge over localhost/HTTPS, ' +
        'Android Chrome, or Bluefy on iPhone.',
    )
  }
  return bt
}

/**
 * Turn an unknown thrown/rejected BLE value into a message worth showing.
 * Desktop Chrome rejects GATT failures as full-text Errors, but the iOS Bluefy
 * shim can reject with a bare DOMException or a non-Error value — e.g. a numeric
 * code that `String()`s to "2" — which is useless to the user. A real message
 * contains letters; anything without (a bare code, empty string) falls back to a
 * friendly, actionable line.
 */
export function describeBleError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : typeof err === 'string'
          ? err
          : ''
  const msg = raw.trim()
  if (/[a-z]/i.test(msg)) return msg
  return "Couldn't reach the board — make sure it's on and in range, then try again."
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * writeValueWithoutResponse can transiently reject (GATT momentarily busy, a
 * radio hiccup) even on a healthy connection. Retry once after a short beat
 * before giving up; a genuine failure (disconnected, out of range) rejects again
 * and propagates.
 */
async function writeWithRetry(
  characteristic: BluetoothRemoteGATTCharacteristic,
  chunk: BufferSource,
): Promise<void> {
  try {
    await characteristic.writeValueWithoutResponse(chunk)
  } catch {
    await delay(120)
    await characteristic.writeValueWithoutResponse(chunk)
  }
}

/**
 * Stateful client wrapping a single board connection. Call `onStateChange` to
 * surface connection state to React.
 */
export class MoonBoardClient {
  private device: BluetoothDevice | null = null
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null
  private onDisconnected = () => this.handleDisconnected()

  state: ConnectionState = 'disconnected'
  deviceName: string | null = null
  onStateChange: (() => void) | null = null

  private setState(state: ConnectionState, deviceName: string | null) {
    this.state = state
    this.deviceName = deviceName
    this.onStateChange?.()
  }

  /** Prompt the picker and connect. Must be called from a user gesture. */
  async connect(): Promise<void> {
    const bluetooth = getBluetooth()
    this.setState('connecting', null)
    try {
      const device = await bluetooth.requestDevice({
        filters: [{ services: [NUS_SERVICE] }],
      })
      this.device = device
      device.addEventListener('gattserverdisconnected', this.onDisconnected)

      const server = await device.gatt!.connect()
      const service = await server.getPrimaryService(NUS_SERVICE)
      this.characteristic = await service.getCharacteristic(RX_CHAR)
      this.setState('connected', device.name ?? 'MoonBoard')
    } catch (err) {
      this.cleanup()
      this.setState('disconnected', null)
      throw err
    }
  }

  disconnect(): void {
    this.device?.gatt?.disconnect()
    this.cleanup()
    this.setState('disconnected', null)
  }

  private handleDisconnected() {
    this.cleanup()
    this.setState('disconnected', null)
  }

  private cleanup() {
    this.device?.removeEventListener('gattserverdisconnected', this.onDisconnected)
    this.characteristic = null
    this.device = null
  }

  /** Send the given holds to the board. */
  async send(holds: HoldAssignment[], opts: MessageOptions): Promise<void> {
    await this.write(buildMessage(holds, opts))
  }

  /** Turn all LEDs off (empty problem string). */
  async clear(): Promise<void> {
    await this.write('l##')
  }

  /**
   * ASCII-encode, split into ≤20-byte chunks, and send each via
   * writeValueWithoutResponse awaited sequentially. Awaiting each write is the
   * web equivalent of CoreBluetooth's flow-controlled queue (back-pressure).
   */
  private async write(message: string): Promise<void> {
    const characteristic = this.characteristic
    if (!characteristic || this.state !== 'connected') {
      throw new Error('Not connected')
    }
    const bytes = asciiEncode(message)
    for (let offset = 0; offset < bytes.length; offset += MAX_CHUNK_LENGTH) {
      // slice() copies into a fresh ArrayBuffer, satisfying BufferSource.
      const chunk = bytes.slice(offset, offset + MAX_CHUNK_LENGTH)
      await writeWithRetry(characteristic, chunk)
    }
  }
}

function asciiEncode(message: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(message.length))
  for (let i = 0; i < message.length; i++) {
    bytes[i] = message.charCodeAt(i) & 0x7f
  }
  return bytes
}
