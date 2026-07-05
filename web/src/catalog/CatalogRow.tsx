// A single catalog problem row: name, benchmark/favorite badges, star rating,
// repeat count, method, setter (or hold count), a trailing grade pill, and an
// optional board thumbnail. Mirrors iOS CatalogListView's row. Clickable — opens
// the detail pager (U11).

import { BadgeCheck, Heart, Repeat, Star } from 'lucide-react'
import type { CatalogBoardDef } from '../board/boards'
import { CatalogBoard } from '../board/CatalogBoard'
import type { CatalogProblem } from './catalogSync'
import { Badge } from '@/components/ui/badge'

interface CatalogRowProps {
  problem: CatalogProblem
  board: CatalogBoardDef
  isFavorite?: boolean
  /** Show the board thumbnail (iOS "climb previews" toggle). */
  showThumbnail?: boolean
  onSelect?: (problem: CatalogProblem) => void
}

export function CatalogRow({
  problem,
  board,
  isFavorite = false,
  showThumbnail = false,
  onSelect,
}: CatalogRowProps) {
  const subtitle = problem.setter ? `by ${problem.setter}` : `${problem.holds.length} holds`
  return (
    <button
      type="button"
      onClick={() => onSelect?.(problem)}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent"
    >
      {showThumbnail && (
        <div className="w-14 shrink-0">
          <CatalogBoard board={board} holds={problem.holds} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium uppercase">{problem.name}</span>
          {problem.is_benchmark && (
            <BadgeCheck className="size-4 shrink-0 text-amber-500" aria-label="Benchmark" />
          )}
          {isFavorite && (
            <Heart className="size-4 shrink-0 fill-pink-500 text-pink-500" aria-label="Favorite" />
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {problem.stars > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Star className="size-3.5" /> {problem.stars}
            </span>
          )}
          {problem.repeats > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Repeat className="size-3.5" /> {problem.repeats}
            </span>
          )}
          {problem.method && <span className="text-indigo-400">{problem.method}</span>}
        </div>
        <div className="truncate text-sm text-muted-foreground">{subtitle}</div>
      </div>
      <Badge variant="secondary" className="shrink-0">
        {problem.grade}
      </Badge>
    </button>
  )
}
