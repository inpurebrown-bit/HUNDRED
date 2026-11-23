import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { agentGuard } from '@/lib/agentAuth'

// 주황이 전용: 작업 대기열 조회. GET /api/agent/jobs?status=requested (기본 requested)
export async function GET(req: NextRequest) {
  const g = agentGuard(req); if (g) return g
  const status = new URL(req.url).searchParams.get('status') || 'requested'
  const { data, error } = await supabaseAdmin.from('agent_jobs')
    .select('id, kind, status, case_id, company, room, requested_by, created_at, updated_at')
    .eq('status', status).not('case_id', 'in', '(cmd,cmd-hb)').order('created_at', { ascending: true }).limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data || [] })
}
