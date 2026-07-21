// A shell-owned mount point inside the frosted sticky header, below the filter-pill
// slot. AppLayout renders an empty `.app-header-slot` element and publishes it here;
// the catalog portals its SessionBar into it while a session for the routed board is
// active, so the crew bar stays visible as the problem list scrolls (issue #98) —
// inheriting the header's blur/scroll-shadow. The portal teleports only the DOM
// output; SessionBar keeps rendering inside CatalogScreen where its props live.
// Empty (no session / every non-catalog route) ⇒ `.app-header-slot:empty` collapses
// it to zero height. Mirrors headerFilterSlot.ts.

import { createContext, useContext } from 'react'

/** The slot element, or null before AppLayout has mounted it. */
export const HeaderSessionSlotContext = createContext<HTMLElement | null>(null)

export function useHeaderSessionSlot(): HTMLElement | null {
  return useContext(HeaderSessionSlotContext)
}
