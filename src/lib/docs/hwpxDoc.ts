// 규정·서식 문서 → 한글(.hwpx) / PDF 생성기
// 계약서와 같은 기본 서식(헌드레드 용지)을 바탕으로, 제목·조문·표로 이루어진 문서를 새로 만든다.
import JSZip from 'jszip'
import tplFee from '../contract/tplFee'
import bgImage from '../contract/bgImage'

export type DocBlock =
  | { t: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'note'; text: string }
  | { t: 'table'; rows: string[][] }
export interface DocContent { title: string; subtitle?: string; blocks: DocBlock[] }
// 표지·목차를 붙일 때 쓰는 정보 (정관 내려받기용)
export interface CoverOpts { org: string; meta: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const W_TOTAL = 42520

interface Built { header: string; section: string; zip: JSZip }

// 문서 내용 → 한글 문서의 XML 조각 (header 글자모양 추가 포함)
export async function buildDocParts(doc: DocContent, cover?: CoverOpts): Promise<Built> {
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
  const CP = { title: '26', h1: withHeight('18', 1500), h2: withHeight('18', 1150), h3: withHeight('18', 1020), p: '19', li: '19', note: '12', cell: '29', cellHead: '8' }
  header = header.replace('</hh:charProperties>', clones.join('') + '</hh:charProperties>')
  header = header.replace(/(<hh:charProperties itemCnt=")(\d+)(")/, (_m, a, n, c) => a + (Number(n) + clones.length) + c)

  const para = (text: string, cp: string, pr = '0', pageBreak = false) =>
    `<hp:p id="0" paraPrIDRef="${pr}" styleIDRef="0" pageBreak="${pageBreak ? 1 : 0}" columnBreak="0" merged="0"><hp:run charPrIDRef="${cp}">${text ? `<hp:t>${esc(text)}</hp:t>` : ''}</hp:run></hp:p>`
  const empty = () => para('', CP.p)

  let tblId = 1226400000
  const table = (rows: string[][]) => {
    const nC = Math.max(...rows.map(r => r.length)), nR = rows.length
    // 열 너비: 글자 수에 비례 (최소 비율 보장)
    const len = Array.from({ length: nC }, (_, c) => Math.max(8, ...rows.map(r => Math.min(40, (r[c] || '').length))))
    const sum = len.reduce((a, v) => a + v, 0)
    let widths = len.map(l => Math.max(3000, Math.round((l / sum) * W_TOTAL)))
    const over = widths.reduce((a, v) => a + v, 0) - W_TOTAL
    widths[widths.indexOf(Math.max(...widths))] -= over
    const cell = (txt: string, r: number, c: number, head: boolean) => {
      const bf = head ? 9 : 5
      const ps = String(txt ?? '').split('\n').map(line => para(line, head ? CP.cellHead : CP.cell, head ? '21' : '22')).join('')
      return `<hp:tc name="" header="${head ? 1 : 0}" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${bf}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${ps}</hp:subList><hp:cellAddr colAddr="${c}" rowAddr="${r}"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="${widths[c]}" height="1700"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>`
    }
    const trs = rows.map((row, r) => `<hp:tr>${Array.from({ length: nC }, (_, c) => cell(row[c] ?? '', r, c, r === 0)).join('')}</hp:tr>`).join('')
    return `<hp:p id="0" paraPrIDRef="25" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${CP.cell}"><hp:tbl id="${tblId++}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${nR}" colCnt="${nC}" cellSpacing="0" borderFillIDRef="5" noAdjust="0"><hp:sz width="${W_TOTAL}" widthRelTo="ABSOLUTE" height="${nR * 1700}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="283" bottom="283"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>${trs}</hp:tbl><hp:t/></hp:run></hp:p>`
  }

  // 첫 문단: 쪽 설정(용지·배경)이 들어 있는 원본의 첫 문단을 그대로 쓰고 제목 글만 바꾼다
  const first = base.match(/<hp:p [\s\S]*?<\/hp:p>/)![0]
  const titlePara = first.replace(/<hp:t>[^<]*<\/hp:t>/, `<hp:t>${esc(doc.title)}</hp:t>`).replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '')
  const open = base.slice(0, base.indexOf('<hp:p '))
  let body = titlePara
  if (doc.subtitle) body += para(doc.subtitle, CP.note, '25')
  body += empty()
  if (cover) {
    // 표지: 제목·부제 아래 회사명과 버전, 그다음 쪽에 목차
    for (let i = 0; i < 9; i++) body += empty()
    body += para(cover.org, CP.h2, '25')
    body += para(cover.meta, CP.note, '25')
    body += para('목  차', CP.h1, '25', true) + empty()
    let firstEntry = true
    for (const b of doc.blocks) {
      if (b.t === 'h1') { if (!firstEntry) body += para('', CP.note, '36'); body += para(b.text, CP.h3, '36'); firstEntry = false }
      else if (b.t === 'h2') body += para('      ' + b.text, CP.p, '36')
    }
  }

