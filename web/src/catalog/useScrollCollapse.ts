// Scroll-collapse signal for the sticky session bar. The bar lives portaled inside the
// sticky header, which sits inside the shell's single scroll container (.app-scroll), so
// the host element can find its scroller via closest() — no AppLayout plumbing needed.
//
// Hysteresis (collapse past 64px, re-expand only under 16px) keeps the bar from
// flickering when the list rests near the boundary. `expand()` is the tap-to-expand
// override while scrolled: it pins the bar open until the next real scroll gesture
// (wheel/touch drag), then the bar re-collapses.

import { useEffect, useRef, useState, type RefObject } from 'react'

const COLLAPSE_AT = 64
const EXPAND_AT = 16

export function useScrollCollapse(
  hostRef: RefObject<HTMLElement | null>,
): { collapsed: boolean; expand: () => void } {
  const [collapsed, setCollapsed] = useState(false)
  const [manual, setManual] = useState(false)
  const manualRef = useRef(false)
  manualRef.current = manual

  useEffect(() => {
    const scroller = hostRef.current?.closest('.app-scroll')
    if (!scroller) return

    let raf = 0
    const measure = () => {
      raf = 0
      // While tap-expanded, ignore position changes entirely: expanding grows the
      // header, scroll anchoring nudges scrollTop to compensate, and treating that
      // nudge as a user scroll would instantly re-collapse the bar. Real gestures
      // are detected separately (wheel/touchmove below).
      if (manualRef.current) return
      // Hysteresis: a collapsed bar stays collapsed until nearly at the top; an
      // expanded bar stays expanded until clearly scrolled.
      const top = scroller.scrollTop
      setCollapsed((prev) => (prev ? top > EXPAND_AT : top > COLLAPSE_AT))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    measure()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [hostRef])

  // A tap-expanded bar re-collapses on the next real scroll gesture — wheel or touch
  // drag on the scroller — never on programmatic/anchoring scrollTop shifts.
  useEffect(() => {
    if (!manual) return
    const scroller = hostRef.current?.closest('.app-scroll')
    if (!scroller) return
    const clear = () => setManual(false)
    scroller.addEventListener('wheel', clear, { passive: true })
    scroller.addEventListener('touchmove', clear, { passive: true })
    return () => {
      scroller.removeEventListener('wheel', clear)
      scroller.removeEventListener('touchmove', clear)
    }
  }, [manual, hostRef])

  const expand = () => setManual(true)

  return { collapsed: collapsed && !manual, expand }
}
