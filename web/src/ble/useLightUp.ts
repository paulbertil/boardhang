// The "light up this problem's holds over BLE" interaction, extracted from ProblemDetail
// so both the detail drawer and the catalog last-opened bar can reuse it. Connects the
// board first when disconnected, then sends the mapped hold assignments; tracks the
// connecting/sending phase and a lit flag. A send failure is surfaced here as a toast
// (both consumers are too slim for inline error text). `lit` resets whenever the target
// problem changes (resetKey) or the board disconnects.

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { bleClient, connectBoard, isConnected, setBleError, useBle } from './useBle'
import { describeBleError } from './moonboard'
import { getFlipped } from '../board/boardStore'
import type { CatalogBoardDef } from '../board/boards'
import type { CatalogHold } from '../catalog/catalogSync'
import type { HoldAssignment } from '../types'

function toHoldAssignments(holds: CatalogHold[]): HoldAssignment[] {
  return holds.map((h) => ({ col: h.c, row: h.r, type: h.t }))
}

export type LightUpBusy = 'connecting' | 'sending' | null

interface UseLightUpResult {
  /** Connect if needed, then send `holds` to the board. No-op while already busy. */
  lightUp: (holds: CatalogHold[]) => Promise<void>
  /** True once a send has completed for the current target; reset on target/disconnect. */
  lit: boolean
  busy: LightUpBusy
  /** The live BLE connection state (for label/affordance decisions). */
  state: ReturnType<typeof useBle>['state']
}

/** @param resetKey a value that changes when the target problem changes (e.g. its id). */
export function useLightUp(board: CatalogBoardDef, resetKey: string): UseLightUpResult {
  const { state } = useBle()
  const [lit, setLit] = useState(false)
  const [busy, setBusy] = useState<LightUpBusy>(null)

  // A newly-targeted problem isn't lit yet; disconnecting clears the lit state.
  useEffect(() => setLit(false), [resetKey])
  useEffect(() => {
    if (state !== 'connected') setLit(false)
  }, [state])

  async function lightUp(holds: CatalogHold[]) {
    if (busy) return
    setBleError(null)
    if (!isConnected()) {
      setBusy('connecting')
      await connectBoard()
      if (!isConnected()) {
        setBusy(null)
        return // cancelled or failed
      }
    }
    setBusy('sending')
    try {
      await bleClient.send(toHoldAssignments(holds), {
        rows: board.geometry.numRows,
        flipped: getFlipped(board.layoutId),
        showBeta: true,
      })
      setLit(true)
    } catch (err) {
      toast.error(describeBleError(err))
    } finally {
      setBusy(null)
    }
  }

  return { lightUp, lit, busy, state }
}
