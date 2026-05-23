import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { headers } from 'next/headers'
import { Inter } from 'next/font/google'
import { Navbar } from '@/components/layout/Navbar'
import { Providers } from '@/app/providers'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: {
    default: 'MeetOPS',
    template: '%s | MeetOPS',
  },
  description: 'Operations management suite — staffing, UPH tracking, cycle time, and coaching',
}

// Routes that render full-screen with no navbar or page padding
const FULLSCREEN_ROUTES = ['/sign-in', '/sign-up', '/unauthorized']

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  const isFullscreen = FULLSCREEN_ROUTES.some((r) => pathname.startsWith(r))

  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable} suppressHydrationWarning>
        <body className="min-h-screen bg-background antialiased">
          {/* Prevent flash of wrong theme — runs before first paint */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var s=localStorage.getItem('meetops-theme');var d=document.documentElement;if(s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){d.classList.add('dark')}})()`,
            }}
          />
          <ThemeProvider>
            {isFullscreen ? (
              <Providers>{children}</Providers>
            ) : (
              <>
                <Navbar />
                <Providers>
                  <main className="container mx-auto px-4 py-6 max-w-screen-2xl">
                    {children}
                  </main>
                </Providers>
              </>
            )}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
