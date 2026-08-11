import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/migrate/dig-table — dig_prospects 테이블 생성
export async function POST() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role !== 'ceo') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 테이블 존재 여부 확인
  const { error: checkErr } = await supabaseAdmin
    .from('dig_prospects')
    .select('id')
    .limit(1)

  if (!checkErr) {
    return NextResponse.json({ message: '이미 존재합니다' })
  }

  // rpc로 SQL 실행 (Supabase에 exec_sql 함수 필요)
  const sql = `
    CREATE TABLE IF NOT EXISTS dig_prospects (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      dig_user_id TEXT NOT NULL,
      dig_user_name TEXT,
      company TEXT,
      ceo_name TEXT,
      phone TEXT,
      phone_010 TEXT,
      business_age TEXT,
      annual_revenue TEXT,
      industry TEXT,
      has_delinquency BOOLEAN DEFAULT FALSE,
      credit_score TEXT,
      required_fund TEXT,
      checklist JSONB DEFAULT '{}',
      memo TEXT,
      recording_url TEXT,
      recording_filename TEXT,
      recording_analysis JSONB,
      status TEXT DEFAULT 'pending',
      ceo_comment TEXT,
      assigned_to TEXT,
      assigned_to_name TEXT,
      customer_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      approved_at TIMESTAMPTZ,
      assigned_at TIMESTAMPTZ,
      call_date DATE DEFAULT CURRENT_DATE
    );
    CREATE INDEX IF NOT EXISTS dig_prospects_status_idx ON dig_prospects(status);
    CREATE INDEX IF NOT EXISTS dig_prospects_dig_user_id_idx ON dig_prospects(dig_user_id);
    CREATE INDEX IF NOT EXISTS dig_prospects_call_date_idx ON dig_prospects(call_date);
  `

  const { error } = await supabaseAdmin.rpc('exec_sql', { sql })
  if (error) {
    return NextResponse.json({ error: error.message, hint: 'Supabase에서 exec_sql 함수를 직접 만들어야 할 수 있습니다' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