  let firstH1 = !cover
  for (const b of doc.blocks) {
    if (b.t === 'table') { body += table(b.rows); body += para('', CP.note); continue }
    const text = b.text || ''
    if (b.t === 'h1') { body += para(text, CP.h1, '12', !firstH1); firstH1 = false; body += empty(); continue }
    if (b.t === 'h2') { body += empty() + para(text, CP.h2, '12'); continue }
    if (b.t === 'h3') { body += para(text, CP.h3, '12'); continue }
    if (b.t === 'li') { body += para(text, CP.li, '12'); continue }
    if (b.t === 'note') { body += para(text, CP.note, '12'); continue }
    body += para(text, CP.p, '0')
  }
  const section = open + body + '</hs:sec>'
  return { header, section, zip }
}

// 편집 가능한 한글 파일 (.hwpx)
export async function docToHwpx(doc: DocContent, cover?: CoverOpts): Promise<Buffer> {
  const { section, zip, header: header0 } = await buildDocParts(doc, cover)
  let header = header0
  header = header.replace(/secCnt="\d+"/, 'secCnt="1"')
  zip.file('Contents/header.xml', header)
  zip.file('Contents/section0.xml', section)
  // 이 문서는 구역이 하나 — 나머지 구역 파일은 비운다
  for (const n of ['section1', 'section2']) { zip.remove(`Contents/${n}.xml`) }
  let hpf = await zip.file('Contents/content.hpf')!.async('string')
  hpf = hpf.replace(/<opf:item id="section[12]"[^>]*\/>/g, '').replace(/<opf:itemref idref="section[12]"[^>]*\/>/g, '')
  hpf = hpf.replace(/<opf:item id="image1"[^>]*\/>/, '<opf:item id="image1" href="BinData/image1.jpg" media-type="image/jpg" isEmbeded="1"/>')
  hpf = hpf.replace(/<opf:title>[^<]*<\/opf:title>/, `<opf:title>${esc(doc.title)}</opf:title>`)
  zip.file('Contents/content.hpf', hpf)
  zip.file('BinData/image1.jpg', Buffer.from(bgImage, 'base64'))
  zip.remove('Preview/PrvImage.png')
  zip.file('Preview/PrvText.txt', doc.title)
  const mime = await zip.file('mimetype')!.async('string')
  zip.remove('mimetype')
  const out = new JSZip()
  out.file('mimetype', mime, { compression: 'STORE' })
  for (const name of Object.keys(zip.files)) { const f = zip.files[name]; if (!f.dir) out.file(name, await f.async('nodebuffer'), { compression: 'DEFLATE' }) }
  return out.generateAsync({ type: 'nodebuffer' })
}

// 수정할 수 없는 PDF (같은 용지·글꼴)
export async function docToPdf(doc: DocContent, cover?: CoverOpts): Promise<Buffer> {
  const { header, section } = await buildDocParts(doc, cover)
  const { renderPdf } = await import('../contract/pdf')
  return renderPdf({ header, sections: [section], bg: Buffer.from(bgImage, 'base64') })
}
