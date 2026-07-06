// Non-dismissable notice shown when the current browser has no Web Bluetooth, so
// the board can't connect at all. The recommendation is platform-aware: on iOS
// only Bluefy can do Web Bluetooth; everywhere else (Android Firefox, desktop
// Safari/Firefox) Chrome can. Stays until the user switches browsers (at which
// point the condition is false); intentionally has no dismiss control.

import { Bluetooth } from 'lucide-react'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { isIosLike, shouldShowBleBrowserPrompt } from '@/lib/pwa'

export function BleBrowserBanner() {
  // Environment doesn't change within a session — evaluate once.
  if (!shouldShowBleBrowserPrompt()) return null

  return (
    <Item
      variant="outline"
      role="region"
      aria-label="Bluetooth not supported"
      className="shrink-0 items-start gap-3 border-destructive/40 bg-destructive/5 p-4"
    >
      <ItemMedia variant="icon" className="mt-0.5 self-start text-destructive">
        <Bluetooth aria-hidden className="size-5" />
      </ItemMedia>
      <ItemContent className="gap-1">
        <ItemTitle className="font-medium text-destructive">
          This browser can’t connect to Bluetooth
        </ItemTitle>
        {isIosLike() ? (
          <ItemDescription className="line-clamp-none">
            To light up your MoonBoard on iPhone, open this page in{' '}
            <span className="font-medium text-foreground">Bluefy</span> — a free Bluetooth browser
            from the App Store. Safari can’t talk to the board.
          </ItemDescription>
        ) : (
          <ItemDescription className="line-clamp-none">
            To light up your MoonBoard, open this page in{' '}
            <span className="font-medium text-foreground">Google Chrome</span>, which supports Web
            Bluetooth. This browser can’t talk to the board.
          </ItemDescription>
        )}
      </ItemContent>
    </Item>
  )
}
