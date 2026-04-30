import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// GET: 회의록 목록
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('minutes')
    .select('*')
    .order('meeting_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ minutes: data })
}

// POST: 텍스트 붙여넣기 → AI 정리 → 저장
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { raw_text, meeting_date } = await req.json()
  if (!raw_text) return NextResponse.json({ error: '텍스트가 없습니다' }, { status: 400 })

  const date = meeting_date || new Date().toISOString().slice(0, 10)

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite-preview',
      systemInstruction: `당신은 헌드레드 지원센터의 회의록 정리 전문가입니다.
클로바노트에서 추출된 회의 텍스트를 아래 형식으로 깔끔하게 정리하세요.
반드시 아래 JSON 형식으로만 응답하고 다른 텍스트는 포함하지 마세요.

{
  "title": "회의 제목 (내용 기반으로 자동 추출)",
  "attendees": ["참석자1", "참석자2"],
  "summary": "전체 회의 내용 요약 (3~5줄)",
  "key_points": ["핵심 논의사항1", "핵심 논의사항2"],
  "decisions": ["결정사항1", "결정사항2"],
  "actions": [{"person": "담당자", "task": "할 일", "deadline": "기한(있으면)"}],
  "sales_report": "영업 관련 언급된 내용 (없으면 null)",
  "revenue_report": "매출 관련 언급된 내용 (없으면 null)"
}`,
    })

    const result = await model.generateContent(raw_text)
    const text = result.response.text()

    // JSON 파싱
    let parsed: any = {}
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
    } catch {
      parsed = { summary: text, key_points: [], decisions: [], actions: [] }
    }

    // upsert (같은 날짜면 덮어쓰기)
    const { data, error } = await supabaseAdmin
      .from('minutes')
      .upsert({
        meeting_date: date,
        raw_text,
        summary: parsed,
        created_by: user.name,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'meeting_date' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ minute: data, parsed }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: '정리 실패: ' + error.message }, { status: 500 })
  }
}
