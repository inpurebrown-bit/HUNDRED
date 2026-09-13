import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const CHECKLIST_PROMPT = `
당신은 정책자금 컨설팅 TM 통화를 심사하는 수석 감독관입니다.
아래 녹취 파일을 처음부터 끝까지 듣고, JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력하세요.

━━━ 심사 철학 (중요) ━━━
영업 통화는 항상 스크립트대로만 흘러가지 않습니다. 대화가 샛길로 가다가 돌아오기도 하고,
같은 내용을 다른 표현으로 자연스럽게 녹여낼 수도 있습니다.
핵심은 "해당 항목의 목적이 달성됐는가"이지 "특정 멘트를 그대로 말했는가"가 아닙니다.
의심스러우면 통과 처리하세요. 진짜 문제(법 위반·위험 발언)만 엄격하게 잡으세요.

━━━ 체크리스트 9개 (너그럽게 판단) ━━━
1. identity_disclosed: 소속·이름 고지 — 통화 중 어느 시점에서든 회사명이나 이름이 언급됐으면 true
2. purpose_disclosed: 목적 고지 — "정책자금", "자금 안내", "상담" 등 대화 맥락상 목적이 전달됐으면 true
3. source_disclosed: 출처 고지 — "네이버", "홈페이지", "사업자 정보" 등 수집 경로가 어떤 식으로든 언급됐으면 true
4. needs_check: 니즈 확인 — 자금 필요 여부, 관심, 현재 상황 등을 직·간접적으로 확인했으면 true (직접 안 물어봐도 대화 흐름에서 파악됐으면 true)
5. basic_info: 기본 정보 수집 — 업력/매출/업종/연체/신용점수 중 2개 이상만 확인됐어도 true (대화 중 자연스럽게 나온 것 포함)
6. cancel_checked: 캔슬조건 — 거절 의사가 나왔을 때 적절히 대응했거나 깔끔하게 마무리했으면 true. 거절 없이 자연스럽게 진행됐으면 true
7. check_requirements: 체크요건 — 통화 희망 시간 또는 자금 필요 여부 중 하나라도 확인됐으면 true
8. closing_done: 클로징 — 다음 연락 예고, 마무리 인사, 재통화 약속 등 어떤 형태로든 마무리가 됐으면 true
9. phone_secured: 010 번호 — 010 번호를 확인하거나 이미 알고 있는 상태면 true

━━━ 타임라인 분석 ━━━
다음 유형만 기록하세요:
- "legal_violation": 실제 법적 문제 (소속/목적 전혀 안 밝히고 본론 진행, 개인정보 위반 등) — 확실한 경우만
- "risk": 위험 발언 (수익 보장, 허위 기관 사칭, 욕설, 협박 등) — 확실한 경우만
- "script_miss": 명확히 놓친 부분 (거절했는데 계속 통화, 번호 못 받고 끊김 등)
- "audio_issue": 심각한 음질 문제 (내용 파악 불가 구간)
- "good": 잘 된 부분 (자연스러운 정보 수집, 법적 고지 완료, 좋은 응대 등)

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

// POST: 녹취 파일 → Gemini 분석
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'dig' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
    }

    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: '파일이 너무 큽니다 (최대 50MB)' }, { status: 400 })
    }

    const ext = (file.name.split('.').pop() || 'mp3').toLowerCase()
    const mimeMap: Record<string, string> = {
      m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav',
      aac: 'audio/aac', ogg: 'audio/ogg', mp4: 'audio/mp4',
    }
    const mimeType = (file.type && file.type !== 'audio/x-m4a') ? file.type : (mimeMap[ext] || 'audio/mpeg')
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64,
          mimeType,
        },
      },
      CHECKLIST_PROMPT,
    ])

    const text = result.response.text().trim()

    // JSON 파싱 (```json ``` 감싸진 경우 처리)
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch ? jsonMatch[1] : text

    let analysis: any
    try {
      analysis = JSON.parse(jsonStr)
    } catch {
      analysis = { raw: text, parse_error: true }
    }

    return NextResponse.json({ analysis })
  } catch (error: any) {
    console.error('analyze-recording error:', error)
    return NextResponse.json({ error: '분석 실패: ' + error.message }, { status: 500 })
  }
}
