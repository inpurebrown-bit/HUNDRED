-- test1 업체명 테스트 데이터 완전 삭제
-- Supabase SQL Editor에서 실행하세요

-- 1. 삭제 전 확인
SELECT id, name, status,
       details->>'company' AS company,
       details->>'db010_month' AS db010_month,
       details->>'sales_user_name' AS sales_user,
       created_at
FROM customers
WHERE details->>'company' ILIKE '%test1%'
   OR name ILIKE '%test1%';

-- 2. 실제 삭제 (위 확인 후 주석 해제하여 실행)
-- DELETE FROM customers
-- WHERE details->>'company' ILIKE '%test1%'
--    OR name ILIKE '%test1%';
