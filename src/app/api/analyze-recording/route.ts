import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const CHECKLIST_PROMPT = `
당신은 정책자금 컨설팅 영업 통화를 분석하는 전문가입니다 (개인정보보호법·정보통신망법 준수 여부 포함).
아래 녹취 내용을 분석해서 다음 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.

분석 항목 (9개):
1. identity_disclosed: 소속 고지 여부 (발신자가 "헌드레드컨설팅" 또는 회사명과 이름을 밝혔는지)
2. purpose_disclosed: 목적 고지 여부 (정책자금 무료 상담 안내 목적을 밝혔는지)
3. source_disclosed: 출처 고지 여부 (연락처 수집 경로 — 네이버 플레이스 등 — 를 밝혔는지)
4. needs_check: 정책자금 니즈 확인 여부 (고객이 정책자금 필요성/관심을 표현했거나 확인 질문했는지)
5. basic_info: 기본 정보 수집 여부 (업력/연매출/업종/연체체납/신용점수 중 3개 이상 확인)
6. cancel_checked: 캔슬조건 확인 여부 (거절 의사 표명 시 즉시 종료했는지, 또는 단순 호기심 케이스에서 대환/캐피탈 여부를 체크했는지)
7. check_requirements: 체크요건 확인 여부 (통화 희망 시간대 확인 + 실제 자금 필요 여부 확인)
8. closing_done: 클로징 멘트 여부 (전문 컨설턴트 내일 안내 예고)
9. phone_secured: 010 번호 확보 여부

응답 JSON 형식:
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
  "customer_info": {
    "company": "업체명 (들렸으면)",
    "ceo_name": "대표자 성함",
    "phone_010": "확보한 010번호",
    "business_age": "업력",
    "annual_revenue": "연매출",
    "industry": "업종",
    "has_delinquency": true/false/null,
    "credit_score": "신용점수",
    "required_fund": "필요자금"
  },
  "needs_level": "상 또는 중 또는 하",
  "feedback": "통화 개선 피드백 1-2문장 (법적 고지 누락 시 반드시 언급)"
}

니즈 수준 판단 기준:
- 상: 고객이 정책자금에 적극적 관심 표명, 정보 제공에 협조적, 항목 대부분 충족
- 중: 어느 정도 관심 있으나 확신 없음, 절반 이상 항목 충족
- 하: 관심이 낮거나 정보 수집이 어려웠음, 절반 이하 항목 충족
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

    const maxSize = 20 * 1024 * 1024 // 20MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: '파일이 너무 큽니다 (최대 20MB)' }, { status: 400 })
    }

    const mimeType = file.type || 'audio/mpeg'
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
