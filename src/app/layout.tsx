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
  title: '헌드레드 지원센터',
  description: '정책자금 전문 컨설팅 기업',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '헌드레드',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': '헌드레드',
    'msapplication-TileColor': '#1e3a5f',
    'theme-color': '#1e3a5f',
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
