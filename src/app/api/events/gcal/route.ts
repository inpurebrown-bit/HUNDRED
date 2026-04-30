import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// Google Calendar 공개 캘린더 동기화 (API Key 방식)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { calendar_id, api_key } = await req.json()
  if (!calendar_id || !api_key) {
    return NextResponse.json({ error: 'calendar_id와 api_key가 필요합니다' }, { status: 400 })
  }

  // 현재 달 ± 3개월 범위
  const now = new Date()
  const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString()

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar_id)}/events?key=${api_key}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100`

  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json()
    return NextResponse.json({
      error: `Google Calendar 오류: ${err.error?.message || '접근 실패'}`,
      detail: err.error,
    }, { status: 400 })
  }

  const gcalData = await res.json()
  const items = gcalData.items || []

  // 기존 구글 캘린더 이벤트 삭제 후 재삽입
  await supabaseAdmin.from('events').delete().eq('source', 'google')

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
        color: 'green',
        is_allday: isAllDay,
        source: 'google',
        gcal_id: item.id,
        created_by: 'Google Calendar',
      }
    })

    await supabaseAdmin.from('events').insert(toInsert)
  }

  return NextResponse.json({ synced: items.length })
}
