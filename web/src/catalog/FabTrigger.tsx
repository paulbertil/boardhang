// The round floating action button shared by the catalog FAB column
// (RecentsSheet, FilterSheet). Renders a Drawer trigger styled as a FAB; callers
// supply the icon — and any overlay like the filter count badge — as children.
// `relative` is set here so a caller's absolutely-positioned badge anchors to it.

import type { ComponentProps } from 'react'
import { DrawerTrigger } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'

export function FabTrigger({ className, children, ...props }: ComponentProps<typeof DrawerTrigger>) {
  return (
    <DrawerTrigger
      className={cn(
        'pointer-events-auto relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:opacity-90',
        className,
      )}
      {...props}
    >
      {children}
    </DrawerTrigger>
  )
}
