-- ops99 테스트 계정 생성
-- Supabase SQL Editor에서 실행하세요
-- 비밀번호: 0000

INSERT INTO users (name, username, password_hash, role)
VALUES (
  'ops-tester',
  'ops99',
  '$2b$10$lbhh7aybxQb2Mjgcz9VewuSQTGKwJ3q.YUW44MExmwEtNb0xrHKsq',
  'ops'
)
ON CONFLICT (username) DO NOTHING;

-- 확인
SELECT id, name, username, role FROM users WHERE username = 'ops99';
