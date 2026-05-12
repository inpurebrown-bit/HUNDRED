import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  const { message, history } = await req.json()
  if (!message) {
    return NextResponse.json({ error: '메시지가 없습니다' }, { status: 400 })
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      systemInstruction: `당신은 헌드레드 지원센터의 AI 비서 '헌드레드비서'입니다.
정책자금 상담 전문가로서 다음 역할을 수행합니다:
- 중소기업·소상공인 대상 정책자금 종류 및 조건 안내
- 정책자금 신청 절차 및 필요 서류 안내
- 기술보증기금, 신용보증기금, 소상공인시장진흥공단 등 기관 안내
- 기업 상황에 맞는 적합한 정책자금 추천

반드시 정책자금 관련 질문에만 답변하세요.
정책자금과 무관한 질문(일상대화, 타 업무 등)은 정중히 거절하고 정책자금 관련 질문을 유도하세요.
항상 한국어로 답변하고, 간결하고 실용적인 정보를 제공하세요.
마지막에는 헌드레드 지원센터에 직접 상담 신청을 권유하세요.`,
    })

    const chat = model.startChat({
      history: history || [],
    })

    const result = await chat.sendMessage(message)
    const text = result.response.text()

    return NextResponse.json({ reply: text })
  } catch (error: any) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: '응답 생성 실패: ' + error.message }, { status: 500 })
  }
}
