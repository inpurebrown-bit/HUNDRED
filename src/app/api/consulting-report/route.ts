import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import kb from '@/lib/policyKnowledge.json'

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
6. [정책자금 지식베이스]가 제공됩니다. policyFunds는 반드시 이 지식베이스(담당자 제공 공문 기준)에서만 고르고, 업체 자료(업력·업종·상시근로자·매출·기대출·신용점수·세금 체납·대표자 연령·지역 등)와 상품의 eligibility/exclusions·공통 융자제한 사유를 하나씩 대조해 해당되는 것만 최대 5개 선정하세요. 제한 사유에 해당하거나 대상이 아닌 상품은 제외. 자료가 없어 판정 불가한 요건은 prerequisites에 "확인 필요"로 적고 확정 표현 금지. verified는 지식베이스 표기가 '공문'이면 true, '이미지추출'이면 false. 지식베이스에 없는 상품·수치를 만들지 마세요.
7. 문체는 전문적이고 구체적으로. 각 items의 text는 200~320자, 업체의 실제 수치·업종·상황을 반드시 언급. 일반론 나열 금지.

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
 "policyFunds": [{"org":"기관","product":"상품명(지식베이스 표기 그대로)","limit":"지식베이스의 한도","rate":"금리/보증료","fitScore":0~100,"timing":"신청 권장 시기","matchReason":"이 업체가 해당되는 근거(요건별 충족 사실, 100자 내)","prerequisites":"추가 확인·준비 사항(제한 사유 해당 여부 포함, 80자 내)","verified":true|false,"source":"근거 공문(공고번호)"}], // 지식베이스에서 해당되는 상품을 최대 5개(fitScore 높은 순). 5개 미만이어도 해당되는 것만
 "roadmap": [{"startMonth":1~12,"endMonth":1~12,"track":"정책자금|인증|마케팅|재무","title":"","detail":"100자 내"}], // 8~10개, 12개월 전체 커버
 "certifications": [{"name":"","requirement":"핵심 요건","benefit":"이점","timing":"목표 시기","fit":"높음|보통|낮음"}], // 벤처확인·이노비즈·메인비즈·기업부설연구소·특허 등 4~5개
 "corpTransition": {"threshold":"법인 전환 권장 기준(매출/이익 구간)","currentStatus":"현재 진단","reasons":["전환 필요 이유 3~4개"],"benefits":["전환·인증 후 이점 3~4개"],"triggers":[{"label":"매출 성장","met":true,"note":"근거 40자 내"},{"label":"인력 채용","met":false,"note":""},{"label":"투자 계획","met":null,"note":""},{"label":"대외 신뢰도","met":true,"note":"거래처·입찰·금융 신뢰도 필요성"}]}, // triggers 4개 고정(met: true/false/null). 매출 성장·인력 채용·투자 계획·대외 신뢰도가 필요한 사업자는 법인 설립 권장 — 자료로 충족 여부 판단, 근거 없으면 null;
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

const OFFICIAL_RE = /(.go.kr|sbiz.or.kr|semas.or.kr|kosmes.or.kr|kodit.co.kr|kibo.or.kr|koreg.or.kr|innobiz.net|mainbiz.or.kr|venture.or.kr|신용보증재단|신용보증기금|기술보증기금|소상공인시장진흥공단|중소벤처기업진흥공단)/i
const isOfficial = (v: string) => OFFICIAL_RE.test(v || '')

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

