-- soft-delete 버그 수정: status='trash'인데 sub_status가 trash가 아닌 레코드 일괄 수정
-- Supabase SQL Editor에서 실행하세요

UPDATE customers
SET
  status = 'active',
  details = jsonb_set(
    COALESCE(details, '{}'::jsonb),
    '{sub_status}',
    '"trash"'
  )
WHERE status = 'trash';

-- 확인
SELECT id, status, details->>'sub_status' as sub_status
FROM customers
WHERE status = 'trash' OR details->>'sub_status' = 'trash'
LIMIT 20;
