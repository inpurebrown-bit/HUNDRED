// 경영지도 및 자문 계약서(.hwpx) 생성기
// 기본 서식(원픽스 계약서)의 한글 파일을 바탕으로, 업체 정보·금액·선택 업무·특약을 채우고
// 헌드레드 용지(테두리·하단 로고·워터마크)를 입혀 새 .hwpx 로 만든다. 서버에서만 쓴다.
import JSZip from 'jszip'
import tplFee from './tplFee'
import tplNoFee from './tplNoFee'
import bgImage from './bgImage'

export type ContractType = 'fee' | 'nofee'          // fee: 성과 수수료(%) 있는 계약 · nofee: 월정기(수수료 없음)

export interface CompanyInfo { name: string; bizNo: string; address: string; ceo: string; bank: string; account: string; holder: string }
export const DEFAULT_COMPANY: CompanyInfo = {
  name: '헌드레드 컨설팅', bizNo: '533-36-01551', address: '서울특별시 구로구 디지털로243, G-하이시티 911호',
  ceo: '백승협', bank: '기업은행', account: '420-102301-04-016', holder: '헌드레드컨설팅 (백승협)',
}

// 별지 1 업무 표의 행 (표 안의 행 번호와 같다)
export type ItemKey = 'diag' | 'venture' | 'lab' | 'inno' | 'main' | 'plan' | 'patent' | 'rnd'
export interface ItemRow { key: ItemKey; row: number; label: string; amount: number; required?: boolean }
export const ITEM_ROWS: ItemRow[] = [
  { key: 'diag',    row: 1, label: '경영진단 및 자문',                    amount: 2_000_000, required: true },
  { key: 'venture', row: 2, label: '벤처기업확인',                         amount: 5_000_000 },
  { key: 'lab',     row: 3, label: '기업부설연구소(연구개발전담부서) 설립 신고', amount: 1_500_000 },
  { key: 'inno',    row: 4, label: '이노비즈(기술혁신형 중소기업)',         amount: 0 },
  { key: 'main',    row: 5, label: '메인비즈(경영혁신형 중소기업)',         amount: 0 },
  { key: 'plan',    row: 6, label: '정부지원사업 사업계획서 작성',          amount: 0 },
  { key: 'patent',  row: 7, label: '특허 가출원용 자료 작성',              amount: 400_000 },
  { key: 'rnd',     row: 8, label: 'R&D 과제 사업계획서 작성',             amount: 0 },
]

export interface ContractInput {
  type: ContractType
  feePercent?: string                         // 성과 수수료 % (fee 계약)
  client: { company: string; address?: string; ceo?: string; bizNo?: string; managerName?: string; managerPhone?: string }
  contractDate?: string                       // YYYY-MM-DD (서명란 날짜)
  items: Partial<Record<ItemKey, { on: boolean; amount?: number }>>
  postCare?: { on: boolean; percent?: string }  // 과제 선정 이후 사후관리 (교부 지원금의 %)
  pLine?: boolean                             // P라인(프리미엄)
  extraClauses?: string[]                     // 추가 특약
  company?: CompanyInfo
  textOverrides?: Record<string, string>      // 대표가 고친 본문 (원문 → 새 문구)
  blank?: boolean                             // 공계약서: 업체·금액·날짜를 모두 비워 현장에서 직접 쓰게 한다 (미팅용)
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const won = (n: number) => Math.round(n).toLocaleString('ko-KR')

// ── 최상위 문단 분리 ──
interface Blk { start: number; end: number; xml: string }
function paragraphs(xml: string): Blk[] {
  const out: Blk[] = []
  let i = xml.indexOf('>', xml.indexOf('<hs:sec')) + 1
  for (;;) {
    const a = xml.indexOf('<hp:p ', i)
    if (a < 0) break
    let depth = 0, j = a
    for (;;) {
      const o = xml.indexOf('<hp:p ', j + 1), c = xml.indexOf('</hp:p>', j + 1)
      if (o >= 0 && o < c) { depth++; j = o } else { if (depth === 0) { j = c + 7; break } depth--; j = c }
    }
    out.push({ start: a, end: j, xml: xml.slice(a, j) })
    i = j
  }
  return out
}
const textOf = (x: string) => unesc((x.match(/<hp:t>[^<]*<\/hp:t>/g) || []).map(t => t.slice(6, -7)).join(''))
const firstChar = (x: string) => (x.match(/charPrIDRef="(\d+)"/) || [])[1] || '0'
const stripLayout = (x: string) => x.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '')

