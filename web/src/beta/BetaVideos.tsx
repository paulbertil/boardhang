import { useState } from 'react'
import { Play } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useBetaVideos, refetchBeta } from './betaStore'
import type { BetaVideo } from './betaTypes'
import { BetaPlayerSheet } from './BetaPlayerSheet'

function fmtDur(s: number | null): string {
  if (s == null) return ''
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// hqdefault is a 480×360 LANDSCAPE frame (Shorts are pillarboxed) — object-cover crops it to
// the portrait card. There is no reliable static portrait thumbnail for a Short.
function thumb(v: BetaVideo): string {
  return `https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg`
}

function BetaCard({ video, onOpen }: { video: BetaVideo; onOpen: (v: BetaVideo) => void }) {
  const [broken, setBroken] = useState(false)
  if (broken) return null // deleted/removed video → drop the card rather than show a gray box

  const providerTag = video.provider === 'instagram' ? 'IG' : 'YT'
  const dur = fmtDur(video.duration_s)
  return (
    <button
      type="button"
      onClick={() => onOpen(video)}
      aria-label={`Beta by ${video.channel}${dur ? `, ${dur}` : ''}`}
      className="group relative aspect-[9/16] w-28 shrink-0 snap-start overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10"
    >
      <img
        src={thumb(video)}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className="absolute inset-0 size-full object-cover"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <Play className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 fill-white/90 text-white/90" />
      <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1 text-[9px] font-semibold uppercase leading-4 text-white/90">
        {providerTag}
      </span>
      {dur && (
        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-medium tabular-nums text-white">
          {dur}
        </span>
      )}
      <span className="absolute inset-x-1 bottom-1 truncate pr-8 text-left text-[11px] font-medium text-white">
        {video.channel}
      </span>
    </button>
  )
}

/**
 * The "Beta videos" section at the bottom of the problem drawer: a horizontal strip of
 * portrait clip cards (views-desc), tap → player sheet. Always renders, with four states —
 * loading (skeleton cards), has-videos (the strip), empty ("No beta videos yet"), and error
 * (a distinct "Try again"). Empty/error keep their own slot so a transient failure is
 * distinguishable from a genuinely video-less problem.
 */
export function BetaVideos({ sourceCatalogId }: { sourceCatalogId: string }) {
  const { status, videos } = useBetaVideos(sourceCatalogId)
  const [active, setActive] = useState<BetaVideo | null>(null)

  return (
    <section aria-label="Beta videos" className="space-y-1.5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Beta videos</h2>

      {status === 'loading' && (
        <div className="flex gap-3 overflow-hidden" aria-hidden>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[9/16] w-28 shrink-0 rounded-lg" />
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-3 py-1 text-sm text-muted-foreground">
          <span>Couldn’t load beta videos.</span>
          <Button variant="outline" size="sm" onClick={() => refetchBeta(sourceCatalogId)}>
            Try again
          </Button>
        </div>
      )}

      {status === 'ready' && videos.length === 0 && (
        <p className="py-1 text-sm text-muted-foreground">No beta videos yet.</p>
      )}

      {status === 'ready' && videos.length > 0 && (
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
          {videos.map((v) => (
            <BetaCard key={v.id} video={v} onOpen={setActive} />
          ))}
        </div>
      )}

      <BetaPlayerSheet video={active} onClose={() => setActive(null)} />
    </section>
  )
}
