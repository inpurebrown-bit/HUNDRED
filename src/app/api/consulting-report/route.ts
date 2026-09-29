import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 120

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const MODEL = process.env.GEMINI_REPORT_MODEL || 'gemini-2.5-flash'

const SYSTEM = `당신은 중소기업·소상공인 경영 컨설턴트입니다. 고객에게 "앞으로 어떻게 진행할 계획인지"를 소개하는 컨설팅 제안 보고서를 작성합니다.

[작성 원칙 — 반드시 준수]
1. 이 보고서는 작성일 시점의 분석과 향후 진행 "제안/계획"입니다. 이미 수행한 서비스나 이미 발생한 성과처럼 서술하지 마세요. ("~했습니다" 금지, "~를 제안합니다/진행 예정입니다/검토합니다" 사용)
2. 제공된 자료(인콜카드, 여신구분, 업로드 서류)에 없는 수치·사실을 지어내지 마세요. 근거가 없으면 "자료 미확인" 또는 "추정"이라고 명시하세요.
3. 인콜카드 기재 내용과 서류 내용이 다르면 crossCheck에 "불일치"로 정확히 기록하세요.
4. 정책자금·인증의 한도, 금리, 요건 등은 변동됩니다. 확실치 않은 수치는 단정하지 말고 "공고 확인 필요"를 붙이세요. 승인·선정을 보장하는 표현 금지.
5. 문체는 전문적이고 간결하게. 고객이 읽는 문서입니다.

[참고 지식 — 기관별 성격]
- 소진공(소상공인시장진흥공단): 소상공인 대상 정책자금, 소규모 운전/시설자금
- 중진공(중소벤처기업진흥공단): 중소기업 정책자금(운전/시설), 혁신성장·창업 관련 프로그램
- 신보(신용보증기금)/기보(기술보증기금)/지역신용보증재단: 보증서 기반 대출. 기보는 기술력·인증(벤처/이노비즈/특허)이 있으면 유리
- 인증: 벤처기업확인, 이노비즈(기술혁신형), 메인비즈(경영혁신형), 연구소/R&D, 특허. 법인 전환·인증은 매출·업력·기술성 요건 검토 후 제안
- 마케팅: 메타(인스타·페이스북) 광고, 네이버(마이비즈·플레이스·검색광고), 유튜브, 카카오(채널/스토리) 등

[출력] 아래 JSON 스키마만 출력 (한국어):
{
 "headline": "한 줄 요약",
 "riskLevel": "낮음|보통|높음",
 "riskScore": 1~5 정수,
 "metrics": [{"label":"","value":""}]  // 4~6개 핵심 지표 (연매출, 부채비율, 기대출 합계, 월 추정 고정지출 등, 근거 없으면 '자료 미확인')
 "crossCheck": [{"item":"","incall":"","document":"","status":"일치|불일치|확인필요"}],
 "sections": [
   {"key":"s1","title":"1. 기업 분석","items":[{"heading":"","text":""}]},  // 매출현황, 동종업계 비교, 재무제표-매출형태 정합성, 부채비율/기대출, 사업장 건전성, 재무 위험도, 월 지출/매출 추정, 병행 추천 사업, 사업 발전 방향
   {"key":"s2","title":"2. 정책자금 진행 계획 (12개월)","items":[...]}, // 해당 가능 기관/상품(검토 필요 표기), 준비사항
   {"key":"s3","title":"3. 인증 및 기업 전환 로드맵","items":[...]}, // 벤처/이노비즈/R&D, 법인 전환 시점과 이점
   {"key":"s4","title":"4. 마케팅 전략","items":[...]},
   {"key":"s5","title":"5. 종합 소견","items":[...]} // 기대 효과(보수적으로), 기술로 볼 수 있는 부분, 취약점과 보완 방향
 ],
 "roadmap": [{"period":"1~2개월","title":"","detail":""}]  // 12개월 진행 계획 6~8개 단계
}`

async function fetchDoc(path: string) {
  const { data, error } = await supabaseAdmin.storage.from('consulting-docs').download(path)
  if (error || !data) return null
  const buf = Buffer.from(await data.arrayBuffer())
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const mimeType = ext === 'pdf' ? 'application/pdf'
    : ext === 'png' ? 'image/png'
    : (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg'
    : ext === 'webp' ? 'image/webp' : ''
  if (!mimeType) return null
  return { mimeType, data: buf.toString('base64') }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as any
  if (!['ops', 'ceo'].includes(user.role)) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { incall, credit, docs } = await req.json() as {
    incall: Record<string, any>
    credit: any
    docs: { type: string; label: string; path: string }[]
  }

  try {
    const parts: any[] = []
    parts.push({ text: `[인콜카드 기재 내용]\n${JSON.stringify(incall || {}, null, 1)}` })
    parts.push({ text: `[여신구분(기대출) 분석 데이터]\n${credit ? JSON.stringify(credit) : '없음'}` })

    const missing: string[] = []
    for (const d of docs || []) {
      if (!d.path) { missing.push(d.label); continue }
      const f = await fetchDoc(d.path)
      if (!f) { missing.push(`${d.label}(읽기 실패/미지원 형식)`); continue }
      parts.push({ text: `[첨부 서류: ${d.label}]` })
      parts.push({ inlineData: f })
    }
    parts.push({ text: `[미제출/미확인 서류] ${missing.length ? missing.join(', ') : '없음'}\n[작성일] ${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}\n위 자료로 보고서 JSON을 작성하세요.` })

    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    })
    const result = await model.generateContent(parts)
    const report = JSON.parse(result.response.text())
    return NextResponse.json({
      report: { ...report, generatedAt: new Date().toISOString(), missingDocs: missing },
    })
  } catch (e: any) {
    console.error('consulting-report error:', e)
    return NextResponse.json({ error: '보고서 생성 실패: ' + (e?.message || '') }, { status: 500 })
  }
}
