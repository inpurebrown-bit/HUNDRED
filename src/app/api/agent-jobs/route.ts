import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { AGENT_KIND_KEYS } from '@/lib/agentKinds'

// 주황이 작업 대기열 — 관리팀 인콜카드의 '주황이 지시' 탭이 사용 (관리팀·대표만)
//  카톡방 이름은 받지 않는다. 주황이가 대표 이름·사업체명으로 방을 찾아 내용을 확인하고 고른다.
//  CRM 에서 누른 요청은 확인창을 거친 것이라 auto_send: 만들면 승인 없이 바로 보낸다.
export const AGENT_KINDS = AGENT_KIND_KEYS
const ACTIVE = ['requested', 'drafting', 'draft_ready', 'approved', 'sending']

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session) return { err: NextResponse.json({ error: '인증 필요' }, { status: 401 }) }
  const user = session.user as any
  if (!['ops', 'ceo'].includes(user.role)) return { err: NextResponse.json({ error: '권한 없음' }, { status: 403 }) }
  return { user }
}
const noTable = (m?: string) => /agent_jobs|does not exist|schema cache/i.test(m || '')
const TABLE_HINT = 'agent_jobs 테이블이 아직 없습니다. scripts/create-agent-jobs.sql 을 Supabase SQL Editor에서 한 번 실행해 주세요.'

// GET ?case_id=… : 그 업체의 최근 작업 목록
export async function GET(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err
  const caseId = new URL(req.url).searchParams.get('case_id')
  if (!caseId) return NextResponse.json({ error: 'case_id 필요' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('agent_jobs')
    .select('id, kind, status, room, requested_by, error, draft, created_at, updated_at')
    .eq('case_id', caseId).order('created_at', { ascending: false }).limit(60)
  if (error) return NextResponse.json({ error: noTable(error.message) ? TABLE_HINT : error.message, needSetup: noTable(error.message) }, { status: 500 })
  return NextResponse.json({ jobs: data || [] })
}

// POST { kind | kinds[], case_id, company } : 작성·발송 요청 등록 (확인창을 거친 요청 → 바로 보냄)
export async function POST(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err
  const body = await req.json().catch(() => ({}))
  const kinds: string[] = Array.isArray(body.kinds) ? body.kinds : body.kind ? [body.kind] : []
  const { case_id, company } = body
  if (!case_id) return NextResponse.json({ error: 'case_id 필요' }, { status: 400 })
  if (!kinds.length || kinds.some(k => !AGENT_KINDS.includes(k))) return NextResponse.json({ error: '알 수 없는 작업 종류' }, { status: 400 })

  const dup = await supabaseAdmin.from('agent_jobs').select('kind').eq('case_id', case_id).in('kind', kinds).in('status', ACTIVE)
  if (dup.error) return NextResponse.json({ error: noTable(dup.error.message) ? TABLE_HINT : dup.error.message, needSetup: noTable(dup.error.message) }, { status: 500 })
  const busy = new Set((dup.data || []).map(r => r.kind))
  const todo = kinds.filter(k => !busy.has(k))
  if (!todo.length) return NextResponse.json({ error: '이미 진행 중인 같은 작업이 있습니다' }, { status: 409 })

  const rows = todo.map(kind => ({ kind, case_id, company: company || '', room: '', requested_by: g.user.name || '', draft: { auto_send: true, source: 'crm' } }))
  const { data, error } = await supabaseAdmin.from('agent_jobs').insert(rows).select('id, kind, status, created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data, skipped: kinds.filter(k => busy.has(k)) }, { status: 201 })
}

// PATCH { id, action: 'cancel' | 'approve' } : 취소 / 검토 후 승인(자동 발송이 아닌 옛 요청용)
export async function PATCH(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err
  const { id, action } = await req.json()
  if (!id || !['cancel', 'approve'].includes(action)) return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  const { data: job } = await supabaseAdmin.from('agent_jobs').select('status').eq('id', id).single()
  if (!job) return NextResponse.json({ error: '작업 없음' }, { status: 404 })
  if (action === 'cancel') {
    if (!['requested', 'drafting', 'draft_ready', 'approved'].includes(job.status)) return NextResponse.json({ error: '이미 전송 중이거나 끝난 작업입니다' }, { status: 409 })
  } else if (job.status !== 'draft_ready') {
    return NextResponse.json({ error: '검토 대기 상태에서만 승인할 수 있습니다' }, { status: 409 })
  }
  const status = action === 'cancel' ? 'canceled' : 'approved'
  const { error } = await supabaseAdmin.from('agent_jobs').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, status })
}
