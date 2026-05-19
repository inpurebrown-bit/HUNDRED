-- payrate_records: 결제율 현황 저장 (신규 생성)
CREATE TABLE IF NOT EXISTS payrate_records (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  record_date   date UNIQUE NOT NULL,
  year_month    text,
  employee_count      integer DEFAULT 0,
  target_count        numeric DEFAULT 0,
  payment_count       numeric DEFAULT 0,
  working_days_elapsed integer DEFAULT 0,
  total_working_days   integer DEFAULT 0,
  employee_details     jsonb DEFAULT '[]',
  updated_at    timestamptz DEFAULT now()
);

-- 기존 테이블의 컬럼 타입 수정 (integer → numeric, 0.5 단위 계약 가중치 저장용)
ALTER TABLE payrate_records
  ALTER COLUMN payment_count TYPE numeric USING payment_count::numeric,
  ALTER COLUMN target_count  TYPE numeric USING target_count::numeric;

-- pnl_records: 손익계산 저장 (신규 생성)
CREATE TABLE IF NOT EXISTS pnl_records (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  record_date     date UNIQUE NOT NULL,
  year_month      text,
  sales_employees jsonb DEFAULT '[]',
  ops_employees   jsonb DEFAULT '[]',
  other_costs     jsonb DEFAULT '{}',
  ceo_salary      numeric DEFAULT 0,
  updated_at      timestamptz DEFAULT now()
);
