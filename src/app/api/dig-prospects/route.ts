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
  if (user.role !== 'dig' && user.role !== 'ceo' && user.role !== 'sales') {
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
  } else if (user.role === 'sales') {
    // 영업팀: 본인에게 배정된 건만
    query = query.eq('assigned_to', user.id).eq('status', 'assigned')
  }

  if (user.role !== 'sales' && status && status !== 'all') {
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
    const cl = (recording_analysis.checklist || {}) as Record<string, boolean>
    const ci = (recording_analysis.customer_info || {}) as Record<string, any>

    const CHECKLIST_KO: Record<string, string> = {
      identity_disclosed: '소속 고지', purpose_disclosed: '목적 고지', source_disclosed: '출처 고지',
      needs_check: '니즈 확인', basic_info: '기본정보', cancel_checked: '캔슬조건',
      check_requirements: '체크요건(자금확인)', closing_done: '클로징', phone_secured: '010 확보',
    }

    // ★ 필수 7개 항목 — 하나라도 빠지면 자동 승인 불가
    const MANDATORY = ['identity_disclosed', 'purpose_disclosed', 'source_disclosed',
                       'basic_info', 'check_requirements', 'closing_done', 'phone_secured']
    const mandatoryFailed = MANDATORY.filter(k => !cl[k]).map(k => CHECKLIST_KO[k] || k)

    // 위험 이벤트 감지
    const dangerItems = timeline.filter((t: any) => t.type === 'legal_violation' || t.type === 'risk')
    const hasDanger = dangerItems.length > 0

    // 정보 불일치 감지 (녹취 추출값 vs 직원 입력값)
    const mismatches: string[] = []
    const normalize = (v: any) => String(v || '').replace(/[,\s억원만]/g, '').trim().toLowerCase()
    if (ci.annual_revenue && annual_revenue) {
      const a = normalize(ci.annual_revenue), b = normalize(annual_revenue)
      if (a && b && !a.includes(b) && !b.includes(a)) mismatches.push(`연매출: 녹취 "${ci.annual_revenue}" vs 입력 "${annual_revenue}"`)
    }
    if (ci.required_fund && required_fund) {
      const a = normalize(ci.required_fund), b = normalize(required_fund)
      if (a && b && !a.includes(b) && !b.includes(a)) mismatches.push(`필요자금: 녹취 "${ci.required_fund}" vs 입력 "${required_fund}"`)
    }
    if (ci.business_age && business_age) {
      const a = normalize(ci.business_age), b = normalize(business_age)
      if (a && b && !a.includes(b) && !b.includes(a)) mismatches.push(`업력: 녹취 "${ci.business_age}" vs 입력 "${business_age}"`)
    }

    const missingItems = Object.entries(cl).filter(([, v]) => !v).map(([k]) => CHECKLIST_KO[k] || k)
    const passed = Object.values(cl).filter(Boolean).length
    const total = Object.keys(CHECKLIST_KO).length

    // 판정 로직
    const extraWarnings = [
      ...(mismatches.length > 0 ? [`⚠️ 정보 불일치: ${mismatches.join(' / ')}`] : []),
      ...(ceoSummary ? [ceoSummary] : []),
    ]

    if (hasDanger) {
      autoStatus = 'pending'
      const dangerDesc = dangerItems.map((d: any) => `${d.time} ${d.label}`).join(' / ')
      autoComment = `🚨 위험 감지 — 직접 들어보세요\n${dangerDesc}${extraWarnings.length ? '\n' + extraWarnings.join('\n') : ''}`
    } else if (mandatoryFailed.length > 0) {
      // 필수 항목 미충족 → 자동 승인 불가
      autoStatus = 'pending'
      autoComment = `필수 항목 미충족 — ${mandatoryFailed.join(', ')}${mismatches.length ? '\n⚠️ ' + mismatches.join(' / ') : ''}${ceoSummary ? '\n' + ceoSummary : ''}`
    } else if (mismatches.length > 0) {
      // 필수는 통과했지만 정보 불일치 → 대표 확인
      autoStatus = 'pending'
      autoComment = `⚠️ 정보 불일치 확인 필요\n${mismatches.join('\n')}${ceoSummary ? '\n' + ceoSummary : ''}`
    } else if (verdict === '통과' || score >= 70) {
      autoStatus = 'approved'
      autoComment = `자동 승인 (${score}점)${ceoSummary ? ' — ' + ceoSummary : ''}`
    } else if (verdict === '즉시 면담 필요' || score < 50) {
      autoStatus = 'pending'
      autoComment = `🚨 즉시 면담 필요 (${score}점) — 직접 들어보세요${missingItems.length > 0 ? '\n미흡: ' + missingItems.join(', ') : ''}${ceoSummary ? '\n' + ceoSummary : ''}`
    } else {
      autoStatus = 'pending'
      autoComment = `재교육 필요 (${score}점)${missingItems.length > 0 ? ' — 미흡: ' + missingItems.join(', ') : ''}${ceoSummary ? '\n' + ceoSummary : ''}`
    }

    // 구버전 호환
    if (!verdict && !score && passed >= Math.ceil(total * 0.67) && mandatoryFailed.length === 0) {
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
