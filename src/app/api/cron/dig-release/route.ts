import { NextResponse } from 'next/server'
import { releaseDue } from '@/lib/digAssign'
import { supabaseAdmin } from '@/lib/supabase'
import { playableUrl } from '@/lib/recordingConvert'

export const maxDuration = 60

// 매일 아침 예약된 발굴팀 배정을 영업 공급DB로 넣는다 (vercel.json crons). 시각이 된 것만 처리하므로 누가 불러도 안전하다.
// 덤으로, 접수 때 변환이 안 돼 wav 로 남은 녹취가 있으면 mp3 로 바꿔 둔다 (브라우저에서 재생 가능하게).
export async function GET() {
  const n = await releaseDue()
  let converted = 0
  try {
    const { data } = await supabaseAdmin.from('dig_prospects').select('id, recording_url, recording_analysis').ilike('recording_url', '%.wav%').limit(5)
    for (const p of data || []) {
      const url = await playableUrl(p.recording_url, 'cron:sweep')
      const ra: any = p.recording_analysis
      const nextRa = ra && Array.isArray(ra.recordings)
        ? { ...ra, recordings: await Promise.all(ra.recordings.map(async (r: any) => ({ ...r, url: await playableUrl(r?.url, 'cron:sweep') }))) }
        : ra
      if (url !== p.recording_url) {
        await supabaseAdmin.from('dig_prospects').update({ recording_url: url, recording_analysis: nextRa }).eq('id', p.id)
        converted++
      }
    }
  } catch { /* 정리 실패는 배정에 영향 없음 */ }
  return NextResponse.json({ released: n, converted })
}