// 문단의 글을 통째로 바꾼다 (첫 글자모양 유지)
function setParaText(x: string, text: string) {
  const open = x.slice(0, x.indexOf('>') + 1)
  return `${open}<hp:run charPrIDRef="${firstChar(x)}"><hp:t>${esc(text)}</hp:t></hp:run></hp:p>`
}

// ── 표 / 칸 ──
function tables(x: string) {
  const out: { start: number; end: number; xml: string }[] = []
  let i = 0
  for (;;) {
    const a = x.indexOf('<hp:tbl ', i); if (a < 0) break
    const e = x.indexOf('</hp:tbl>', a) + 9
    out.push({ start: a, end: e, xml: x.slice(a, e) }); i = e
  }
  return out
}
function cells(tbl: string) { return tbl.match(/<hp:tc [\s\S]*?<\/hp:tc>/g) || [] }
function addrOf(tc: string) { const m = tc.match(/colAddr="(\d+)" rowAddr="(\d+)"/)!; return { c: +m[1], r: +m[2] } }
function mapCell(tbl: string, r: number, c: number, fn: (tc: string) => string) {
  return tbl.replace(/<hp:tc [\s\S]*?<\/hp:tc>/g, tc => { const a = addrOf(tc); return a.r === r && a.c === c ? fn(tc) : tc })
}
// 칸 안의 첫 문단 글 바꾸기 (charMap: 글자모양 변환)
function cellText(tc: string, text: string, charMap?: (id: string) => string) {
  const p = tc.match(/<hp:p [\s\S]*?<\/hp:p>/)![0]
  const open = p.slice(0, p.indexOf('>') + 1)
  let cid = firstChar(p); if (charMap) cid = charMap(cid)
  return tc.replace(p, `${open}<hp:run charPrIDRef="${cid}">${text ? `<hp:t>${esc(text)}</hp:t>` : ''}</hp:run></hp:p>`)
}
const cellStrikeAll = (tc: string, charMap: (id: string) => string) => tc.replace(/charPrIDRef="(\d+)"/g, (_m, id) => `charPrIDRef="${charMap(id)}"`)

