// Dismissable nudge to go full-screen in Bluefy. Bluefy has no "Add to Home
// Screen" (that's Safari-only on iOS, and a Safari-installed icon loses Web
// Bluetooth), but its menu has an "Enter fullscreen" item that hides the browser
// bars for an app-like view while keeping the BLE connection. Shown on iOS in a
// Bluetooth-capable browser (Bluefy) that isn't already app-like. Dismissal is
// remembered (best-effort).

import { useState } from 'react'
import { Maximize, Menu, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FULLSCREEN_TIP_DISMISSED_KEY, safeGetItem, safeSetItem, shouldOfferFullscreenTip } from '@/lib/pwa'

export function InstallBanner() {
  // Both evaluated once at mount: the environment can't change within a session.
  const [offer] = useState(shouldOfferFullscreenTip)
  const [dismissed, setDismissed] = useState(() => safeGetItem(FULLSCREEN_TIP_DISMISSED_KEY) === '1')

  if (!offer || dismissed) return null

  const dismiss = () => {
    safeSetItem(FULLSCREEN_TIP_DISMISSED_KEY, '1')
    setDismissed(true)
  }

  return (
    <Card role="region" aria-label="Go full screen" className="shrink-0 border-primary/30">
      <CardContent className="flex items-start gap-3 text-sm">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">Hide the browser bars</p>
          <p className="text-muted-foreground">
            In Bluefy, tap the <Menu aria-hidden className="inline size-4 align-text-bottom" /> menu,
            then{' '}
            <span className="whitespace-nowrap">
              <Maximize aria-hidden className="inline size-4 align-text-bottom" /> Enter fullscreen
            </span>{' '}
            for a distraction-free view of the wall.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss full-screen tip"
          onClick={dismiss}
          className="-mr-1 shrink-0"
        >
          <X />
        </Button>
      </CardContent>
    </Card>
  )
}
