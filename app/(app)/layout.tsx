import { AuthProvider } from '@/lib/hooks/useAuth'
import { OrgProvider } from '@/lib/hooks/useOrg'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OrgProvider>
        <div className="min-h-screen bg-[#0f0f0f]">
          {children}
        </div>
      </OrgProvider>
    </AuthProvider>
  )
}
