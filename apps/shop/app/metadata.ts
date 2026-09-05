import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maideres.vercel.app'

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: [{ url: '/maideres-icon.svg', type: 'image/svg+xml' }],
    shortcut: '/maideres-icon.svg',
  },
  title: {
    default: 'MAIDERES — Mise en relation de prestataires de services',
    template: '%s | MAIDERES',
  },
  description:
    'MAIDERES connecte vos besoins du quotidien (coiffure, taxi, onglerie, et plus) avec des prestataires de confiance à Douala.',
  keywords: [
    'services douala',
    'prestataires cameroun',
    'marketplace services douala',
  ],
  authors: [{ name: 'MAIDERES', url: SITE_URL }],
  creator: 'MAIDERES',
  openGraph: {
    type:      'website',
    locale:    'fr_CM',
    url:       SITE_URL,
    siteName:  'MAIDERES',
    title:     'MAIDERES — Mise en relation de prestataires de services',
    description:
      'MAIDERES connecte vos besoins du quotidien avec des prestataires de confiance à Douala.',
    images: [
      {
        url:    '/og-image.jpg',
        width:  1200,
        height: 630,
        alt:    'MAIDERES',
      },
    ],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'MAIDERES — Mise en relation de prestataires de services',
    description: 'MAIDERES connecte vos besoins du quotidien avec des prestataires de confiance à Douala.',
    images:      ['/og-image.jpg'],
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index:            true,
    follow:           true,
    googleBot: {
      index:               true,
      follow:              true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet':       -1,
    },
  },
}
