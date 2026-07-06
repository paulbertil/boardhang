// The filter/sort controls shown inside the filter bottom sheet (search lives in
// the catalog top bar). Controlled: the parent owns FilterState and passes the
// slab's grade span + available methods. Built on shadcn Select/Slider/Toggle.
//
// The "Holds" row opens HoldFilterPicker — a full-board picker that writes the
// tapped positions into state.holdsFilter (applyFilters matches problems that
// use all selected holds).

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { CatalogBoardDef } from '../board/boards'
import { FONT_GRADES } from '../board/grades'
import { HoldFilterPicker } from './HoldFilterPicker'
import {
  SORT_LABELS,
  hasActiveFilters,
  resetFilters,
  sortDimension,
  type FilterState,
  type SortKey,
} from './filters'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Toggle } from '@/components/ui/toggle'

const SORT_KEYS: SortKey[] = ['easiest', 'hardest', 'rated', 'repeats']
const RATING_LABELS: Record<string, string> = {
  '0': 'Any rating',
  '1': '1★ and up',
  '2': '2★ and up',
  '3': '3★ and up',
  '4': '4★ and up',
  '5': '5★ and up',
}

interface FilterControlsProps {
  state: FilterState
  onChange: (state: FilterState) => void
  /** The active board — supplies geometry + hold-set membership for the picker. */
  board: CatalogBoardDef
  /** The slab's actual grade span as ordinal [min, max]. */
  gradeSpan: [number, number]
  /** Distinct method labels present in the slab. */
  methods: string[]
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

export function FilterControls({ state, onChange, board, gradeSpan, methods }: FilterControlsProps) {
  const set = (patch: Partial<FilterState>) => onChange({ ...state, ...patch })
  const [holdPickerOpen, setHoldPickerOpen] = useState(false)
  const range = state.gradeRange ?? gradeSpan
  const secondaryOptions = SORT_KEYS.filter(
    (k) => sortDimension(k) !== sortDimension(state.sortPrimary),
  )
  const secondaryItems: Record<string, string> = {
    none: 'No tiebreak',
    ...Object.fromEntries(secondaryOptions.map((k) => [k, SORT_LABELS[k]])),
  }

  function changePrimary(primary: SortKey) {
    const keep = state.sortSecondary && sortDimension(state.sortSecondary) !== sortDimension(primary)
    set({ sortPrimary: primary, sortSecondary: keep ? state.sortSecondary : null })
  }

  return (
    <div className="space-y-4">
      <Field label="Sort">
        <div className="flex gap-2">
          <Select items={SORT_LABELS} value={state.sortPrimary} onValueChange={(v) => changePrimary(v as SortKey)}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_KEYS.map((k) => (
                <SelectItem key={k} value={k}>
                  {SORT_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={secondaryItems}
            value={state.sortSecondary ?? 'none'}
            onValueChange={(v) => set({ sortSecondary: v === 'none' ? null : (v as SortKey) })}
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No tiebreak</SelectItem>
              {secondaryOptions.map((k) => (
                <SelectItem key={k} value={k}>
                  {SORT_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Field>

      <Field label={`Grade · ${FONT_GRADES[range[0]]} – ${FONT_GRADES[range[1]]}`}>
        <Slider
          aria-label="Grade range"
          min={gradeSpan[0]}
          max={gradeSpan[1]}
          step={1}
          value={[range[0], range[1]]}
          onValueChange={(value) => {
            const [lo, hi] = value as number[]
            set({ gradeRange: lo === gradeSpan[0] && hi === gradeSpan[1] ? null : [lo, hi] })
          }}
        />
      </Field>

      <Field label="Holds">
        <button
          type="button"
          onClick={() => setHoldPickerOpen(true)}
          className="flex w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm transition hover:bg-accent"
        >
          <span className={state.holdsFilter.length === 0 ? 'text-muted-foreground' : ''}>
            {state.holdsFilter.length === 0 ? 'Any' : `${state.holdsFilter.length} selected`}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Toggle variant="outline" size="sm" pressed={state.benchmarkOnly} onPressedChange={(v) => set({ benchmarkOnly: v })}>
          Benchmarks
        </Toggle>
        <Toggle variant="outline" size="sm" pressed={state.favoritesOnly} onPressedChange={(v) => set({ favoritesOnly: v })}>
          Favorites
        </Toggle>
        <Select items={RATING_LABELS} value={String(state.minStars)} onValueChange={(v) => set({ minStars: Number(v) })}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RATING_LABELS).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {methods.length > 0 && (
        <Field label="Method">
          <div className="flex flex-wrap gap-1.5">
            {methods.map((m) => (
              <Toggle
                key={m}
                variant="outline"
                size="sm"
                pressed={state.methods.includes(m)}
                onPressedChange={(active) =>
                  set({ methods: active ? [...state.methods, m] : state.methods.filter((x) => x !== m) })
                }
              >
                {m}
              </Toggle>
            ))}
          </div>
        </Field>
      )}

      {hasActiveFilters(state) && (
        <Button variant="ghost" size="sm" onClick={() => onChange(resetFilters(state))}>
          Reset filters
        </Button>
      )}

      <HoldFilterPicker
        board={board}
        open={holdPickerOpen}
        onOpenChange={setHoldPickerOpen}
        value={state.holdsFilter}
        onChange={(holdsFilter) => set({ holdsFilter })}
      />
    </div>
  )
}
