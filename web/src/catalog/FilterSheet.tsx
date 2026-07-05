// Filter FAB + bottom sheet, iOS-style: a floating button (above the bottom nav)
// with an active-filter count badge opens a bottom sheet holding all the filter
// and sort controls. Search stays in the catalog top bar.

import { SlidersHorizontal } from 'lucide-react'
import { FilterControls } from './FilterControls'
import { activeFilterCount, type FilterState } from './filters'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

interface FilterSheetProps {
  state: FilterState
  onChange: (state: FilterState) => void
  gradeSpan: [number, number]
  methods: string[]
}

export function FilterSheet({ state, onChange, gradeSpan, methods }: FilterSheetProps) {
  const count = activeFilterCount(state)
  return (
    <Sheet>
      <SheetTrigger
        aria-label="Filters"
        className="fixed right-4 bottom-24 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:opacity-90"
      >
        <SlidersHorizontal className="size-6" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[0.7rem] font-semibold text-white">
            {count}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-8">
          <FilterControls state={state} onChange={onChange} gradeSpan={gradeSpan} methods={methods} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
