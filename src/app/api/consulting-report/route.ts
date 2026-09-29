import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 120

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const MODELS = [process.env.GEMINI_REPORT_MODEL, 'gemini-3.8-flash', 'gemini-3.1-flash-lite-preview'].filter(Boolean) as string[]

const SYSTEM = `당신은 중소기업·소상공인 경영 컨설턴트입니다. 고객에게 "앞으로 어떻게 진행할 계획인지"를 소개하는 A4 10페이지 분량의 컨설팅 제안 보고서 데이터를 작성합니다. 시각화(그래프)에 쓰이므로 수치 필드는 반드시 숫자로 채웁니다.

[작성 원칙 — 반드시 준수]
1. 작성일 시점의 분석과 향후 진행 "제안/계획"입니다. 이미 수행한 서비스나 발생한 성과처럼 서술 금지. ("~했습니다" 대신 "~를 제안합니다/진행 예정입니다/검토합니다")
2. 인콜카드·여신구분·업로드 서류·담당자 입력에 있는 사실만 사용. 없는 수치는 지어내지 말고 null 또는 "자료 미확인", 추정치는 "(추정)" 표기.
3. [웹 조사 자료]가 있으면 업종 평균·정책자금 공고·인증 요건 등에 적극 반영해 구체적으로 서술하고, 조사에서 나온 수치는 근거로 활용. 조사 자료에도 없는 한도·금리는 단정하지 말고 "공고 확인 필요".
4. 인콜카드와 서류가 다르면 crossCheck에 "불일치"로 정확히 기록.
5. 승인·선정·수익 보장 표현 금지. 기대효과는 보수적 범위로.
6. 문체는 전문적이고 구체적으로. 각 items의 text는 200~320자, 업체의 실제 수치·업종·상황을 반드시 언급. 일반론 나열 금지.

[출력] 아래 JSON만 출력 (한국어). 길이 제한을 지켜 10페이지를 넘기지 않게 하세요:
{
 "headline": "한 줄 종합진단(60자 내)",
 "summary": "종합진단 문단 450~650자",
 "keyFindings": ["핵심 발견 3~4개, 각 80자 내"],
 "riskLevel": "낮음|보통|높음",
 "riskScore": 1~5 정수,
 "metrics": [{"label":"","value":""}],  // 6개 (연매출, 영업이익률, 부채비율, 기대출 합계, 월 추정 고정지출, 고용인원 등)
 "financials": {
   "years": [{"year":"2023","revenue": 억원 숫자|null, "profit": 억원 숫자|null}],  // 확인 가능한 연도(최대 4개)
   "debtRatio": 숫자(%)|null,
   "debtBreakdown": [{"label":"기보/신보/중진공/소진공/재단/신용/담보/기타 등","amountWan": 숫자}],
   "monthly": {"income": 월 추정 매출(만원)|null, "costBreakdown":[{"label":"인건비/임차료/원가/이자/기타","amountWan": 숫자}]},
   "industryCompare": [{"label":"영업이익률(%)/부채비율(%)/매출증감률(%) 등","company": 숫자|null, "industry": 숫자|null}],
   "comment": "재무 종합 코멘트 250자 내",
   "cashflowComment": "현금흐름·업종 비교 코멘트 250자 내"
 },
 "crossCheck": [{"item":"","incall":"","document":"","status":"일치|불일치|확인필요"}],
 "sections": [
   {"key":"s1","title":"기업 분석","items":[{"heading":"","text":""}]},  // 4개: 매출현황·정합성 / 사업장 건전성·위험도 / 병행 추천 사업 / 사업 발전 과정
   {"key":"s2","title":"정책자금 진행 전략","items":[...]},  // 3개
   {"key":"s3","title":"인증 및 기업 전환","items":[...]},   // 3개
   {"key":"s4","title":"마케팅 전략","items":[...]},         // 3개
   {"key":"s5","title":"종합 소견","items":[...]}            // 4개: 기대효과 / 기술로 볼 부분 / 취약점 / 보완방향
 ],
 "policyFunds": [{"org":"기관","product":"상품/프로그램","limit":"예상 한도(확인 필요 표기)","fitScore":0~100,"timing":"신청 권장 시기","prerequisites":"선행·준비사항 80자 내"}], // 5~6개
 "roadmap": [{"startMonth":1~12,"endMonth":1~12,"track":"정책자금|인증|마케팅|재무","title":"","detail":"100자 내"}], // 8~10개, 12개월 전체 커버
 "certifications": [{"name":"","requirement":"핵심 요건","benefit":"이점","timing":"목표 시기","fit":"높음|보통|낮음"}], // 벤처확인·이노비즈·메인비즈·기업부설연구소·특허 등 4~5개
 "corpTransition": {"threshold":"법인 전환 권장 기준(매출/이익 구간)","currentStatus":"현재 진단","reasons":["전환 필요 이유 3~4개"],"benefits":["전환·인증 후 이점 3~4개"]},
 "marketing": {"budgetSplit": [{"channel":"메타/네이버/유튜브/카카오/기타","pct": 숫자(합계 100),"monthlyWan": 숫자,"strategy":"80자 내","kpi":"목표 지표"}], "note":"예산 운용 코멘트"},
 "swot": {"strengths":["3개"],"weaknesses":["3개"],"opportunities":["3개"],"threats":["3개"]},
 "outlook": [{"label":"기대 항목(예: 12개월 후 조달 가능 자금 범위)","value":"보수적 범위 서술"}] // 3~4개
}`