// ── 본체 ──
async function prepare(inp: ContractInput, forPdf = false) {
  const co = inp.company || DEFAULT_COMPANY
  const B = !!inp.blank
  const zip = await JSZip.loadAsync(Buffer.from(inp.type === 'fee' ? tplFee : tplNoFee, 'base64'))
  let header = await zip.file('Contents/header.xml')!.async('string')
  let s0 = await zip.file('Contents/section0.xml')!.async('string')
  let s1 = await zip.file('Contents/section1.xml')!.async('string')
  let s2 = await zip.file('Contents/section2.xml')!.async('string')

  // 취소선 글자모양: 쓰는 글자모양을 복제해 strikeout 만 켠다
  const strikeCache: Record<string, string> = {}
  const clones: string[] = []   // 글자모양 목록 맨 끝에 붙인다 (중간에 끼우면 번호가 밀린다)
  let nextCharId = Math.max(...[...header.matchAll(/<hh:charPr id="(\d+)"/g)].map(m => +m[1])) + 1
  // 원본 서식에는 "하지 않는 업무" 칸이 처음부터 취소선 글자모양(32·33번)으로 되어 있다 — 선택된 업무는 취소선 없는 모양으로 바꾼다
  const plainCache: Record<string, string> = {}
  const plain = (id: string) => {
    const m = header.match(new RegExp(`<hh:charPr id="${id}"[\\s\\S]*?</hh:charPr>`))
    if (!m || !/<hh:strikeout shape="(?!NONE)[A-Z_]+"/.test(m[0])) return id
    if (plainCache[id]) return plainCache[id]
    const nid = String(nextCharId++)
    clones.push(m[0].replace(`id="${id}"`, `id="${nid}"`).replace(/<hh:strikeout shape="[A-Z_]+"/, '<hh:strikeout shape="NONE"'))
    plainCache[id] = nid
    return nid
  }
  const strike = (id: string) => {
    if (strikeCache[id]) return strikeCache[id]
    const m = header.match(new RegExp(`<hh:charPr id="${id}"[\\s\\S]*?</hh:charPr>`))
    if (!m) return id
    const nid = String(nextCharId++)
    clones.push(m[0].replace(`id="${id}"`, `id="${nid}"`).replace(/<hh:strikeout shape="NONE"/, '<hh:strikeout shape="SOLID"'))
    strikeCache[id] = nid
    return nid
  }

  // 1) 회사·계좌 문구 치환 (원픽스 → 헌드레드)
  const bankOld = '국민은행 047101-04-291976'
  const holderOld = '예금주 : 원픽스파트너스 (박원태)'
  const swapCompany = (x: string) => x
    .split(bankOld).join(`${co.bank} ${co.account}`)
    .split(holderOld).join(`예금주 : ${co.holder}`)
    .split('원픽스 파트너스').join(co.name)
    .split('원픽스파트너스').join(co.name)
  s0 = swapCompany(s0); s1 = swapCompany(s1); s2 = swapCompany(s2)

  // 2) 금액 계산 (별지 1)
  const rows = ITEM_ROWS.map(r => {
    const o = inp.items[r.key]
    const on = r.required ? true : !!o?.on
    return { ...r, on: B ? true : on, amount: on && !B ? Math.round(Number(o?.amount ?? r.amount) || 0) : 0 }
  })
  const sum = rows.reduce((t, r) => t + (r.on ? r.amount : 0), 0)
  const vat = Math.round(sum * 0.1), total = sum + vat

  // 3) 본문 (section0)
  {
    const ps = paragraphs(s0)
    const edits: { b: Blk; xml: string }[] = []
    const client = inp.client
    let lastClauseIdx = -1
    // 특약 마지막 항목: '제 14 조' 바로 앞의 숫자 항목
    const art14 = ps.findIndex(b => /제\s*14\s*조/.test(textOf(b.xml)))
    for (let k = art14 - 1; k >= 0; k--) { const t = textOf(ps[k].xml).trim(); if (/^\d+\.\s/.test(t)) { lastClauseIdx = k; break } }

    ps.forEach((b, k) => {
      const t = textOf(b.xml)
      let x = b.xml
      if (B && !/별지 1\(업무범위 확인서\) 및 별지 2/.test(t)) {
        if (inp.textOverrides && inp.textOverrides[t.trim()] != null && !x.includes('<hp:tbl')) x = setParaText(x, inp.textOverrides[t.trim()])
      } else if (/경영지도 및 자문 의뢰자/.test(t) && b.xml.includes('<hp:t>            </hp:t>')) {
        x = x.replace('<hp:t>            </hp:t>', `<hp:t> ${esc(client.company)} </hp:t>`)
      } else if (/^2\. 착수금 :/.test(t.trim())) {
        x = x.replace('<hp:t>____________</hp:t>', `<hp:t> ${won(sum)} </hp:t>`)
      } else if (/^\s*부가가치세\(10%\)/.test(t)) {
        x = x.replace(/<hp:t>\s{10,}<\/hp:t>/, `<hp:t> ${won(vat)} </hp:t>`)
      } else if (/^\s*총 대금/.test(t)) {
        x = x.replace(/<hp:t>\s{10,}<\/hp:t>/, `<hp:t> ${won(total)} </hp:t>`)
      } else if (inp.type === 'fee' && t.includes('실행금액의 ______%')) {
        x = x.replace('______%', `${esc(String(inp.feePercent || '___'))}%`)
      } else if (/별지 1\(업무범위 확인서\) 및 별지 2/.test(t)) {
        // 확인 문구·날짜·서명란은 항상 새 쪽에 한꺼번에 오게 한다
        if (!forPdf) x = x.replace('pageBreak="0"', 'pageBreak="1"')
        if (!forPdf) for (let q = k - 1; q >= 0 && !textOf(ps[q].xml).trim() && !ps[q].xml.includes('<hp:tbl'); q--) edits.push({ b: ps[q], xml: '' })
      } else if (inp.textOverrides && inp.textOverrides[t.trim()] != null && !x.includes('<hp:tbl')) {
        x = setParaText(x, inp.textOverrides[t.trim()])
      }
      if (x !== b.xml) edits.push({ b, xml: x })
      if (k === lastClauseIdx && inp.extraClauses?.length) {
        const m = textOf(b.xml).trim().match(/^(\d+)\./)
        let n = m ? +m[1] : 0
        const add = inp.extraClauses.filter(c => c.trim()).map(c => setParaText(stripLayout(b.xml).replace(/ id="\d+"/, ' id="0"'), `${++n}. ${c.trim()}`)).join('')
        edits.push({ b: { ...b }, xml: (edits.find(e => e.b === b)?.xml ?? b.xml) + add })
      }
    })
    // 뒤에서부터 적용 (위치가 밀리지 않도록). 같은 문단이 두 번 들어간 경우 마지막 것만 쓴다
    const byStart = new Map<number, { b: Blk; xml: string }>()
    for (const e of edits) byStart.set(e.b.start, e)
    for (const e of [...byStart.values()].sort((a, b) => b.b.start - a.b.start)) s0 = s0.slice(0, e.b.start) + e.xml + s0.slice(e.b.end)

    // 날짜·서명·담당자 표
    const dt = inp.contractDate ? new Date(inp.contractDate + 'T00:00:00') : new Date(Date.now() + 9 * 3600 * 1000)
    const tbls = tables(s0)
    for (const t of [...tbls].reverse()) {
      let x = t.xml
      if (x.includes('<hp:t>2026</hp:t>') && x.includes('<hp:t>년</hp:t>')) {
        x = mapCell(x, 0, 0, tc => cellText(tc, B ? '' : String(dt.getFullYear())))
        x = mapCell(x, 0, 2, tc => cellText(tc, B ? '' : String(dt.getMonth() + 1)))
        x = mapCell(x, 0, 4, tc => cellText(tc, B ? '' : String(dt.getDate())))
      } else if (x.includes('<hp:t>사업자등록번호</hp:t>')) {
        x = mapCell(x, 0, 2, tc => cellText(tc, B ? '' : client.company))
        x = mapCell(x, 0, 4, tc => cellText(tc, B ? '' : client.bizNo || ''))
        x = mapCell(x, 1, 2, tc => cellText(tc, B ? '' : client.address || ''))
        x = mapCell(x, 2, 2, tc => cellText(tc, B ? '(인)' : `${client.ceo || ''}  (인)`))
        x = mapCell(x, 3, 2, tc => cellText(tc, co.name))
        x = mapCell(x, 3, 4, tc => cellText(tc, co.bizNo))
        x = mapCell(x, 4, 2, tc => cellText(tc, co.address))
        x = mapCell(x, 5, 2, tc => cellText(tc, `${co.ceo.split('').join(' ')} (인)`))
      } else if (x.includes('담당자</hp:t>')) {
        x = mapCell(x, 0, 0, tc => cellText(tc, `${co.name} 담당자`))
        x = mapCell(x, 0, 1, tc => cellText(tc, B ? '' : client.managerName || ''))
        x = mapCell(x, 0, 3, tc => cellText(tc, B ? '' : client.managerPhone || ''))
      } else continue
      s0 = s0.slice(0, t.start) + x + s0.slice(t.end)
    }
  }

  // 4) 별지 1: 업무·금액 표 (선택 안 한 업무는 이름과 금액 칸에 취소선)
  {
    const t = tables(s1)[0]
    let x = t.xml
    for (const r of rows) {
      if (r.on) {
        x = mapCell(x, r.row, 0, tc => cellStrikeAll(tc, plain))
        x = mapCell(x, r.row, 1, tc => cellText(tc, B ? '' : `${won(r.amount)}원`, plain))
      } else {
        x = mapCell(x, r.row, 0, tc => cellStrikeAll(tc, strike))
        x = mapCell(x, r.row, 1, tc => cellText(tc, ' '.repeat(14), strike))
      }
    }
    // 과제 선정 이후 사후관리 (교부 지원금의 N%)
    if (B) { x = mapCell(x, 9, 0, tc => cellStrikeAll(tc, plain)); x = mapCell(x, 9, 1, tc => cellText(tc, '교부 지원금의         %', plain)) }
    else if (inp.postCare?.on) { x = mapCell(x, 9, 0, tc => cellStrikeAll(tc, plain)); x = mapCell(x, 9, 1, tc => cellText(tc, `교부 지원금의 ${inp.postCare?.percent || ''} %`, plain)) }
    else { x = mapCell(x, 9, 0, tc => cellStrikeAll(tc, strike)); x = mapCell(x, 9, 1, tc => cellText(tc, ' '.repeat(14), strike)) }
    // P라인
    if (!inp.pLine && !B) { x = mapCell(x, 10, 0, tc => cellStrikeAll(tc, strike)); for (const rr of [10, 11, 12, 13]) x = mapCell(x, rr, 1, tc => cellText(tc, ' '.repeat(14), strike)) }
    else { x = mapCell(x, 10, 0, tc => cellStrikeAll(tc, plain)); for (const rr of [10, 11, 12, 13]) x = mapCell(x, rr, 1, tc => cellStrikeAll(tc, plain)) }
    x = mapCell(x, 14, 1, tc => cellText(tc, B ? '' : `${won(sum)}원`))
    x = mapCell(x, 15, 1, tc => cellText(tc, B ? '' : `${won(vat)}원`))
    x = mapCell(x, 16, 1, tc => cellText(tc, B ? '' : `${won(total)}원`))
    s1 = s1.slice(0, t.start) + x + s1.slice(t.end)
  }

  // 별지의 본문 문단도 대표가 고친 문구가 있으면 바꾼다
  if (inp.textOverrides && Object.keys(inp.textOverrides).length) {
    const ps1 = paragraphs(s1)
    for (const b of [...ps1].reverse()) {
      if (b.xml.includes('<hp:tbl')) continue
      const ov = inp.textOverrides[textOf(b.xml).trim()]
      if (ov != null) s1 = s1.slice(0, b.start) + setParaText(b.xml, ov) + s1.slice(b.end)
    }
  }

  // 5) 개인정보 동의서: 날짜(계약일)와 정보주체(대표자) 성명
  {
    const d2 = inp.contractDate ? new Date(inp.contractDate + 'T00:00:00') : new Date(Date.now() + 9 * 3600 * 1000)
    s2 = s2.replace(/<hp:tbl [^>]*colCnt="6"[\s\S]*?<\/hp:tbl>/, tbl => {
      if (!tbl.includes('<hp:t>2026</hp:t>')) return tbl
      let x = mapCell(tbl, 0, 0, tc => cellText(tc, B ? '' : String(d2.getFullYear())))
      x = mapCell(x, 0, 2, tc => cellText(tc, B ? '' : String(d2.getMonth() + 1)))
      return mapCell(x, 0, 4, tc => cellText(tc, B ? '' : String(d2.getDate())))
    })
    const who = (inp.client.ceo || '').trim()
    if (who) s2 = s2.replace(/<hp:tbl [^>]*colCnt="3"[\s\S]*?<\/hp:tbl>/, tbl => (tbl.includes('정보주체') ? mapCell(tbl, 0, 1, tc => cellText(tc, who.split('').join(' '))) : tbl))
  }

  // 6) 용지: 하단 파도 무늬를 피하도록 아래 여백을 늘린다
  const margin = (x: string) => x.replace(/(<hp:margin [^>]*?)bottom="4252"/g, '$1bottom="7600"')
  s0 = margin(s0); s1 = margin(s1); s2 = margin(s2)

  if (clones.length) {
    header = header.replace('</hh:charProperties>', clones.join('') + '</hh:charProperties>')
    header = header.replace(/(<hh:charProperties itemCnt=")(\d+)(")/, (_m, a, n, c) => a + (Number(n) + clones.length) + c)
  }
  // 글을 바꾼 문단의 줄 배치 정보는 한글이 열 때 다시 계산하게 지운다
  s0 = stripLayout(s0); s1 = stripLayout(s1); s2 = stripLayout(s2)
  return { zip, header, s0, s1, s2 }
}

