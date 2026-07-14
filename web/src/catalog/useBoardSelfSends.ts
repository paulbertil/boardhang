// Board-scoped self ascent-id sets from the LOCAL logbook — the authoritative, instant source
// for "you sent this" everywhere it is shown: the row green-check, the session sends pill's self
// chip, and the session "Sent" filter. Sourcing all three from this one hook is what keeps them
// from drifting: self's own sends are known locally the moment they're logged, so they must never
// depend on the cross-member projection (session_member_ascents), which round-trips and is stale
// for your own fresh send. The projection stays the source of truth for OTHER members only.
//
// `sentIds` are true sends (a === false attempts excluded); `loggedIds` are any ascent (send or
// attempt), so a problem in loggedIds but not sentIds reads as "Attempted".

import { useMemo } from 'react'
import type { CatalogBoardDef } from '../board/boards'
import { useAscents } from '../logbook/ascents'

export interface BoardSelfSends {
  sentIds: Set<string>
  loggedIds: Set<string>
}

export function useBoardSelfSends(board: CatalogBoardDef): BoardSelfSends {
  const { ascents } = useAscents()
  const sentIds = useMemo(
    () =>
      new Set(
        ascents
          .filter((a) => a.sent && a.boardLayoutId === board.layoutId && a.sourceCatalogId)
          .map((a) => a.sourceCatalogId as string),
      ),
    [ascents, board.layoutId],
  )
  const loggedIds = useMemo(
    () =>
      new Set(
        ascents
          .filter((a) => a.boardLayoutId === board.layoutId && a.sourceCatalogId)
          .map((a) => a.sourceCatalogId as string),
      ),
    [ascents, board.layoutId],
  )
  return { sentIds, loggedIds }
}
