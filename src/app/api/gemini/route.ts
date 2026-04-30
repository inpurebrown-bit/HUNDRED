import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  // 대표만 접근 가능
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { message, history } = await req.json()
  if (!message) {
    return NextResponse.json({ error: '메시지가 없습니다' }, { status: 400 })
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite-preview',
      systemInstruction: `당신은 헌드레드 지원센터의 대표를 위한 전문 비서입니다.
정책자금 컨설팅 업무에 특화되어 있으며, 다음 역할을 수행합니다:
- 정책자금 관련 정보 제공 및 분석
- 고객 데이터 기반 인사이트 제공
- 영업·관리 업무 관련 조언
- 회의록 요약 및 보고서 작성
항상 한국어로 답변하고, 간결하고 실용적인 정보를 제공하세요.`,
    })

    const chat = model.startChat({
      history: history || [],
    })

    const result = await chat.sendMessage(message)
    const text = result.response.text()

    return NextResponse.json({ reply: text })
  } catch (error: any) {
    console.error('Gemini error:', error)
    return NextResponse.json({ error: '응답 생성 실패: ' + error.message }, { status: 500 })
  }
}