// 편집 가능한 한글 파일(.hwpx)
export async function generateContract(inp: ContractInput): Promise<Buffer> {
  const { zip, header, s0, s1, s2 } = await prepare(inp)
  zip.file('Contents/header.xml', header)
  zip.file('Contents/section0.xml', s0)
  zip.file('Contents/section1.xml', s1)
  zip.file('Contents/section2.xml', s2)

  // 배경 이미지를 문서 안에 넣는다
  zip.file('BinData/image1.jpg', Buffer.from(bgImage, 'base64'))
  let hpf = await zip.file('Contents/content.hpf')!.async('string')
  hpf = hpf.replace(/<opf:item id="image1"[^>]*\/>/, '<opf:item id="image1" href="BinData/image1.jpg" media-type="image/jpg" isEmbeded="1"/>')
  hpf = hpf.replace(/<opf:title>[^<]*<\/opf:title>/, `<opf:title>${esc(`경영지도 및 자문 계약서_${inp.client.company}`)}</opf:title>`)
  zip.file('Contents/content.hpf', hpf)
  zip.remove('Preview/PrvImage.png')
  zip.file('Preview/PrvText.txt', `경영지도 및 자문 계약서\r\n${inp.client.company}`)

  // mimetype 은 반드시 첫 번째, 압축 없이
  const mime = await zip.file('mimetype')!.async('string')
  zip.remove('mimetype')
  const out = new JSZip()
  out.file('mimetype', mime, { compression: 'STORE' })
  for (const name of Object.keys(zip.files)) { const f = zip.files[name]; if (!f.dir) out.file(name, await f.async('nodebuffer'), { compression: 'DEFLATE' }) }
  return out.generateAsync({ type: 'nodebuffer' })
}

// 본문 편집용: 기본 서식의 문단 목록 (표 안의 글 제외, 빈 문단 제외)
export async function listBodyParagraphs(type: ContractType): Promise<string[]> {
  const zip = await JSZip.loadAsync(Buffer.from(type === 'fee' ? tplFee : tplNoFee, 'base64'))
  const out: string[] = []
  for (const n of ['section0', 'section1']) {
    const xml = await zip.file(`Contents/${n}.xml`)!.async('string')
    for (const b of paragraphs(xml)) { if (b.xml.includes('<hp:tbl')) continue; const t = textOf(b.xml).trim(); if (t.length > 1) out.push(t) }
  }
  return out
}

// 수정할 수 없는 PDF — 채워진 문서를 그대로 읽어 같은 내용·용지로 그린다
export async function generateContractPdf(inp: ContractInput): Promise<Buffer> {
  const { header, s0, s1, s2 } = await prepare(inp, true)
  const { renderPdf } = await import('./pdf')
  return renderPdf({ header, sections: [s0, s1, s2], bg: Buffer.from(bgImage, 'base64') })
}
