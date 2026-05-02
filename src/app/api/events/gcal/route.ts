import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// Google Calendar 동기화 — 여러 캘린더 지원
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { calendars, api_key } = await req.json()
  // calendars: [{ id: string, color: string, label: string }]
  if (!calendars || !api_key) {
    return NextResponse.json({ error: 'calendars와 api_key가 필요합니다' }, { status: 400 })
  }

  const now = new Date()
  const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const timeMax = new Date(now.getFullYear(), now.getMonth() + 4, 0).toISOString()

  // 기존 구글 이벤트 전체 삭제
  await supabaseAdmin.from('events').delete().eq('source', 'google')

  let totalSynced = 0
  const errors: string[] = []

  for (const cal of calendars) {
    if (!cal.id) continue
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?key=${api_key}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=200`

    const res = await fetch(url)
    if (!res.ok) {
      const err = await res.json()
      errors.push(`${cal.label || cal.id}: ${err.error?.message || '접근 실패'}`)
      continue
    }

    const data = await res.json()
    const items = data.items || []

    if (items.length > 0) {
      const toInsert = items.map((item: any) => {
        const isAllDay = !!item.start?.date
        return {
          title: item.summary || '(제목 없음)',
          start_date: item.start?.date || item.start?.dateTime?.slice(0, 10),
          end_date: item.end?.date
            ? new Date(new Date(item.end.date).getTime() - 86400000).toISOString().slice(0, 10)
            : item.end?.dateTime?.slice(0, 10),
          start_time: isAllDay ? null : item.start?.dateTime?.slice(11, 16),
          end_time: isAllDay ? null : item.end?.dateTime?.slice(11, 16),
          description: item.description || '',
          color: cal.color || 'green',
          is_allday: isAllDay,
          source: 'google',
          gcal_id: item.id,
          gcal_label: cal.label || '',
          created_by: cal.label || 'Google Calendar',
        }
      })
      // gcal_label 컬럼이 없을 경우 대비: 먼저 시도하고 실패하면 컬럼 없이 재시도
      const { error: insertErr } = await supabaseAdmin.from('events').insert(toInsert)
      if (insertErr) {
        if (insertErr.message?.includes('gcal_label')) {
          // gcal_label 컬럼 없음 → 해당 필드 제외하고 재삽입
          const fallback = toInsert.map(({ gcal_label: _gl, ...rest }: { gcal_label: string; [key: string]: unknown }) => rest)
          await supabaseAdmin.from('events').insert(fallback)
        } else {
          errors.push(`${cal.label || cal.id}: ${insertErr.message}`)
          continue
        }
      }
      totalSynced += items.length
    }
  }

  return NextResponse.json({
    synced: totalSynced,
    errors: errors.length > 0 ? errors : undefined,
  })
}
