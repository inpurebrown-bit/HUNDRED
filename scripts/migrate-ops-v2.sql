-- ops_cases 테이블 신규 컬럼 추가
ALTER TABLE ops_cases
  ADD COLUMN IF NOT EXISTS timeline        JSONB    DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS institution_login JSONB  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS paid_date       DATE,
  ADD COLUMN IF NOT EXISTS contract_fee    BIGINT   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_fee        BIGINT   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unpaid_fee      BIGINT   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method  TEXT     DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_absorbed     BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sojin_confirm1  BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sojin_confirm2  BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sojin_confirm3  BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS required_checks TEXT     DEFAULT '',
  ADD COLUMN IF NOT EXISTS fund_solution   TEXT     DEFAULT '',
  ADD COLUMN IF NOT EXISTS concurrent_institutions JSONB DEFAULT '[]';

-- institution_type에 미소, 대안없이핸들링 추가 (enum 제약 없으므로 그냥 허용)
-- stage 제약 제거 (이미 제거됐을 수 있음)
ALTER TABLE ops_cases DROP CONSTRAINT IF EXISTS ops_cases_stage_check;
