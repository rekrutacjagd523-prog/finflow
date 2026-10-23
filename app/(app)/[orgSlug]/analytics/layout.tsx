import type { ReactNode } from 'react'

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  // A route layout kept on purpose (the shell already provides <main> and the scroll container).
  return <>{children}</>
}
