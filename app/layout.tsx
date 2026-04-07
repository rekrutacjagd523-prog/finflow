import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/hooks/useAuth'
import { OrgProvider } from '@/lib/hooks/useOrg'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'cyrillic'],
})

export const metadata: Metadata = {
  title: 'FinFlow — Business Finance Manager',
  description: 'Track income, expenses, and cash flow for your business. 14-day free trial.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="uk" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0f0f0f]">
        <AuthProvider>
          <OrgProvider>
            {children}
            <Toaster />
          </OrgProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
