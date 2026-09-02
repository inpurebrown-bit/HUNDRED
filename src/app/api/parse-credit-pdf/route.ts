import { NextRequest, NextResponse } from 'next/server'

// 대출 분류 코드
const LOAN_TYPE_MAP: Record<string, string> = {
  '신용대출(100)': '신용대출',
  '신용대출(종합통장대출)(1201)': '신용대출',
  '예/적금담보대출(200)': '담보대출',
  '기타 담보대출(290)': '담보대출',
  '유가증권(주식, 채권, 펀드 등) 담보대출(210)': '담보대출',
  '지급보증(보증서) 담보대출(240)': '담보대출',
  '지급보증(3021)': '정책자금',
  '이행지보(3071)': '정책자금',
  '운전자금(일반)(1051)': '정책자금',
  '카드론대출(0037)': '카드론',
  '현금서비스(0019)': '현금서비스',
}

function classifyLoanType(loanTypeStr: string): string {
  for (const [key, cat] of Object.entries(LOAN_TYPE_MAP)) {
    if (loanTypeStr.includes(key) || loanTypeStr === key) return cat
  }
  if (loanTypeStr.includes('신용대출')) return '신용대출'
  if (loanTypeStr.includes('담보대출')) return '담보대출'
  if (loanTypeStr.includes('지급보증') || loanTypeStr.includes('이행지보') || loanTypeStr.includes('운전자금')) return '정책자금'
  if (loanTypeStr.includes('카드론')) return '카드론'
  if (loanTypeStr.includes('현금서비스')) return '현금서비스'
  return '기타'
}

// 보증기관 판별 (재단/보증기관)
function isGuaranteeInstitution(name: string): boolean {
  return name.includes('신용보증재단') || name.includes('기술보증기금') || name.includes('신용보증기금') ||
    name.includes('보증재단') || name.includes('소상공인') || name.includes('서울보증보험') ||
    name.includes('중소기업진흥') || name.includes('신보') || name.includes('기보')
}

interface DebtItem {
  no: number
  type: string
  loanType: string
  institution: string
  date: string
  amountChon: number
  amountWan: number
  category: string
  isGuarantee: boolean
  skipped?: boolean
}

function parseDebtText(text: string): DebtItem[] {
  const debtStart = text.indexOf('1. 채무현황')
  const overdueSect = text.indexOf('2. 연체채권')
  const debtSection = overdueSect > debtStart && overdueSect > 0
    ? text.slice(debtStart, overdueSect)
    : text.slice(debtStart)

  const items: DebtItem[] = []

  // 실제 PDF 형식: 필드 사이 공백 없음
  // 예) 1개인사업자대출운전자금(일반)(1051)기업은행[본부총괄]2020.04.10.30,000
  const lines = debtSection.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    const rowMatch = trimmed.match(
      /^(\d+)(개인대출정보|개인사업자대출)(.*?)(\d{4}\.\d{2}\.\d{2}\.)([\d,]+)$/
    )
    if (rowMatch) {
      const [, no, type, loanAndInst, dateStr, amtStr] = rowMatch
      // 대출종류는 마지막 ')' 까지, 이후는 기관명
      const lastParen = loanAndInst.lastIndexOf(')')
      const rawLoanType = lastParen >= 0 ? loanAndInst.slice(0, lastParen + 1) : loanAndInst
      const institution = lastParen >= 0 ? loanAndInst.slice(lastParen + 1) : ''
      const amountChon = parseInt(amtStr.replace(/,/g, ''), 10) || 0
      const category = classifyLoanType(rawLoanType)
      // 날짜: 2020.04.10. → 2020-04-10
      const date = dateStr.slice(0, 10).replace(/\./g, '-')
      items.push({
        no: parseInt(no, 10),
        type,
        loanType: rawLoanType,
        institution: institution.trim(),
        date,
        amountChon,
        amountWan: amountChon * 1000,
        category,
        isGuarantee: category === '정책자금' && rawLoanType.includes('지급보증(3021)') && isGuaranteeInstitution(institution),
      })
    }
  }

  // 지급보증+은행대출 중복 제거: 같은 날 지급보증(재단)이 있으면 은행대출 스킵
  const guaranteeDates = new Set<string>()
  items.forEach(item => {
    if (item.isGuarantee) guaranteeDates.add(item.date)
  })

  items.forEach(item => {
    if (!item.isGuarantee && guaranteeDates.has(item.date) &&
        (item.category === '정책자금' || item.loanType.includes('운전자금(일반)'))) {
      // 같은 날 보증+실행대출인 경우 실행대출 스킵
      item.skipped = true
    }
  })

  return items
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    // pdf-parse로 텍스트 추출
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    const text: string = data.text

    const items = parseDebtText(text)
    const activeItems = items.filter(i => !i.skipped)

    // 카테고리별 집계
    const summary: Record<string, { totalWan: number; count: number }> = {}
    for (const item of activeItems) {
      if (!summary[item.category]) summary[item.category] = { totalWan: 0, count: 0 }
      summary[item.category].totalWan += item.amountWan
      summary[item.category].count++
    }

    const totalDebt = activeItems.reduce((s, i) => s + i.amountWan, 0)

    // 성명 추출 (실제 형식: "성명윤일도조회일자" — 공백 없음, 조회 직전까지)
    const nameMatch = text.match(/성명([가-힣]{2,5})(?=조회)/)
    const name = nameMatch ? nameMatch[1] : ''
    // 조회일자 추출 (형식: "조회일자'26.09.02. 17:27")
    const dateMatch = text.match(/조회일자.(\d{2})\.(\d{2})\.(\d{2})/)
    const reportDate = dateMatch ? `20${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : ''

    return NextResponse.json({
      name,
      reportDate,
      items,
      summary,
      totalDebt,
      rawText: text.slice(0, 500),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
