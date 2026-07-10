import { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { BetaVideo } from './betaTypes'

// Privacy-friendly official embed (no tracking cookie until play). `playsinline` keeps it in
// the sheet on iOS instead of taking over the screen.
function embedSrc(v: BetaVideo): string {
  return `https://www.youtube-nocookie.com/embed/${v.video_id}?autoplay=1&playsinline=1&rel=0`
}
function watchUrl(v: BetaVideo): string {
  return `https://youtu.be/${v.video_id}`
}

/**
 * Full-screen-ish player for one beta clip. States: iframe-loading placeholder → playing.
 * Embedding-disabled videos can't be detected cross-origin, so a "Watch on YouTube" out-link
 * is ALWAYS present as the guaranteed escape hatch. The Dialog itself provides the focus
 * trap + focus-return + Escape + backdrop-close; we add a history entry so the mobile back
 * gesture closes the sheet first without popping the ?problem= drawer.
 */
export function BetaPlayerSheet({ video, onClose }: { video: BetaVideo | null; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const close = useCallback(() => onClose(), [onClose])

  useEffect(() => {
    setLoaded(false) // reset the loading placeholder for each newly-opened clip
  }, [video?.video_id])

  useEffect(() => {
    if (!video) return
    window.history.pushState({ betaSheet: true }, '')
    const onPop = (): void => close()
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      // Closing via UI (not the back button): pop the entry we pushed so history stays clean.
      if (window.history.state?.betaSheet) window.history.back()
    }
  }, [video, close])

  return (
    <Dialog
      open={video !== null}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      {video && (
        <DialogContent showCloseButton className="w-[min(100vw-2rem,26rem)] max-w-none overflow-hidden p-0">
          <DialogTitle className="sr-only">Beta by {video.channel}</DialogTitle>
          <div className="relative aspect-[9/16] w-full bg-black">
            {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
            <iframe
              key={video.video_id}
              src={embedSrc(video)}
              title={`Beta by ${video.channel}`}
              onLoad={() => setLoaded(true)}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 size-full"
            />
          </div>
          <div className="flex items-center justify-between gap-2 p-3">
            <span className="min-w-0 truncate text-sm text-muted-foreground">{video.channel}</span>
            <a
              href={watchUrl(video)}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-8 shrink-0 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Watch on YouTube
            </a>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
