import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// POST: 홈페이지 문의 신청 (공개 — 인증 불필요)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, company, region, message, taxStatus, inquiryTypes } = body

    if (!name || !phone) {
      return NextResponse.json({ error: '이름과 연락처는 필수입니다' }, { status: 400 })
    }

    const notes = [
      message,
      inquiryTypes?.length ? `문의유형: ${inquiryTypes.join(', ')}` : '',
      taxStatus && taxStatus !== '없음' ? `세금체납: ${taxStatus}` : '',
    ].filter(Boolean).join('\n')

    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert({
        name: name.trim(),
        phone: phone.trim(),
        status: 'active',
        source: 'lead_form',
        memo: notes,
        details: {
          sub_status: 'lead',
          company: (company || '').trim(),
          region: (region || '').trim(),
          tax_status: taxStatus || '없음',
          inquiry_types: inquiryTypes || [],
          db_source: '홈페이지문의',
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
