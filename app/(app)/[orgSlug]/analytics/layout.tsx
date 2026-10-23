import type { ReactNode } from 'react'

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-full">{children}</div>
}
