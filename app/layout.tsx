import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import { Navbar } from '@/components/layout/Navbar'
import { Providers } from '@/app/providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: {
    default: 'MeetOPS',
    template: '%s | MeetOPS',
  },
  description: 'Operations management suite — staffing, UPH tracking, cycle time, and coaching',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body className="min-h-screen bg-background antialiased">
          <Navbar />
          <Providers>
            <main className="container mx-auto px-4 py-6 max-w-screen-2xl">
              {children}
            </main>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
