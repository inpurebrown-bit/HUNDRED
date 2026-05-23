import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Geist, Noto_Serif_KR, Nanum_Brush_Script } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import PushNotificationManager from '@/components/PushNotificationManager'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const notoSerifKR = Noto_Serif_KR({
  variable: '--font-noto-serif-kr',
  subsets: ['latin'],
  weight: ['400', '700', '900'],
})

const nanumBrush = Nanum_Brush_Script({
  variable: '--font-nanum-brush',
  subsets: ['latin'],
  weight: '400',
})

export const metadata: Metadata = {
  title: 'Hundred Consulting',
  description: '정책자금 전문 컨설팅 기업',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Hundred Consulting',
    description: '정책자금 전문 컨설팅 기업',
    images: [
      {
        url: 'https://hundred-beryl.vercel.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Hundred Consultancy',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hundred Consulting',
    description: '정책자금 전문 컨설팅 기업',
    images: ['https://hundred-beryl.vercel.app/og-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Hundred Consulting',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Hundred Consulting',
    'msapplication-TileColor': '#0D1B2E',
    'theme-color': '#0D1B2E',
  },
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="ko" className={`${geist.variable} ${notoSerifKR.variable} ${nanumBrush.variable} h-full antialiased`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-full">
        <Providers>
          <PushNotificationManager />
          {children}
        </Providers>
      </body>
    </html>
  )
}
