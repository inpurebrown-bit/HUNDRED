-- ============================================================
-- 2026년 5월 결제율 현황 초기값 시드
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 오늘 날짜(2026-05-19) 레코드의 employee_details에서
-- 김윤지, 손제후 각각의 공급결제/직접수/직접결제 초기값 설정
UPDATE payrate_records
SET
  employee_details = (
    SELECT jsonb_agg(
      CASE
        WHEN emp->>'name' = '김윤지' THEN
          emp
          || '{"supply_payment": 1.5}'::jsonb
          || '{"direct_count": 20}'::jsonb
          || '{"direct_payment": 0}'::jsonb
        WHEN emp->>'name' = '손제후' THEN
          emp
          || '{"supply_payment": 5}'::jsonb
          || '{"direct_count": 14}'::jsonb
          || '{"direct_payment": 0}'::jsonb
        ELSE emp
      END
    )
    FROM jsonb_array_elements(employee_details) AS emp
  ),
  updated_at = now()
WHERE record_date = '2026-05-19';

-- 결과 확인
SELECT record_date, employee_details FROM payrate_records
WHERE record_date = '2026-05-19';
