import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// 관리팀·대표가 '주황이 지시' 탭에서 만들어진 자료를 열 때 쓰는 임시 다운로드 주소 발급 (10분)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  if (!['ops', 'ceo'].includes((session.user as any).role)) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const path = sp.get('path') || '', caseId = sp.get('case_id') || ''
  // 내려받을 때 저장되는 파일 이름(없으면 저장소 경로의 임시 이름 diag_1795….pdf 가 그대로 나온다)
  const name = String(sp.get('name') || '').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 120)
  if (!caseId || !path.startsWith(`cases/${caseId}/`) || path.includes('..')) return NextResponse.json({ error: 'path 가 올바르지 않습니다' }, { status: 400 })
  const s = await supabaseAdmin.storage.from('consulting-docs').createSignedUrl(path, 600, name ? { download: name } : undefined)
  if (s.error) return NextResponse.json({ error: s.error.message }, { status: 500 })
  return NextResponse.json({ url: s.data.signedUrl })
}
