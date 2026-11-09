import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export const CHECKLIST_PROMPT = `
당신은 정책자금 컨설팅 TM 통화를 심사하는 수석 감독관입니다.
아래 녹취 파일을 처음부터 끝까지 듣고, JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력하세요.

━━━ 심사 철학 (중요) ━━━
영업 통화는 항상 스크립트대로만 흘러가지 않습니다. 대화가 샛길로 가다가 돌아오기도 하고,
같은 내용을 다른 표현으로 자연스럽게 녹여낼 수도 있습니다.
핵심은 "해당 항목의 목적이 달성됐는가"이지 "특정 멘트를 그대로 말했는가"가 아닙니다.
의심스러우면 통과 처리하세요. 진짜 문제(법 위반·위험 발언)만 엄격하게 잡으세요.

━━━ 체크리스트 9개 ━━━
[★ 필수 항목] — 이 7개는 반드시 충족돼야 합니다. 충족 여부가 애매하면 false로 처리:
1. identity_disclosed ★: 소속 고지 — 통화 중 어느 시점이든 "헌드레드컨설팅"이라는 회사명(또는 "헌드레드"라고 소속)을 밝혔으면 true. 담당자 이름은 말하지 않았어도 true (이름 유무로 감점하지 말 것)
2. purpose_disclosed ★: 목적 고지 — "정책자금", "자금 안내", "상담" 등 목적이 명확히 전달됐으면 true
3. source_disclosed ★: 출처 고지 — "네이버", "홈페이지" 등 수집 경로가 어떤 식으로든 언급됐으면 true
4. basic_info ★: 기본 정보 수집 — 업력·연매출·업종·연체여부·신용점수·필요자금 중 3개 이상 실제로 확인. 고객이 답했는지가 기준 (질문만 했어도 답을 들었으면 true)
5. check_requirements ★: 실제 자금 필요 여부 확인 — "실제로 자금이 필요하신 건가요" 류 확인이 명확히 됐으면 true. 어물쩡 넘어갔으면 false
6. closing_done ★: 클로징 — 다음 컨설턴트 연락 예고 또는 재통화 약속이 명확히 됐으면 true. 흐지부지 끝났으면 false
7. phone_secured ★: 010 번호 확보 — 번호를 직접 확인하거나 이미 알고 있는 상태면 true

[일반 항목] — 맥락상 충족됐으면 너그럽게 판단:
8. needs_check: 니즈 확인 — 자금 필요성·관심을 직간접적으로 파악했으면 true
9. cancel_checked: 캔슬조건 처리 — 아래 기준으로 엄격하게 판단:
   - 고객이 처음 한 번 거절·망설임·"필요없다"·"바쁘다"를 표현했는데 자세한 이유·설명이 없었다면, 상담사가 한 번 더 부드럽게 권유하는 것은 정상(감점 금지)
   - 설명을 듣고도 고객이 재차 분명히 거절했는데 상담사가 무시하고 계속 진행 → false + script_miss 기록
   - 고객이 "그냥 들어보는 거지 뭐"·"호기심" 수준이면 대환/캐피탈 체크 후 진행은 허용
   - 거절 없이 자연스럽게 진행됐으면 true
   - ★ 중요: 어물쩡 넘기면서 콜을 따오는 패턴 (고객이 애매하게 거부했는데 상담사가 긍정으로 해석하고 진행) → false + risk 기록

━━━ 타임라인 분석 ━━━
다음 유형을 기록하세요:
- "legal_violation": 법적 고지 누락·위반 (소속/목적/출처 안 밝히고 본론 진행) — 확실한 경우만
- "risk": 위험 발언 (수익 보장, 허위 기관 사칭, 욕설, 거절 무시하고 강행) — 확실한 경우만
- "script_miss": 명확히 놓친 부분 (어물쩡 넘김, 실제 자금 확인 없이 클로징, 정보 건너뜀)
- "audio_issue": 심각한 음질 문제 (내용 파악 불가 구간)
- "good": 잘 된 부분 (법적 고지 완료, 자연스러운 정보 수집, 클로징 등)

━━━ 응답 JSON 형식 ━━━
{
  "checklist": {
    "identity_disclosed": true/false,
    "purpose_disclosed": true/false,
    "source_disclosed": true/false,
    "needs_check": true/false,
    "basic_info": true/false,
    "cancel_checked": true/false,
    "check_requirements": true/false,
    "closing_done": true/false,
    "phone_secured": true/false
  },
  "all_passed": true/false,
  "summary": "통화 내용 3-5문장 요약",
  "needs_level": "상 또는 중 또는 하",
  "customer_info": {
    "company": "업체명",
    "ceo_name": "대표자 성함",
    "phone_010": "확보한 010번호",
    "business_age": "업력",
    "annual_revenue": "연매출",
    "industry": "업종",
    "has_delinquency": true/false/null,
    "credit_score": "신용점수",
    "required_fund": "필요자금"
  },
  "timeline": [
    {
      "time": "00:12",
      "type": "legal_violation 또는 risk 또는 script_miss 또는 audio_issue 또는 good",
      "label": "한 줄 제목",
      "detail": "구체적 설명 1-2문장"
    }
  ],
  "overall_score": 0~100,
  "verdict": "통과 또는 재교육 필요 또는 즉시 면담 필요",
  "ceo_comment": "대표에게 보내는 한 줄 총평"
}

점수 및 판정 기준:
- overall_score: 체크리스트 통과율(70%) + 대화 품질·자연스러움(30%). 법적 위반 있으면 -30점
- 통과: 70점 이상이고 legal_violation·risk 없음
- 재교육 필요: 50~69점 또는 script_miss 다수
- 즉시 면담 필요: 50점 미만 또는 legal_violation·risk 있음
- 니즈: 상=적극 관심·협조, 중=관심 있으나 불확실, 하=관심 낮음
`

