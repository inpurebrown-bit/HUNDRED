# Push Notification Cron 설정 가이드

## 공통 설정

- **Base URL**: `https://hundred-git-main-inpurebrown-bits-projects.vercel.app`
- **Custom Header (모든 요청 공통)**: `x-cron-secret: <NEXTAUTH_SECRET 값>`

---

## cron-job.org 작업 목록

| 알림 | 대상 | 시간 (KST) | URL |
|-----|-----|-----|-----|
| 재정 현황 순이익 | 대표 | 매일 10:00 | `GET /api/push/cron?target=ceo&title=📊 오전 재정현황&body=오늘 순이익 현황을 확인해주세요.&url=/dashboard` |
| 공급 목표 알림 | 대표 | 매일 11:00 | `GET /api/push/cron?target=ceo&title=📦 공급 목표 점검&body=오늘 공급 목표 달성 현황을 확인하세요.&url=/dashboard` |
| 3사 보고 리마인드 | 대표 | 매일 13:30 | `GET /api/push/cron?target=ceo&title=📊 3사 보고 시간&body=영업팀 계약 순위 및 결제율을 확인하세요.&url=/dashboard` |
| 목표 대비 현황 | 영업팀 | 매일 10:00 | `GET /api/push/cron?target=sales&title=🎯 오전 목표 점검&body=오늘 목표 대비 현황을 확인하세요.&url=/dashboard` |
| 오전보고 알림 | 영업팀 | 매일 11:50 | `GET /api/push/cron?target=sales&title=☀️ 오전보고 시간&body=오전보고를 제출해주세요!&url=/dashboard` |
| 오전보고 독촉(1차) | 영업팀 | 매일 12:50 | `GET /api/push/check-reports?type=morning` |
| 마감보고 알림 | 영업팀 | 매일 17:50 | `GET /api/push/cron?target=sales&title=📋 마감보고 시간&body=마감보고를 제출해주세요!&url=/dashboard` |
| 마감보고 독촉(1차) | 영업팀 | 매일 18:50 | `GET /api/push/check-reports?type=daily` |
| 마감보고 독촉(2차) | 영업팀 | 매일 19:50 | `GET /api/push/check-reports?type=daily` |
| 흡수 미처리 알림 | 관리팀 | 매일 10:00 | `GET /api/push/cron?target=ops&title=📥 흡수 확인 필요&body=흡수 처리가 필요한 업체를 확인해주세요.&url=/dashboard` |
| 마감보고 알림 | 관리팀 | 매일 17:50 | `GET /api/push/cron?target=ops&title=📋 마감보고 시간&body=마감보고를 제출해주세요!&url=/dashboard` |
| 마감보고 독촉(1차) | 관리팀 | 매일 18:50 | `GET /api/push/check-reports?type=daily` |
| 오늘의 명언 | 전 직원 | 매일 09:50 | `GET /api/push/daily-quote` |

---

## cron-job.org 설정 방법

1. [https://cron-job.org](https://cron-job.org) 로그인 후 새 Cron Job 생성
2. **URL**: 위 표의 URL을 Base URL과 합쳐서 입력  
   예) `https://hundred-git-main-inpurebrown-bits-projects.vercel.app/api/push/cron?target=ceo&title=📊 오전 재정현황&body=오늘 순이익 현황을 확인해주세요.&url=/dashboard`
3. **HTTP Method**: GET
4. **Custom Headers** (모든 job 공통):
   ```
   x-cron-secret: <NEXTAUTH_SECRET 값>
   ```
5. **Timezone**: Asia/Seoul (KST)
6. **Schedule**: 표에 명시된 시간으로 설정

---

## 이벤트 기반 알림 (자동 동작, cron 설정 불필요)

| 이벤트 | 대상 | 알림 제목 |
|--------|------|-----------|
| 계약 완료 (`status → contracted`) | 대표 | ✅ 계약 완료 |
| 심사 요청 (`inspection_status → pending`) | 대표 | 🔍 심사 요청 |
| A/S 요청 (`as_requested → true`) | 대표 | 🔧 A/S 요청 |
| 보고 제출 (신규 INSERT) | 대표 | 📋 보고 제출 |
| 자금 승인 (`progress_stage → 승인`) | 대표 | 🎉 자금 승인 |
| 공지사항 등록/수정 | 영업팀+관리팀 | 📢 공지사항 |
