import type { Metadata } from 'next'
import { Unbounded, Manrope } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import './globals.css'
import { AuthProvider } from '@/lib/hooks/useAuth'
import { OrgProvider } from '@/lib/hooks/useOrg'
import { Toaster } from '@/components/ui/sonner'

const unbounded = Unbounded({
  variable: '--font-display',
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
})

const manrope = Manrope({
  variable: '--font-body',
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
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
    <html lang="uk" className={`${unbounded.variable} ${manrope.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            <OrgProvider>
              {children}
              <Toaster />
            </OrgProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