const MIME: Record<string, string> = { m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg', mp4: 'audio/mp4' }
export const mimeFromName = (name: string) => MIME[((name || '').split('?')[0].split('.').pop() || 'mp3').toLowerCase()] || 'audio/mpeg'

/** 유효한 분석인지 (체크리스트·니즈가 있고 파싱 오류가 아님) */
export const isValidAnalysis = (a: any) => !!a && !a.parse_error && !!a.checklist && !!a.needs_level

/** 녹취 base64 → 분석 JSON. AI 서버 일시 오류·형식 오류는 최대 3번 다시 시도한다 (parse_error 로 끝나면 유효하지 않은 결과 반환) */
export async function analyzeAudio(base64: string, mimeType: string): Promise<any> {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })
  let last: any = null
  let lastErr: any = null
  for (let t = 0; t < 3; t++) {
    try {
      const result = await model.generateContent([
        { inlineData: { data: base64, mimeType } },
        CHECKLIST_PROMPT + '\n\n반드시 순수 JSON만 출력하세요. ```json 마크다운 없이, 중괄호로 시작하고 중괄호로 끝내세요.',
      ])
      const text = result.response.text().trim()
      let analysis: any = null
      const attempts = [
        text,
        (() => { const m = text.match(/```json\n?([\s\S]*?)\n?```/); return m?.[1] })(),
        (() => { const m = text.match(/(\{[\s\S]*\})/); return m?.[1] })(),
      ]
      for (const c of attempts) { if (!c) continue; try { analysis = JSON.parse(c); break } catch { /* next */ } }
      if (analysis && isValidAnalysis(analysis)) return analysis
      last = analysis || { parse_error: true, raw_snippet: text.slice(0, 300) }
      console.error(`analyzeAudio attempt ${t + 1}: invalid result`)
    } catch (e: any) {
      lastErr = e
      console.error(`analyzeAudio attempt ${t + 1} failed:`, e?.message)
    }
    if (t < 2) await new Promise(r => setTimeout(r, 2000 * (t + 1)))
  }
  if (last) return last
  throw lastErr || new Error('AI 응답 없음')
}

/** 저장된 녹취 URL → 분석 (접수·재분석 때 서버가 직접 사용). 실패하면 null */
export async function analyzeRecordingUrl(url: string, filename?: string): Promise<any | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const a = await analyzeAudio(buf.toString('base64'), mimeFromName(filename || url))
    return isValidAnalysis(a) ? a : null
  } catch (e: any) {
    console.error('analyzeRecordingUrl failed:', e?.message)
    return null
  }
}
