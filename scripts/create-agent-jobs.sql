-- 주황(카톡 자동화) 작업 대기열
-- Supabase → SQL Editor 에서 한 번 실행하세요. (이미 있으면 건너뜁니다)
create table if not exists agent_jobs (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null,                 -- consulting | bizplan | roadmap | script_kibo | script_jaedan | script_shinbo | finance | status
  case_id       text not null,                 -- ops_cases.id
  company       text,                          -- 표시용 업체명
  room          text,                          -- 보낼 카톡방 이름
  status        text not null default 'requested',
                                               -- requested(작성 요청) → drafting(작성 중) → draft_ready(검토 대기)
                                               -- → approved(승인) → sending(전송 중) → sent(전송 완료) / failed / canceled
  requested_by  text,
  draft         jsonb,                         -- 작성된 내용(제목, 본문, 파일 경로 등)
  result        jsonb,                         -- 전송 결과
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists agent_jobs_case_idx   on agent_jobs (case_id, created_at desc);
create index if not exists agent_jobs_status_idx on agent_jobs (status, created_at);
alter table agent_jobs enable row level security;   -- 서버(서비스 키)로만 접근
