import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// 공통 동기화 로직
async function syncCalendars(calendars: { id: string; color: string; label: string }[], api_key: string) {
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
        // Google Calendar 종일 이벤트의 end_date는 exclusive (다음날) → 하루 빼기
        // UTC 변환 없이 날짜 문자열 직접 처리
        let endDate: string
        if (item.end?.date) {
          // 종일 이벤트: "2026-05-18" 형태, exclusive → -1일
          const [y, m, d] = item.end.date.split('-').map(Number)
          const dt = new Date(y, m - 1, d - 1)  // 로컬 날짜 연산
          endDate = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
        } else {
          // 시간 지정 이벤트: dateTime에서 날짜 부분만
          endDate = item.end?.dateTime?.slice(0, 10) || item.start?.dateTime?.slice(0, 10) || ''
        }
        return {
          title: item.summary || '(제목 없음)',
          start_date: item.start?.date || item.start?.dateTime?.slice(0, 10),
          end_date: endDate,
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
      const { error: insertErr } = await supabaseAdmin.from('events').insert(toInsert)
      if (insertErr) {
        if (insertErr.message?.includes('gcal_label')) {
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

  return { synced: totalSynced, errors }
}

// GET: 저장된 설정으로 자동 동기화 (페이지 로드 시 자동 호출)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  // 저장된 구글 캘린더 설정 읽기
  const { data } = await supabaseAdmin.from('settings').select('*').eq('key', 'gcal').single()
  if (!data?.value?.api_key || !data?.value?.calendars?.length) {
    return NextResponse.json({ synced: 0, message: '구글 캘린더 미설정' })
  }

  const { api_key, calendars } = data.value
  const result = await syncCalendars(calendars, api_key)

  return NextResponse.json({ synced: result.synced, errors: result.errors.length > 0 ? result.errors : undefined })
}

// POST: 수동 동기화 (설정 저장 후 동기화 버튼)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { calendars, api_key } = await req.json()
  if (!calendars || !api_key) {
    return NextResponse.json({ error: 'calendars와 api_key가 필요합니다' }, { status: 400 })
  }

  const result = await syncCalendars(calendars, api_key)

  return NextResponse.json({
    synced: result.synced,
    errors: result.errors.length > 0 ? result.errors : undefined,
  })
}
