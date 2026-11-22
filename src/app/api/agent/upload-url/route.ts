import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { agentGuard } from '@/lib/agentAuth'

const BUCKET = 'consulting-docs'

// 주황이 전용: 파일 올릴 주소 발급. body { case_id, filename, doc_type }  (doc_type: 고객서류 분류 키, 또는 결과물이면 job 종류 키)
// 받은 signedUrl 로 파일을 PUT 한 뒤 /api/agent/register 로 CRM 에 등록한다. (큰 PDF 도 올릴 수 있게 직접 업로드 방식)
export async function POST(req: NextRequest) {
  const g = agentGuard(req); if (g) return g
  const { case_id, filename, doc_type } = await req.json().catch(() => ({}))
  if (!case_id || !filename || !doc_type) return NextResponse.json({ error: 'case_id, filename, doc_type 필요' }, { status: 400 })
  await supabaseAdmin.storage.createBucket(BUCKET, { public: false }).catch(() => {})
  const ext = (String(filename).split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `cases/${case_id}/${String(doc_type).replace(/[^a-z0-9_]/gi, '')}_${Date.now()}.${ext}`
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ path, token: data.token, signedUrl: data.signedUrl })
}
