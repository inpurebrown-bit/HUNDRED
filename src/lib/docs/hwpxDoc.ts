// 규정·서식 문서 → 한글(.hwpx) / PDF 생성기
// 계약서와 같은 기본 서식(헌드레드 용지)을 바탕으로, 제목·조문·표로 이루어진 문서를 새로 만든다.
import JSZip from 'jszip'
import tplFee from '../contract/tplFee'
import bgImage from '../contract/bgImage'
import coverImage from './coverImage'

export type DocBlock =
  | { t: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'note'; text: string; align?: 'center' | 'right' }
  | { t: 'table'; rows: string[][]; form?: boolean; labelCols?: number[]; widths?: number[]; heights?: number[] }
  | { t: 'approval'; leader?: string; ceo?: string }          // 상단 결재란 (팀장·대표)
  | { t: 'title'; text: string; pb?: boolean }                 // 가운데 큰 제목 (묶음 서식에서 서식마다 새 쪽)
export interface DocContent { title: string; subtitle?: string; blocks: DocBlock[] }
// 표지·목차를 붙일 때 쓰는 정보 (정관 내려받기용)
export interface CoverOpts { org: string; version: string; date: string; eyebrow?: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const W_TOTAL = 42520

interface Built { header: string; sections: string[]; zip: JSZip; coverBgId?: string }

// 문서 내용 → 한글 문서의 XML 조각 (header 글자모양 추가 포함)
export async function buildDocParts(doc: DocContent, cover?: CoverOpts, mode: 'hwpx' | 'pdf' = 'hwpx'): Promise<Built> {
  const zip = await JSZip.loadAsync(Buffer.from(tplFee, 'base64'))
  let header = await zip.file('Contents/header.xml')!.async('string')
  const base = await zip.file('Contents/section0.xml')!.async('string')

  // 글자 크기별 글자모양을 맨 끝에 추가한다 (18번: 굵은 11pt 를 복제해 크기만 바꿈)
  let nextId = Math.max(...[...header.matchAll(/<hh:charPr id="(\d+)"/g)].map(m => +m[1])) + 1
  const clones: string[] = []
  const withHeight = (srcId: string, height: number) => {
    const m = header.match(new RegExp(`<hh:charPr id="${srcId}"[\\s\\S]*?</hh:charPr>`))!
    const id = String(nextId++)
    clones.push(m[0].replace(`id="${srcId}"`, `id="${id}"`).replace(/height="\d+"/, `height="${height}"`))
    return id
  }
  const withColor = (srcId: string, height: number, color: string) => {
    const m = header.match(new RegExp(`<hh:charPr id="${srcId}"[\\s\\S]*?</hh:charPr>`))!
    const id = String(nextId++)
    clones.push(m[0].replace(`id="${srcId}"`, `id="${id}"`).replace(/height="\d+"/, `height="${height}"`).replace(/textColor="#[0-9A-Fa-f]{6}"/, `textColor="${color}"`))
    return id
  }
  const CV = cover ? { eyebrow: withColor('18', 1100, '#C5A258'), title: withColor('18', 3800, '#FFFFFF'), bar: withColor('18', 1400, '#C5A258'), sub: withColor('19', 1300, '#DCE3EF'), meta: withColor('18', 1200, '#FFFFFF'), conf: withColor('19', 900, '#AEB9CE') } : null
  const CP = { title: '26', h1: withHeight('18', 1500), h2: withHeight('18', 1150), h3: withHeight('18', 1020), p: '19', li: '19', note: '12', cell: '29', cellHead: '8' }
  header = header.replace('</hh:charProperties>', clones.join('') + '</hh:charProperties>')
  header = header.replace(/(<hh:charProperties itemCnt=")(\d+)(")/, (_m, a, n, c) => a + (Number(n) + clones.length) + c)

  const para = (text: string, cp: string, pr = '0', pageBreak = false) =>
    `<hp:p id="0" paraPrIDRef="${pr}" styleIDRef="0" pageBreak="${pageBreak ? 1 : 0}" columnBreak="0" merged="0"><hp:run charPrIDRef="${cp}">${text ? `<hp:t>${esc(text)}</hp:t>` : ''}</hp:run></hp:p>`
  const empty = () => para('', CP.p)

  let tblId = 1226400000
  const table = (rows: string[][], o: { form?: boolean; labelCols?: number[]; widths?: number[]; heights?: number[]; total?: number; right?: boolean; center?: boolean } = {}) => {
    const total = o.total ?? W_TOTAL
    const nC = Math.max(...rows.map(r => r.length)), nR = rows.length
    // 열 너비: 글자 수에 비례 (최소 비율 보장)
    const len = Array.from({ length: nC }, (_, c) => Math.max(8, ...rows.map(r => Math.min(40, (r[c] || '').length))))
    const sum = len.reduce((a, v) => a + v, 0)
    let widths = len.map(l => Math.max(3000, Math.round((l / sum) * total)))
    if (o.widths) { const ws = o.widths.reduce((a, v) => a + v, 0); widths = o.widths.map(v => Math.round((v / ws) * total)) }
    const over = widths.reduce((a, v) => a + v, 0) - total
    widths[widths.indexOf(Math.max(...widths))] -= over
    const cell = (txt: string, r: number, c: number, head: boolean) => {
      const bf = head ? 9 : 5
      const mid = !!o.center
      const ps = String(txt ?? '').split('\n').map(line => para(line, head ? CP.cellHead : CP.cell, head ? '21' : mid ? '21' : '22')).join('')
      return `<hp:tc name="" header="${head ? 1 : 0}" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${bf}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${ps}</hp:subList><hp:cellAddr colAddr="${c}" rowAddr="${r}"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="${widths[c]}" height="${o.heights?.[r] ?? 1700}"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>`
    }
    const trs = rows.map((row, r) => `<hp:tr>${Array.from({ length: nC }, (_, c) => cell(row[c] ?? '', r, c, o.form ? !!o.labelCols?.includes(c) : r === 0)).join('')}</hp:tr>`).join('')
    return `<hp:p id="0" paraPrIDRef="${o.right ? 24 : 25}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${CP.cell}"><hp:tbl id="${tblId++}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${nR}" colCnt="${nC}" cellSpacing="0" borderFillIDRef="5" noAdjust="0"><hp:sz width="${total}" widthRelTo="ABSOLUTE" height="${Array.from({ length: nR }, (_, r) => o.heights?.[r] ?? 1700).reduce((a, v) => a + v, 0)}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="283" bottom="283"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>${trs}</hp:tbl><hp:t/></hp:run></hp:p>`
  }

  // 첫 문단: 쪽 설정(용지·배경)이 들어 있는 원본의 첫 문단을 그대로 쓰고 제목 글만 바꾼다
  const first = base.match(/<hp:p [\s\S]*?<\/hp:p>/)![0].replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '')
  const open = base.slice(0, base.indexOf('<hp:p '))
  const setText = (x: string, t: string) => x.replace(/<hp:t>[^<]*<\/hp:t>/, t ? `<hp:t>${esc(t)}</hp:t>` : '<hp:t></hp:t>')

