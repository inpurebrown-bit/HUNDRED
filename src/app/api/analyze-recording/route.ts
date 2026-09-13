import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const CHECKLIST_PROMPT = `
당신은 정책자금 컨설팅 영업 통화를 심사하는 수석 감독관입니다.
아래 녹취 파일을 처음부터 끝까지 꼼꼼히 듣고, 다음 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력하세요.

━━━ 체크리스트 9개 항목 ━━━
1. identity_disclosed: 소속 고지 (회사명·이름 밝혔는지)
2. purpose_disclosed: 목적 고지 (정책자금 무료 상담 안내라고 밝혔는지)
3. source_disclosed: 출처 고지 (네이버 등 수집경로 밝혔는지)
4. needs_check: 니즈 확인 (정책자금 필요성·관심 확인했는지)
5. basic_info: 기본 정보 수집 (업력/연매출/업종/연체·체납/신용점수 중 3개 이상)
6. cancel_checked: 캔슬조건 처리 (거절 1회에 즉시 종료 or 호기심 케이스 대환/캐피탈 체크)
7. check_requirements: 체크요건 (통화 희망 시간대 + 실제 자금 필요 여부 확인)
8. closing_done: 클로징 멘트 (내일 전문 컨설턴트 안내 예고)
9. phone_secured: 010 번호 확보

━━━ 타임라인 분석 지침 ━━━
통화 전체를 들으면서 다음 유형의 이벤트를 모두 기록하세요:
- "legal_violation": 법적 고지 누락 또는 위반 발언 (소속/목적/출처 고지 없이 진행, 개인정보 언급 등)
- "risk": 법적 위험 발언 (확정적 수익 보장, 허위 정보 제공, 욕설/비하, 허위 기관 사칭 등)
- "script_miss": 스크립트 미준수 (캔슬조건 미처리, 클로징 없이 종료, 정보수집 건너뜀 등)
- "audio_issue": 음질 문제 (잡음 심함, 상담사 목소리 끊김, 내용 불명확 구간)
- "good": 잘 된 부분 (법적 고지 완료, 자연스러운 정보 수집, 깔끔한 클로징 등)

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
  "summary": "통화 내용 3-5문장 요약 (법적 고지 여부 포함)",
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
      "label": "한 줄 제목 (예: 소속 고지 완료, 캔슬조건 미처리)",
      "detail": "구체적 설명 — 실제로 한 말이나 놓친 행동을 인용하거나 묘사 (1-2문장)"
    }
  ],
  "overall_score": 0~100,
  "verdict": "통과 또는 재교육 필요 또는 즉시 면담 필요",
  "ceo_comment": "대표에게 보내는 한 줄 총평"
}

타임라인 작성 규칙:
- time은 반드시 실제 오디오 타임스탬프 (mm:ss 형식)
- 이벤트가 없으면 빈 배열 []
- good 이벤트도 반드시 포함 (잘 한 것도 기록)
- 법적 위반(legal_violation)·위험 발언(risk)은 하나도 빠짐없이 기록

니즈 수준: 상=적극적 관심·협조적, 중=관심 있으나 불확실, 하=관심 낮음·정보수집 어려움
overall_score: 9개 항목 통과율 + 법적 고지 가중치 + 스크립트 준수도 종합
verdict: 85점 이상=통과, 60-84=재교육 필요, 59 이하=즉시 면담 필요
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