const RESEARCH_SYSTEM = `당신은 정책자금·중소기업 컨설팅 리서처입니다. Google 검색으로 최신 정보를 확인해 한국어 불릿으로 정리하세요. 확인 못한 것은 "확인 불가"라고 쓰고 추측하지 마세요.`

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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function runModel(opts: { system: string; parts: any[]; json?: boolean; search?: boolean; maxTokens?: number }) {
  let lastErr: any = null
  outer: for (const name of MODELS) {
    const model = genAI.getGenerativeModel({
      model: name,
      systemInstruction: opts.system,
      ...(opts.search ? { tools: [{ googleSearch: {} } as any] } : {}),
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: opts.maxTokens || 16000,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    })
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await model.generateContent(opts.parts)
        return result.response
      } catch (e: any) {
        lastErr = e
        const m = String(e?.message)
        if (/503|429|overloaded|high demand|unavailable/i.test(m)) { await sleep(3000 * (attempt + 1)); continue }
        if (/404|not found|no longer available/i.test(m)) continue outer
        throw e
      }
    }
  }
  throw lastErr || new Error('사용 가능한 모델 없음')
}

function parseJson(text: string) {
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  return JSON.parse(t)
}

function summarizeIncall(incall: Record<string, any>) {
  const pick = ['company', 'representative', 'business_type', 'real_work', 'region', 'years_in_business', 'employee_count', 'revenue_2023', 'revenue_2024', 'revenue_2025', 'revenue_2026', 'required_funds']
  return pick.map(k => `${k}: ${incall?.[k] ?? ''}`).join('\n')
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as any
  if (!['ops', 'ceo'].includes(user.role)) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const body = await req.json()
  const { mode = 'generate', incall, credit, docs, extras, absent, research } = body as {
    mode?: 'research' | 'generate'
    incall: Record<string, any>
    credit: any
    docs?: { type: string; label: string; path: string }[]
    extras?: { label: string; value: string }[]
    absent?: string[]
    research?: { text: string; sources: { title: string; uri: string }[] }
  }

  // ── 1단계: 웹 조사 (실패해도 보고서 생성은 계속 진행) ──
  if (mode === 'research') {
    try {
      const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
      const prompt = `오늘(${today}) 기준으로 아래 업체 컨설팅에 필요한 정보를 검색해 정리하세요.
[업체]\n${summarizeIncall(incall)}
[조사 항목]
1. 해당 업종의 평균 영업이익률·부채비율·최근 업황(매출 추이, 위험요인)
2. 소진공·중진공·신용보증기금·기술보증기금·지역신용보증재단의 현재 운영 중인 정책자금(소상공인/중소기업) 중 이 업체에 해당 가능한 상품, 한도·금리·요건·접수 시기
3. 벤처기업확인·이노비즈·메인비즈·기업부설연구소 최신 요건과 세제·금융 혜택
4. 법인 전환 시 세금(개인 종합소득세 vs 법인세)·신용·정책자금 측면의 일반적 기준
5. 이 업종에서 효과적인 온라인 마케팅 채널(메타·네이버·유튜브·카카오)과 통상 광고비 수준
각 항목 불릿, 총 2,000자 이내, 수치에는 기준 시점 표기.`
      const resp = await runModel({ system: RESEARCH_SYSTEM, parts: [{ text: prompt }], search: true, maxTokens: 4000 })
      const text = resp.text()
      const chunks = (resp.candidates?.[0] as any)?.groundingMetadata?.groundingChunks || []
      const seen = new Set<string>()
      const sources = chunks
        .map((c: any) => ({ title: c?.web?.title || '', uri: c?.web?.uri || '' }))
        .filter((s: any) => s.uri && !seen.has(s.uri) && seen.add(s.uri))
        .slice(0, 8)
      return NextResponse.json({ research: { text, sources } })
    } catch (e: any) {
      console.error('research error:', e?.message)
      return NextResponse.json({ research: { text: '', sources: [] } })
    }
  }

  // ── 2단계: 보고서 생성 ──
  try {
    const parts: any[] = []
    parts.push({ text: `[인콜카드 기재 내용]\n${JSON.stringify(incall || {}, null, 1)}` })
    parts.push({ text: `[여신구분(기대출) 분석 데이터]\n${credit ? JSON.stringify(credit) : '없음'}` })
    if (extras?.length) {
      parts.push({ text: `[담당자가 직접 입력한 정보]\n${extras.map(e => `- ${e.label}: ${e.value}`).join('\n')}\n(금액은 담당자 입력 그대로이며 별도 증빙 없음)` })
    }
    if (research?.text) parts.push({ text: `[웹 조사 자료]\n${research.text}` })

    const missing: string[] = [...(absent || [])]
    for (const d of docs || []) {
      if (!d.path) continue
      const f = await fetchDoc(d.path)
      if (!f) { missing.push(`${d.label}(읽기 실패/미지원 형식)`); continue }
      parts.push({ text: `[첨부 서류: ${d.label}]` })
      parts.push({ inlineData: f })
    }
    parts.push({ text: `[미제출/미확인 서류] ${missing.length ? missing.join(', ') : '없음'}\n[작성일] ${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}\n위 자료로 보고서 JSON을 작성하세요.` })

    const resp = await runModel({ system: SYSTEM, parts, json: true, maxTokens: 20000 })
    const report = parseJson(resp.text())
    return NextResponse.json({
      report: { ...report, generatedAt: new Date().toISOString(), missingDocs: missing, sources: research?.sources || [] },
    })
  } catch (e: any) {
    console.error('consulting-report error:', e)
    return NextResponse.json({ error: '보고서 생성 실패: ' + (e?.message || '') }, { status: 500 })
  }
}
