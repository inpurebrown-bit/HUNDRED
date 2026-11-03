import { NextResponse } from 'next/server'
import { releaseDue } from '@/lib/digAssign'

// 매일 아침 예약된 발굴팀 배정을 영업 공급DB로 넣는다 (vercel.json crons). 시각이 된 것만 처리하므로 누가 불러도 안전하다.
export async function GET() {
  const n = await releaseDue()
  return NextResponse.json({ released: n })
}
