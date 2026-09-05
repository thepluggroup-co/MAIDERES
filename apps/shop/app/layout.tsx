import { Inter, Poppins, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/react'
import { Providers } from './providers'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { siteMetadata } from './metadata'
import './globals.css'

const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-inter',
  display:  'swap',
  preload:  true,
})

const poppins = Poppins({
  subsets:  ['latin'],
  weight:   ['600', '700'],
  variable: '--font-poppins',
  display:  'swap',
  preload:  true,
})

const jetbrainsMono = JetBrains_Mono({
  subsets:  ['latin'],
  variable: '--font-jetbrains-mono',
  display:  'swap',
  preload:  false,
})

export const metadata = siteMetadata

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${inter.variable} ${poppins.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[#FAF8F5] font-sans text-brand-ink antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster position="top-right" richColors closeButton />
          <Analytics />
        </Providers>
      </body>
    </html>
  )
}
