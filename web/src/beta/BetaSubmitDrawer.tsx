// The "Add a beta" submission drawer (U5). A signed-in user pastes a YouTube link; we extract
// the video id client-side (youtubeUrl) and hand it to submitBeta, which inserts a PENDING row.
// The clip is invisible until an owner approves it, so on success we don't show a card — we fire
// a toast and let the caller record a local "pending review" note. Mirrors AddToListSheet's
// Drawer + form + synchronous re-entrancy lock + sonner error idiom. Sign-in gating and the
// pending note live in the caller (BetaVideos), same split as ProblemDetail/useAddToList.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { submitBeta } from './betaStore'
import { extractYouTubeId } from './youtubeUrl'

interface BetaSubmitDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceCatalogId: string
  /** Called with the extracted video id after a successful submit, so the caller can record the
   *  local "pending review" note. */
  onSubmitted: (videoId: string) => void
}

export function BetaSubmitDrawer({
  open,
  onOpenChange,
  sourceCatalogId,
  onSubmitted,
}: BetaSubmitDrawerProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Synchronous re-entrancy lock — the same-tick double-submit guard (fast double-Enter), like
  // AddToListSheet's creatingRef. The `submitting` state flips a render later.
  const submittingRef = useRef(false)

  // Reset the field + error each time the drawer opens, so a prior attempt never lingers.
  useEffect(() => {
    if (open) {
      setUrl('')
      setError(null)
    }
  }, [open])

  async function send(videoId: string) {
    if (submittingRef.current) return
    submittingRef.current = true
    try {
      await submitBeta(sourceCatalogId, videoId)
      onSubmitted(videoId)
      onOpenChange(false)
      toast.success("Submitted — it'll appear here once it's reviewed.")
    } catch (e) {
      toast.error("Couldn't add that beta.", {
        description: e instanceof Error ? e.message : undefined,
        action: { label: 'Retry', onClick: () => void send(videoId) },
      })
    } finally {
      submittingRef.current = false
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const videoId = extractYouTubeId(url)
    if (!videoId) {
      setError('Enter a YouTube video link (e.g. youtu.be/…).')
      return
    }
    void send(videoId)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent>
        <DrawerHeader className="pb-2">
          <DrawerTitle>Add a beta video</DrawerTitle>
          <DrawerDescription>
            Paste a YouTube link. New betas are reviewed before they appear.
          </DrawerDescription>
        </DrawerHeader>
        <form className="flex flex-col gap-2 border-t border-border px-3 py-3" onSubmit={handleSubmit}>
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                if (error) setError(null) // clear the error as the user edits
              }}
              placeholder="https://youtu.be/…"
              aria-label="YouTube video link"
              inputMode="url"
              autoFocus
            />
            <Button type="submit" disabled={url.trim().length === 0}>
              Submit
            </Button>
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </form>
      </DrawerContent>
    </Drawer>
  )
}