function buildKbBlock(incall: Record<string, any>) {
  const text = JSON.stringify(incall || {})
  const region = String(incall?.region || '')
  const regions = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
  const mine = regions.filter(r => region.includes(r))
  const want = mine.length ? mine : ['서울', '경기']
  const biz = String(incall?.business_type || '') + String(incall?.real_work || '')
  const compact = (kb as any).products
    .filter((x: any) => {
      if (x.org === '한국무역보험공사') return /수출/.test(text)
      if (x.org === '농림수산업자신용보증기금') return /농|어업|축산|수산|임업/.test(biz)
      if (/신용보증재단$/.test(x.org)) return want.some(r => x.org.startsWith(r))
      return true
    })
    .map((x: any) => {
      const o: Record<string, any> = { 기관: x.org, 상품: x.name, 표기: x.kind === 'image' ? '이미지추출' : '공문' }
      if (x.eligibility?.length) o.대상 = x.eligibility
      if (x.exclusions?.length) o.제한 = x.exclusions
      if (x.limit) o.한도 = x.limit
      if (x.rate) o.금리 = x.rate
      if (x.term) o.기간 = x.term
      if (x.method) o.방식 = x.method
      if (x.applyPeriod) o.접수 = x.applyPeriod
      if (x.source) o.근거 = x.source
      return o
    })
  const k = kb as any
  return '[정책자금 지식베이스 — 담당자 제공 공문 기준]\n기준 문서:\n- ' + k.basis.join('\n- ') +
    '\n\n[공통 규칙·융자제한]\n' + JSON.stringify(k.commonRules) + '\n\n[상품 목록]\n' + JSON.stringify(compact)
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
    mode?: 'research_market' | 'policy_a' | 'policy_b' | 'generate'
    incall: Record<string, any>
    credit: any
    docs?: { type: string; label: string; path: string }[]
    extras?: { label: string; value: string }[]
    absent?: string[]
    research?: { text: string; sources: { title: string; uri: string }[]; verifiedPolicy?: boolean }
  }

  // ── 1단계: 웹 조사 (실패해도 보고서 생성은 계속 진행) ──
  // market: 시장·업황 (참고용, 느슨) / policy_a, policy_b: 정책자금·인증 (공식 출처 교차검증)
  if (mode === 'research_market' || mode === 'policy_a' || mode === 'policy_b') {
    try {
      const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
      const company = summarizeIncall(incall)
      let prompt = ''
      if (mode === 'research_market') {
        prompt = `오늘(${today}) 기준으로 아래 업체 컨설팅에 필요한 시장 정보를 검색해 정리하세요.
[업체]
${company}
1. 해당 업종의 평균 영업이익률·부채비율·최근 업황(매출 추이, 위험요인)
2. 법인 전환 시 세금(개인 종합소득세 vs 법인세)·신용 측면의 일반적 기준
3. 이 업종에서 효과적인 온라인 마케팅 채널(메타·네이버·유튜브·카카오)과 통상 광고비 수준
불릿, 1,500자 이내, 수치에는 기준 시점 표기. 유사 자료를 참고해도 무방하나 확인 못한 수치는 쓰지 마세요.`
      } else {
        const scope = mode === 'policy_a'
          ? '소상공인시장진흥공단(소진공) 정책자금, 중소벤처기업진흥공단(중진공) 정책자금'
          : '신용보증기금, 기술보증기금, 지역신용보증재단 보증, 그리고 벤처기업확인·이노비즈·메인비즈·기업부설연구소 인증'
        prompt = `오늘(${today}) 기준으로 [${scope}]의 "현재 접수 중이거나 상시 운영 중인" 상품·인증 중 아래 업체에 해당 가능한 것을 기관 공식 홈페이지와 공고문(공문)을 중심으로 검색해 정리하세요.
[업체]
${company}
[검증 규칙 — 반드시 준수]
1. 상품마다 서로 다른 2곳 이상의 페이지를 확인하고, 그중 1곳 이상은 해당 기관의 공식 도메인(go.kr, or.kr 기관 사이트 등)이어야 합니다.
2. 출처 간 한도·금리·요건이 다르면 교차확인을 "불일치"로 쓰고 그 수치는 기재하지 마세요.
3. 확인하지 못한 항목은 추측하지 말고 "확인 불가"라고 쓰세요. 공식 출처가 없으면 "단일/비공식 출처"로 표시하세요.
4. 공고 연도·차수·접수기간을 함께 적고, 종료됐거나 시기가 불명확하면 그렇게 표시하세요.
5. 업체의 업력·업종·매출·기대출·신용 요건 부합 여부를 판단하고 근거를 쓰세요.
[출력 형식] 한 줄에 한 상품:
- [기관] 상품명 | 한도 | 금리 | 대상요건 | 접수시기(공고 차수) | 확인출처: 도메인들 | 교차확인: 일치/불일치/단일출처 | 업체 적합 판단: 근거
2,500자 이내.`
      }
      const resp = await runModel({ system: RESEARCH_SYSTEM, parts: [{ text: prompt }], search: true, maxTokens: 5000 })
      const text = resp.text()
      const chunks = (resp.candidates?.[0] as any)?.groundingMetadata?.groundingChunks || []
      const seen = new Set<string>()
      const sources = chunks
        .map((c: any) => ({ title: c?.web?.title || '', uri: c?.web?.uri || '' }))
        .filter((s: any) => s.uri && !seen.has(s.uri) && seen.add(s.uri))
        .slice(0, 10)
      const official = sources.filter((s: any) => isOfficial(s.title || s.uri))
      const cross = sources.length >= 2 && official.length >= 1
      const header = mode === 'research_market' ? '' :
        cross ? `[공식 출처 ${official.length}곳 포함 ${sources.length}곳 확인: ${official.map((s: any) => s.title).join(', ')}]\n`
              : '[경고: 공식 출처 교차확인 실패 — 이 블록의 한도·금리 수치는 보고서에 구체 수치로 쓰지 말 것]\n'
      return NextResponse.json({ research: { text: header + text, sources, officialCount: official.length, verified: mode === 'research_market' ? undefined : cross } })
    } catch (e: any) {
      console.error('research error:', e?.message)
      return NextResponse.json({ research: { text: '', sources: [], officialCount: 0, verified: false } })
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
    parts.push({ text: buildKbBlock(incall) })
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
