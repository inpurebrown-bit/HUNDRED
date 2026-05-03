import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Geist, Noto_Serif_KR, Nanum_Brush_Script } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

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
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="ko" className={`${geist.variable} ${notoSerifKR.variable} ${nanumBrush.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
