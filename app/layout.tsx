import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
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

const ALLOWED_DOMAIN = '@nellisauction.com'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  if (!pathname.startsWith('/unauthorized')) {
    const user = await currentUser()
    if (user) {
      const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      if (primary && !primary.emailAddress.endsWith(ALLOWED_DOMAIN)) {
        redirect('/unauthorized')
      }
    }
  }

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
