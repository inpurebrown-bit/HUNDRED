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

━━━ 체크리스트 9개 ━━━
[★ 필수 항목] — 이 7개는 반드시 충족돼야 합니다. 충족 여부가 애매하면 false로 처리:
1. identity_disclosed ★: 소속·이름 고지 — 통화 중 어느 시점이든 회사명+이름이 명확히 언급됐으면 true
2. purpose_disclosed ★: 목적 고지 — "정책자금", "자금 안내", "상담" 등 목적이 명확히 전달됐으면 true
3. source_disclosed ★: 출처 고지 — "네이버", "홈페이지" 등 수집 경로가 어떤 식으로든 언급됐으면 true
4. basic_info ★: 기본 정보 수집 — 업력·연매출·업종·연체여부·신용점수·필요자금 중 3개 이상 실제로 확인. 고객이 답했는지가 기준 (질문만 했어도 답을 들었으면 true)
5. check_requirements ★: 실제 자금 필요 여부 확인 — "실제로 자금이 필요하신 건가요" 류 확인이 명확히 됐으면 true. 어물쩡 넘어갔으면 false
6. closing_done ★: 클로징 — 다음 컨설턴트 연락 예고 또는 재통화 약속이 명확히 됐으면 true. 흐지부지 끝났으면 false
7. phone_secured ★: 010 번호 확보 — 번호를 직접 확인하거나 이미 알고 있는 상태면 true

[일반 항목] — 맥락상 충족됐으면 너그럽게 판단:
8. needs_check: 니즈 확인 — 자금 필요성·관심을 직간접적으로 파악했으면 true
9. cancel_checked: 캔슬조건 처리 — 아래 기준으로 엄격하게 판단:
   - 고객이 거절·망설임·"필요없다"·"바쁘다"를 표현했는데 상담사가 무시하고 계속 진행 → false + script_miss 기록
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

    // JSON 강제 출력 모드 사용
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' } as any,
    })

    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      CHECKLIST_PROMPT,
    ])

    const text = result.response.text().trim()

    // JSON 파싱 — 여러 패턴 시도
    let analysis: any = null
    const attempts = [
      text,
      (() => { const m = text.match(/```json\n?([\s\S]*?)\n?```/); return m?.[1] })(),
      (() => { const m = text.match(/(\{[\s\S]*\})/); return m?.[1] })(),
    ]
    for (const candidate of attempts) {
      if (!candidate) continue
      try { analysis = JSON.parse(candidate); break } catch { /* try next */ }
    }

    // 파싱 완전 실패 시 부분 복구 시도
    if (!analysis) {
      // checklist만이라도 추출
      const clMatch = text.match(/"checklist"\s*:\s*(\{[^}]+\})/)
      const partialCl: Record<string, boolean> = {}
      if (clMatch) {
        const keys = ['identity_disclosed','purpose_disclosed','source_disclosed','needs_check',
                      'basic_info','cancel_checked','check_requirements','closing_done','phone_secured']
        for (const k of keys) {
          const m = clMatch[1].match(new RegExp(`"${k}"\\s*:\\s*(true|false)`))
          if (m) partialCl[k] = m[1] === 'true'
        }
      }
      analysis = {
        parse_error: true,
        raw_snippet: text.slice(0, 300),
        checklist: Object.keys(partialCl).length > 0 ? partialCl : undefined,
      }
      console.error('analyze-recording: JSON parse failed. Raw:', text.slice(0, 500))
    }

    return NextResponse.json({ analysis })
  } catch (error: any) {
    console.error('analyze-recording error:', error)
    return NextResponse.json({ error: '분석 실패: ' + error.message }, { status: 500 })
  }
}
