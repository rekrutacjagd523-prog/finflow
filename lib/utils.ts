import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// FinFlow tokens from app/globals.css (S01A). tailwind-merge only knows Tailwind's default
// scales, so it must be told that `rounded-control` replaces `rounded-lg` and `shadow-pop`
// replaces `shadow-md`; otherwise both classes survive and CSS order decides.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["control", "field", "panel"],
      shadow: ["panel", "pop"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
