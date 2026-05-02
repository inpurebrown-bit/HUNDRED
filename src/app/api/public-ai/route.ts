import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  const { message } = await req.json()
  if (!message?.trim()) {
    return NextResponse.json({ error: '메시지가 없습니다' }, { status: 400 })
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      systemInstruction: `당신은 헌드레드 지원센터의 AI 상담 어시스턴트입니다.
헌드레드 지원센터는 정책자금 컨설팅 전문 기업으로, 대표 백승협이 운영합니다.

주요 서비스:
- 정책자금 컨설팅 (기보·신보·중진공·소진공·재단 등)
- 이노비즈·메인비즈 인증
- 무상지원금 발굴 및 신청
- 벤처기업 인증
- 법인설립
- 특허·가출원
- 광고·마케팅
- 자영업 컨설팅

주요 실적: 누적 승인금액 500억+, 계약 고객 1,200+, 성공 승인율 94%
연락처: 1844-2599 | 100-house@naver.com | 서울 구로구 디지털로 243

방문자의 정책자금·경영 관련 질문에 친절하고 전문적으로 답변하세요.
구체적인 승인 가능 여부나 금액은 상담이 필요하다고 안내하고, 무료 상담 신청을 권유하세요.
항상 한국어로 답변하고, 3~5문장 이내로 간결하게 답변하세요.`,
    })

    const result = await model.generateContent(message)
    const answer = result.response.text()

    // 질문 + 답변 DB 저장 (에러가 나도 응답은 정상 반환)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    await supabaseAdmin.from('ai_chat_logs').insert({
      question: message.trim(),
      answer,
      visitor_ip: ip,
    }).then(({ error }) => {
      if (error) console.error('ai_chat_logs insert error:', error.message)
    })

    return NextResponse.json({ reply: answer })
  } catch (error: any) {
    console.error('Public AI error:', error)
    return NextResponse.json({ error: '응답 생성 실패: ' + error.message }, { status: 500 })
  }
}