  // 표지 구역 배경(네이비) — 한글 파일에서만 따로 쓴다. 새 배경 그림을 가리키는 채우기 모양을 하나 더 만든다
  let coverBgId: string | undefined
  if (cover && mode === 'hwpx') {
    const ids = [...header.matchAll(/<hh:borderFill id="(\d+)"/g)].map(m => +m[1])
    coverBgId = String(Math.max(...ids) + 1)
    const bf6 = header.match(/<hh:borderFill id="6"[\s\S]*?<\/hh:borderFill>/)![0]
    header = header.replace('</hh:borderFills>', bf6.replace('id="6"', `id="${coverBgId}"`).replace('binaryItemIDRef="image1"', 'binaryItemIDRef="image2"') + '</hh:borderFills>')
    header = header.replace(/(<hh:borderFills itemCnt=")(\d+)(")/, (_m, x, n, c) => x + (Number(n) + 1) + c)
  }

  const sections: string[] = []
  if (cover && CV) {
    if (mode === 'hwpx') {
      // ── 표지 구역: 네이비 배경 위에 흰 글씨 ──
      const coverFirst = setText(first, '').replace(/(<hp:pageBorderFill type="BOTH" borderFillIDRef=")6"/, `$1${coverBgId}"`)
      let c = coverFirst
      for (let i = 0; i < 8; i++) c += empty()
      c += para((cover.eyebrow || 'COMPANY REGULATIONS').split('').join(' '), CV.eyebrow, '12')
      c += para('', CP.p, '12')
      c += para(doc.title, CV.title, '12')
      c += para('━━━━━', CV.bar, '12')
      if (doc.subtitle) c += para(doc.subtitle, CV.sub, '12')
      for (let i = 0; i < 8; i++) c += empty()
      c += para(`${cover.version}    |    ${cover.date}    |    구성원 전용`, CV.meta, '12')
      c += para(`${cover.org} · 무단 복제·유출 금지`, CV.conf, '12')
      sections.push(open + c + '</hs:sec>')
    }
  }

  // ── 본문 구역 (표지가 있으면 목차부터) ──
  let body = cover ? setText(first, '') : setText(first, doc.title)
  if (!cover) {
    if (doc.subtitle) body += para(doc.subtitle, CP.note, '25')
    body += empty()
  } else {
    body += para('목  차', CP.h1, '25') + empty()
    let firstEntry = true
    for (const bl of doc.blocks) {
      if (bl.t === 'h1') { if (!firstEntry) body += para('', CP.note, '36'); body += para(bl.text, CP.h3, '36'); firstEntry = false }
      else if (bl.t === 'h2') body += para('      ' + bl.text, CP.p, '36')
    }
  }

  let firstH1 = !cover
  for (const bl of doc.blocks) {
    if (bl.t === 'table') { body += table(bl.rows, bl); body += para('', CP.note); continue }
    if (bl.t === 'approval') {
      // 팀장·대표 결재란: 오른쪽 위. 대표 이름은 미리 찍어 두어 서명만 하면 된다
      body += table([['팀  장', '대  표'], [bl.leader ? '\n\n' + bl.leader : '', '\n\n' + (bl.ceo ?? '백승협')]], { widths: [1, 1], heights: [1500, 2600], total: 15000, right: true, center: true })
      body += para('', CP.note); continue
    }
    if (bl.t === 'title') { body += para(bl.text, CP.h1, '25', !!bl.pb) + empty(); continue }
    const text = bl.text || ''
    const al = bl.align === 'center' ? '25' : bl.align === 'right' ? '24' : ''
    if (bl.t === 'h1') { body += para(text, CP.h1, '12', !firstH1); firstH1 = false; body += empty(); continue }
    if (bl.t === 'h2') { body += empty() + para(text, CP.h2, '12'); continue }
    if (bl.t === 'h3') { body += para(text, CP.h3, '12'); continue }
    if (bl.t === 'li') { body += para(text, CP.li, al || '12'); continue }
    if (bl.t === 'note') { body += para(text, CP.note, al || '12'); continue }
    body += para(text, CP.p, al || '0')
  }
  sections.push(open + body + '</hs:sec>')
  return { header, sections, zip, coverBgId }
}

// 편집 가능한 한글 파일 (.hwpx)
export async function docToHwpx(doc: DocContent, cover?: CoverOpts): Promise<Buffer> {
  const { sections, zip, header: header0 } = await buildDocParts(doc, cover, 'hwpx')
  let header = header0
  header = header.replace(/secCnt="\d+"/, `secCnt="${sections.length}"`)
  zip.file('Contents/header.xml', header)
  sections.forEach((sec, i) => zip.file(`Contents/section${i}.xml`, sec))
  // 쓰지 않는 구역 파일은 비운다
  const gone = ['section0', 'section1', 'section2'].filter((_n, i) => i >= sections.length)
  for (const n of gone) { zip.remove(`Contents/${n}.xml`) }
  let hpf = await zip.file('Contents/content.hpf')!.async('string')
  for (const n of gone) hpf = hpf.replace(new RegExp(`<opf:item id="${n}"[^>]*/>`), '').replace(new RegExp(`<opf:itemref idref="${n}"[^>]*/>`), '')
  if (sections.length > 1) hpf = hpf.replace('<opf:item id="header"', '<opf:item id="image2" href="BinData/image2.jpg" media-type="image/jpg" isEmbeded="1"/><opf:item id="header"')
  hpf = hpf.replace(/<opf:item id="image1"[^>]*\/>/, '<opf:item id="image1" href="BinData/image1.jpg" media-type="image/jpg" isEmbeded="1"/>')
  hpf = hpf.replace(/<opf:title>[^<]*<\/opf:title>/, `<opf:title>${esc(doc.title)}</opf:title>`)
  zip.file('Contents/content.hpf', hpf)
  zip.file('BinData/image1.jpg', Buffer.from(bgImage, 'base64'))
  if (sections.length > 1) zip.file('BinData/image2.jpg', Buffer.from(coverImage, 'base64'))
  zip.remove('Preview/PrvImage.png')
  zip.file('Preview/PrvText.txt', doc.title)
  const mime = await zip.file('mimetype')!.async('string')
  zip.remove('mimetype')
  const out = new JSZip()
  out.file('mimetype', mime, { compression: 'STORE' })
  for (const name of Object.keys(zip.files)) { const f = zip.files[name]; if (!f.dir) out.file(name, await f.async('nodebuffer'), { compression: 'DEFLATE' }) }
  return out.generateAsync({ type: 'nodebuffer' })
}

// 수정할 수 없는 PDF (같은 용지·글꼴). 표지는 따로 그려 맨 앞에 붙인다
export async function docToPdf(doc: DocContent, cover?: CoverOpts): Promise<Buffer> {
  const { header, sections } = await buildDocParts(doc, cover, 'pdf')
  const { renderPdf } = await import('../contract/pdf')
  const body = await renderPdf({ header, sections, bg: Buffer.from(bgImage, 'base64') })
  if (!cover) return body
  return addPdfCover(body, doc, cover)
}

async function addPdfCover(body: Buffer, doc: DocContent, cover: CoverOpts): Promise<Buffer> {
  const { PDFDocument, rgb } = await import('pdf-lib')
  const fontkit = (await import('@pdf-lib/fontkit')).default
  const subsetFont = (await import('subset-font')).default
  const fs = await import('fs'), path = await import('path')
  const dir = path.join(process.cwd(), 'src', 'lib', 'contract', 'fonts')
  const eyebrow = (cover.eyebrow || 'COMPANY REGULATIONS').split('').join(' ')
  const meta = [['VERSION', cover.version], ['DATE', cover.date], ['CLASS', '구성원 전용']]
  const conf = `${cover.org} · 무단 복제·유출 금지`
  const all = [eyebrow, doc.title, doc.subtitle || '', conf, ...meta.flat(), '0123456789.,·&()-:/ '].join('')
  const text = [...new Set(all)].join('')
  const sub = async (f: string) => Buffer.from(await subsetFont(fs.readFileSync(path.join(dir, f)), text, { targetFormat: 'truetype' }))
  const pdf = await PDFDocument.load(body)
  pdf.registerFontkit(fontkit)
  const bold = await pdf.embedFont(await sub('NotoSerifKR-Bold.ttf'), { subset: false })
  const reg = await pdf.embedFont(await sub('NotoSerifKR-Regular.ttf'), { subset: false })
  const W = 595.28, H = 841.89, X = 85, CW = W - X * 2
  const page = pdf.insertPage(0, [W, H])
  page.drawImage(await pdf.embedJpg(Buffer.from(coverImage, 'base64')), { x: 0, y: 0, width: W, height: H })
  const GOLD = rgb(0.773, 0.635, 0.345), WHITE = rgb(1, 1, 1), SOFT = rgb(0.863, 0.89, 0.937), MUTE = rgb(0.682, 0.725, 0.804)
  // 글줄 나누기 (글자 단위)
  // 이 글꼴의 띄어쓰기 칸은 너무 넓어서, 낱말 사이는 글자 크기의 0.31배로 직접 둔다
  const SP = 0.31
  const tw = (t: string, font: typeof bold, size: number) => t.split(' ').reduce((a, w, i) => a + font.widthOfTextAtSize(w, size) + (i ? SP * size : 0), 0)
  const wrap = (t: string, font: typeof bold, size: number, w: number) => {
    const lines: string[] = []; let cur = ''
    for (const ch of t) { if (tw(cur + ch, font, size) > w && cur) { lines.push(cur.trimEnd()); cur = ch === ' ' ? '' : ch } else cur += ch }
    if (cur.trim()) lines.push(cur.trim()); return lines
  }
  const put = (t: string, x: number, y: number, size: number, font: typeof bold, color: ReturnType<typeof rgb>) => {
    let cx = x
    for (const w of t.split(' ')) { if (w) { try { page.drawText(w, { x: cx, y, size, font, color }) } catch { /* 없는 글자 */ } cx += font.widthOfTextAtSize(w, size) } cx += SP * size }
  }
  // 위쪽 이미지의 로고 아래(약 70mm)부터 글을 놓는다
  let y = H - 215
  put(eyebrow, X, y, 10, bold, GOLD); y -= 46
  for (const l of wrap(doc.title, bold, 34, CW)) { put(l, X, y, 34, bold, WHITE); y -= 46 }
  page.drawRectangle({ x: X, y: y + 2, width: 62, height: 3, color: GOLD }); y -= 28
  if (doc.subtitle) for (const l of wrap(doc.subtitle, reg, 12, CW)) { put(l, X, y, 12, reg, SOFT); y -= 19 }
  // 아래쪽: 금색 선 아래에 버전·날짜·구분
  const yMeta = 142
  let mx = X
  const colW = [92, 150, 183]
  meta.forEach(([k, v], i) => { put(k, mx, yMeta + 15, 7.5, bold, GOLD); put(v, mx, yMeta, 11.5, bold, WHITE); mx += colW[i] })
  put(conf, X, 112, 8.5, reg, MUTE)
  return Buffer.from(await pdf.save())
}
