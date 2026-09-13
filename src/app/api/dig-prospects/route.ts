import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: 목록 조회
// - dig: 본인 것만
// - ceo: 전체 (status 필터 가능)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'dig' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // pending | approved | rejected | assigned | all

  let query = supabaseAdmin
    .from('dig_prospects')
    .select('*')
    .order('created_at', { ascending: false })

  if (user.role === 'dig') {
    query = query.eq('dig_user_id', user.id)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ prospects: data || [] })
}

// POST: 신규 가망 등록 (dig 팀만)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'dig') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await req.json()
  const {
    company, ceo_name, phone, phone_010,
    business_age, annual_revenue, industry,
    has_delinquency, credit_score, required_fund, preferred_call_time,
    urgent_assign,
    checklist, memo,
    recording_url, recording_filename, recording_analysis,
  } = body

  if (!phone_010) {
    return NextResponse.json({ error: '010 번호는 필수입니다' }, { status: 400 })
  }

  // AI 분석 결과로 자동 승인 여부 결정
  // verdict=통과 → 자동 승인 / 위험 감지 → 대표에게 플래그
  let autoStatus = 'pending'
  let autoComment: string | null = null
  if (recording_analysis && !recording_analysis.parse_error) {
    const verdict: string = recording_analysis.verdict || ''
    const score: number = recording_analysis.overall_score ?? 0
    const timeline: any[] = recording_analysis.timeline || []
    const ceoSummary: string = recording_analysis.ceo_comment || ''

    // 위험 이벤트 감지
    const dangerItems = timeline.filter((t: any) => t.type === 'legal_violation' || t.type === 'risk')
    const hasDanger = dangerItems.length > 0

    // 체크리스트 미흡 항목
    const CHECKLIST_KO: Record<string, string> = {
      identity_disclosed: '소속 고지', purpose_disclosed: '목적 고지', source_disclosed: '출처 고지',
      needs_check: '니즈 확인', basic_info: '기본정보', cancel_checked: '캔슬조건',
      check_requirements: '체크요건', closing_done: '클로징', phone_secured: '010 확보',
    }
    const cl = (recording_analysis.checklist || {}) as Record<string, boolean>
    const passed = Object.values(cl).filter(Boolean).length
    const total = Object.keys(CHECKLIST_KO).length
    const missingItems = Object.entries(cl).filter(([, v]) => !v).map(([k]) => CHECKLIST_KO[k] || k)

    if (hasDanger) {
      // 위험 발언 감지 → 대표 직접 확인 요청
      autoStatus = 'pending'
      const dangerDesc = dangerItems.map((d: any) => `${d.time} ${d.label}`).join(' / ')
      autoComment = `🚨 위험 감지 — 직접 들어보세요\n${dangerDesc}${ceoSummary ? '\n' + ceoSummary : ''}`
    } else if (verdict === '통과' || score >= 70) {
      // 인콜 잘 땄음 → 자동 승인
      autoStatus = 'approved'
      autoComment = `자동 승인 (${score}점)${ceoSummary ? ' — ' + ceoSummary : ''}`
    } else if (verdict === '즉시 면담 필요' || score < 50) {
      // 심각한 문제 → 대표 직접 확인
      autoStatus = 'pending'
      autoComment = `🚨 즉시 면담 필요 (${score}점) — 직접 들어보세요${missingItems.length > 0 ? '\n미흡: ' + missingItems.join(', ') : ''}${ceoSummary ? '\n' + ceoSummary : ''}`
    } else {
      // 50-69점 재교육 구간 → 대표 검토
      autoStatus = 'pending'
      autoComment = `재교육 필요 (${score}점)${missingItems.length > 0 ? ' — 미흡: ' + missingItems.join(', ') : ''}${ceoSummary ? '\n' + ceoSummary : ''}`
    }

    // 구버전 녹취 호환 (verdict/score 없는 경우)
    if (!verdict && !score && passed >= Math.ceil(total * 0.67)) {
      autoStatus = 'approved'
      autoComment = `자동 승인 (${passed}/${total} 통과)`
    }
  }

  const { data, error } = await supabaseAdmin
    .from('dig_prospects')
    .insert({
      dig_user_id: user.id,
      dig_user_name: user.name,
      company, ceo_name, phone, phone_010,
      business_age, annual_revenue, industry,
      has_delinquency: !!has_delinquency,
      credit_score, required_fund, preferred_call_time,
      urgent_assign: !!urgent_assign,
      checklist: checklist || {},
      memo,
      recording_url, recording_filename,
      recording_analysis: recording_analysis || null,
      status: autoStatus,
      ceo_comment: autoComment,
      ...(autoStatus === 'approved' ? { approved_at: new Date().toISOString() } : {}),
      call_date: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ prospect: data, auto_approved: autoStatus === 'approved' })
}
