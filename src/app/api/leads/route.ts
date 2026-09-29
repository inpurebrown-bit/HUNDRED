import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { LEGAL_VERSION } from '@/lib/companyInfo'

// POST: 홈페이지 문의 신청 (공개 — 인증 불필요)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, company, region, message, taxStatus, inquiryTypes, consent, website } = body

    // 봇 방지: 숨김 필드가 채워져 있으면 저장하지 않고 성공처럼 응답
    if (website) return NextResponse.json({ ok: true }, { status: 201 })

    if (!name || !phone) {
      return NextResponse.json({ error: '이름과 연락처는 필수입니다' }, { status: 400 })
    }
    if (!consent?.collect || !consent?.third) {
      return NextResponse.json({ error: '필수 약관(개인정보 수집·이용, 제3자 제공)에 동의해 주세요' }, { status: 400 })
    }
    const digits = String(phone).replace(/[^0-9]/g, '')
    if (digits.length < 9 || digits.length > 11) {
      return NextResponse.json({ error: '연락처 형식을 확인해 주세요' }, { status: 400 })
    }

    const notes = [
      String(message || '').slice(0, 2000),
      Array.isArray(inquiryTypes) && inquiryTypes.length ? `문의유형: ${inquiryTypes.join(', ')}` : '',
      taxStatus && taxStatus !== '없음' ? `세금체납: ${taxStatus}` : '',
    ].filter(Boolean).join('\n')

    // owner_id NOT NULL 제약 → 대표 계정을 임시 owner로 지정 (리드폼 배정 전 상태)
    const CEO_USER_ID = '46db4a3e-dc4d-4082-9756-1a892a41c0bb'

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || ''

    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert({
        name: String(name).trim().slice(0, 60),
        phone: String(phone).trim().slice(0, 30),
        status: 'active',          // DB 컬럼은 'active'|'contracted'만 허용
        source: 'lead',            // DB CHECK 제약: 'self'|'lead'만 허용
        owner_id: CEO_USER_ID,
        memo: notes,
        details: {
          sub_status: 'lead',      // normalizeCustomer가 이걸 status로 변환
          company: String(company || '').trim().slice(0, 100),
          region: String(region || '').trim(),
          tax_status: taxStatus || '없음',
          inquiry_types: Array.isArray(inquiryTypes) ? inquiryTypes : [],
          db_source: '홈페이지문의',
          consent: {
            collect: true,
            third_party: true,
            marketing: !!consent.marketing,
            agreed_at: new Date().toISOString(),
            version: LEGAL_VERSION,
            ip,
            user_agent: (req.headers.get('user-agent') || '').slice(0, 300),
          },
        },
      })
      .select()
      .single()

    if (error) {
      console.error('[leads POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
