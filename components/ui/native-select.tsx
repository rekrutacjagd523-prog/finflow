// FinFlow (S01A): a native <select> dressed like the Input/Select fields (height, radius, border,
// focus ring, the same chevron as SelectTrigger). Behaviour, keyboard and the `combobox` role stay
// the browser's own, so it is a drop-in for plain selects (same API, props go to the <select>).
import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function NativeSelect({
  className,
  wrapperClassName,
  ...props
}: React.ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <span data-slot="native-select-wrapper" className={cn("relative inline-flex", wrapperClassName)}>
      <select
        data-slot="native-select"
        className={cn(
          "h-9 w-full min-w-0 appearance-none rounded-control border border-input bg-surface py-1 pr-9 pl-3 text-sm text-ink transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  )
}

export { NativeSelect }
