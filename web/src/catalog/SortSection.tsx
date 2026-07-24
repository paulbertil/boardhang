// The Sort control at the top of the filter sheet, written as an inline "sentence":
// "Sort by ⟨primary⟩ then ⟨secondary⟩", each ⟨…⟩ a dropdown. The tiebreak reads as
// secondary (muted). The sort facet's pin is anchored top-right, centred on the first
// line (the min-h-8 box) so it stays put when the phrase wraps on narrow screens.
import { SORT_LABELS, type SortKey } from './filters'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// Display order for the sort options (mirrors FilterControls' SORT_KEYS).
const SORT_KEYS: SortKey[] = ['easiest', 'hardest', 'rated', 'repeats']

const labelCls = 'text-xs font-medium text-muted-foreground'

export interface SortSectionProps {
  primary: SortKey
  secondary: SortKey | null
  onChangePrimary: (k: SortKey) => void
  onChangeSecondary: (k: SortKey | null) => void
  /** Sort keys allowed as a tiebreak (primary's dimension excluded). */
  secondaryOptions: SortKey[]
  /** Label map for the secondary select, incl. the "none" entry. */
  secondaryItems: Record<string, string>
  /** The facet pin toggle for the sort control (pin('sort')). */
  pin: React.ReactNode
}

export function SortSection({
  primary,
  secondary,
  onChangePrimary,
  onChangeSecondary,
  secondaryOptions,
  secondaryItems,
  pin,
}: SortSectionProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-x-1.5 gap-y-2">
        <span className={labelCls}>Sort by</span>
        <Select items={SORT_LABELS} value={primary} onValueChange={(v) => onChangePrimary(v as SortKey)}>
          <SelectTrigger className="w-fit">
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
        <span className={cn(labelCls, 'text-muted-foreground/70')}>then</span>
        <Select
          items={secondaryItems}
          value={secondary ?? 'none'}
          onValueChange={(v) => onChangeSecondary(v === 'none' ? null : (v as SortKey))}
        >
          <SelectTrigger className="w-fit text-muted-foreground">
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
      {/* Centred on the first line so it never strands onto its own row when wrapping. */}
      <span className="flex min-h-8 shrink-0 items-center">{pin}</span>
    </div>
  )
}
