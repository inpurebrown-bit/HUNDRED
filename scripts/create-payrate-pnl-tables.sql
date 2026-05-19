-- payrate_records: 결제율 현황 저장
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

-- pnl_records: 손익계산 저장
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
