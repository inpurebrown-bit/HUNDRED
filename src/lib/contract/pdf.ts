// 계약서 PDF 렌더러 — 채워진 한글 문서(XML)를 읽어 같은 내용을 헌드레드 용지 위에 새로 그린다.
// 한글(.hwpx) 편집 파일과 별도로, 직원이 고칠 수 없는 PDF 로 내려주기 위한 것.
import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, setCharacterSpacing, type PDFPage, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path'

// ── 아주 작은 XML 트리 파서 (한글 문서의 규칙적인 XML 용) ──
export interface XNode { tag: string; attrs: Record<string, string>; children: XNode[]; text?: string }
export function parseXml(src: string): XNode {
  const root: XNode = { tag: '#root', attrs: {}, children: [] }
  const stack: XNode[] = [root]
  const re = /<(\/?)([A-Za-z0-9_:.-]+)((?:\s+[^\s=\/>]+="[^"]*")*)\s*(\/?)>|([^<]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    if (m[5] !== undefined) { const cur = stack[stack.length - 1]; if (cur.tag === 'hp:t') cur.children.push({ tag: '#text', attrs: {}, children: [], text: m[5] }); continue }
    const [, close, tag, attrStr, self] = m
    if (close) { if (stack.length > 1) stack.pop(); continue }
    const attrs: Record<string, string> = {}
    for (const a of attrStr.matchAll(/([^\s=]+)="([^"]*)"/g)) attrs[a[1]] = a[2]
    const node: XNode = { tag, attrs, children: [] }
    stack[stack.length - 1].children.push(node)
    if (!self) stack.push(node)
  }
  return root
}
export const kids = (n: XNode, tag: string) => n.children.filter(c => c.tag === tag)
export const kid = (n: XNode, tag: string) => n.children.find(c => c.tag === tag)
const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

// ── 모양 정보 ──
interface CharStyle { size: number; bold: boolean; ul: boolean; strike: boolean }
interface Para { align: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFY'; runs: { text: string; st: CharStyle }[]; baseSize: number }
type Tone = 'header' | 'label' | 'sub' | 'banner' | 'off' | null
interface Cell { r: number; c: number; rs: number; cs: number; w: number; h: number; blocks: Block[]; fill: string | null; border: boolean; tone: Tone }
interface Table { cells: Cell[]; width: number; align: 'LEFT' | 'CENTER' | 'RIGHT' }
interface AmtRow { label: string; value: string; note: string }
type Block = { kind: 'p'; p: Para } | { kind: 'table'; t: Table } | { kind: 'amt'; rows: AmtRow[] } | { kind: 'sp'; h: number; pb?: boolean }

function parseHeader(h: string) {
  const chars: Record<string, CharStyle> = {}
  for (const m of h.matchAll(/<hh:charPr id="(\d+)" height="(\d+)"[\s\S]*?<\/hh:charPr>/g)) {
    const x = m[0]
    chars[m[1]] = { size: +m[2] / 100, bold: x.includes('<hh:bold/>'), ul: /<hh:underline type="(BOTTOM|TOP)"/.test(x), strike: /<hh:strikeout shape="(?!NONE)[A-Z_]+"/.test(x) }
  }
  const aligns: Record<string, Para['align']> = {}
  for (const m of h.matchAll(/<hh:paraPr id="(\d+)"[\s\S]*?<hh:align horizontal="([A-Z]+)"/g)) aligns[m[1]] = (m[2] as Para['align']) || 'LEFT'
  const fills: Record<string, { fill: string | null; border: boolean }> = {}
  for (const m of h.matchAll(/<hh:borderFill id="(\d+)"[\s\S]*?<\/hh:borderFill>/g)) {
    const x = m[0]
    const face = (x.match(/faceColor="(#[0-9A-Fa-f]{6})"/) || [])[1]
    fills[m[1]] = { fill: face && face.toUpperCase() !== '#FFFFFF' ? face : null, border: /<hh:(left|bottom)Border type="SOLID"/.test(x) }
  }
  return { chars, aligns, fills }
}
type Hdr = ReturnType<typeof parseHeader>

function paraFrom(p: XNode, H: Hdr): { para: Para; tables: XNode[] } {
  const runs: Para['runs'] = []
  const tables: XNode[] = []
  let baseSize = 10
  for (const run of kids(p, 'hp:run')) {
    const st = H.chars[run.attrs.charPrIDRef] || { size: 10, bold: false, ul: false, strike: false }
    baseSize = st.size
    for (const c of run.children) {
      if (c.tag === 'hp:tbl') tables.push(c)
      else if (c.tag === 'hp:tab') runs.push({ text: '    ', st })
      else if (c.tag === 'hp:lineBreak') runs.push({ text: '\n', st })
      else if (c.tag === 'hp:t') {
        for (const t of c.children) {
          if (t.tag === '#text') runs.push({ text: unesc(t.text || ''), st })
          else if (t.tag === 'hp:lineBreak') runs.push({ text: '\n', st })
          else if (t.tag === 'hp:tab') runs.push({ text: '    ', st })
        }
      }
    }
  }
  return { para: { align: H.aligns[p.attrs.paraPrIDRef] || 'LEFT', runs, baseSize }, tables }
}

const ptext = (p: Para) => p.runs.map(r => r.text).join('')
const isEmptyPara = (b: Block) => b.kind === 'p' && !ptext(b.p).trim()

function blocksFrom(parent: XNode, H: Hdr): Block[] {
  const out: Block[] = []
  for (const p of kids(parent, 'hp:p')) {
    const { para, tables } = paraFrom(p, H)
    if (p.attrs.pageBreak === '1') out.push({ kind: 'sp', h: 0, pb: true })   // 문단 앞에서 새 쪽
    if (tables.length) {
      const al = para.align === 'CENTER' ? 'CENTER' : para.align === 'RIGHT' ? 'RIGHT' : 'LEFT'
      for (const t of tables) out.push({ kind: 'table', t: tableFrom(t, H, al) })
    } else out.push({ kind: 'p', p: para })
  }
  return out
}

function cellText(c: Cell): string { return c.blocks.map(b => (b.kind === 'p' ? ptext(b.p) : '')).join('').replace(/\s+/g, ' ').trim() }

function tableFrom(t: XNode, H: Hdr, align: Table['align']): Table {
  const sz = kid(t, 'hp:sz')
  const cells: Cell[] = []
  for (const tr of kids(t, 'hp:tr')) for (const tc of kids(tr, 'hp:tc')) {
    const ad = kid(tc, 'hp:cellAddr')!, sp = kid(tc, 'hp:cellSpan')!, cz = kid(tc, 'hp:cellSz')!
    const bf = H.fills[tc.attrs.borderFillIDRef] || { fill: null, border: true }
    const sub = kid(tc, 'hp:subList')
    cells.push({
      r: +ad.attrs.rowAddr, c: +ad.attrs.colAddr, rs: +(sp.attrs.rowSpan || 1), cs: +(sp.attrs.colSpan || 1),
      w: +cz.attrs.width / 100, h: +cz.attrs.height / 100, blocks: sub ? blocksFrom(sub, H) : [], fill: bf.fill, border: bf.border, tone: null,
    })
  }
  const tb: Table = { cells, width: +(sz?.attrs.width || 42520) / 100, align }
  styleTable(tb)
  return tb
}

// 표 꾸미기: 첫 열의 빈 칸 합치기 · 머리행/라벨/소계 색 · 글자 굵게
function styleTable(t: Table) {
  const nRows = Math.max(...t.cells.map(c => c.r + c.rs))
  // (1) 첫 열에서 이름 아래 빈 칸들은 위 칸에 합친다 (행이 많은 표만)
  if (nRows >= 8) {
    const col0 = t.cells.filter(c => c.c === 0 && c.cs === 1).sort((a, b) => a.r - b.r)
    let owner: Cell | null = null
    const drop = new Set<Cell>()
    for (const c of col0) {
      const empty = !cellText(c)
      if (!empty) { owner = c; continue }
      if (owner && c.rs === 1 && c.r === owner.r + owner.rs) { owner.rs += 1; drop.add(c) } else owner = null
    }
    if (drop.size) t.cells = t.cells.filter(c => !drop.has(c))
  }
  // (2) 색·굵기
  const subRows = new Set<number>()
  for (const c of t.cells) {
    const tx = cellText(c)
    if (/^소\s*계$/.test(tx) || (c.c === 0 && /^(합계|부가가치세|총\s*대금)/.test(tx))) for (let r = c.r; r < c.r + c.rs; r++) subRows.add(r)
  }
  const single = t.cells.length === 1
  // 머리행: 첫 줄의 모든 칸이 색이 있거나 굵은 글씨인 표 (서명란처럼 빈 칸이 섞인 표는 제외)
  const row0 = t.cells.filter(c => c.r === 0)
  const isBold = (c: Cell) => c.blocks.some(b => b.kind === 'p' && b.p.runs.some(r => r.text.trim() && r.st.bold))
  const headerRow = nRows >= 6 && row0.length >= 2 && row0.every(c => (c.fill || isBold(c)) && cellText(c))
  for (const c of t.cells) {
    if (single && c.fill) c.tone = 'banner'
    else if (headerRow && c.r === 0) c.tone = 'header'
    else if (subRows.has(c.r)) c.tone = 'sub'
    else if (c.fill) c.tone = 'label'
    // 취소선이 그어진 칸(하지 않는 업무)은 옅은 회색으로 막고, 빈 금액 칸의 선은 가운데에 둔다
    const rs = c.blocks.flatMap(b => (b.kind === 'p' ? b.p.runs : [])).filter(r => r.text.length > 0)
    if (rs.length && rs.every(r => r.st.strike)) {
      c.tone = 'off'
      for (const b of c.blocks) if (b.kind === 'p' && !ptext(b.p).replace(/[\s\u00a0]/g, '')) b.p.align = 'CENTER'
    }
    if (c.tone && c.tone !== 'off') for (const b of c.blocks) if (b.kind === 'p') b.p.runs = b.p.runs.map(r => ({ text: r.text, st: { ...r.st, bold: true } }))
  }
}

// ── 지면 · 색 ──
const PAGE_W = 595.28, PAGE_H = 841.89
const M = { left: 82, right: 82, top: 64, bottom: 86 }
const CW = PAGE_W - M.left - M.right
const LINE = 1.66        // 본문 줄 간격 배수
const LINE_CELL = 1.45   // 표 안 줄 간격 배수
const CS = -0.006        // 자간 (글자 크기 대비)
const SPACE = 0.31       // 띄어쓰기 폭 (글자 크기 대비)
const NAVY = rgb(0.063, 0.125, 0.227), GOLD = rgb(0.722, 0.6, 0.353), INK = rgb(0.09, 0.1, 0.14), WHITE = rgb(1, 1, 1)
const GRID = rgb(0.58, 0.63, 0.7)
const hexRgb = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255)
const TONE_FILL: Record<string, ReturnType<typeof rgb>> = { header: NAVY, banner: NAVY, label: hexRgb('#E8EDF6'), sub: hexRgb('#F5EFDD'), off: hexRgb('#E4E5E9') }
const OFF_TEXT = rgb(0.5, 0.51, 0.56)

interface Seg { text: string; st: CharStyle }
interface Line { segs: Seg[]; width: number; hard: boolean; indent: number }

export async function renderPdf(opt: { header: string; sections: string[]; bg: Buffer }): Promise<Buffer> {
  const H = parseHeader(opt.header)
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const dir = path.join(process.cwd(), 'src', 'lib', 'contract', 'fonts')

  // 문서에 쓰인 글자만 뽑아 작은 글꼴로 만든 뒤 넣는다
  const used = new Set<string>([...` 0123456789.,()[]{}-:;·※~/%&"'+=<>?!_■ㆍ`])
  for (const sec of opt.sections) for (const m of sec.matchAll(/<hp:t>([\s\S]*?)<\/hp:t>/g)) for (const ch of unesc(m[1].replace(/<[^>]+>/g, ''))) used.add(ch)
  const subsetFont = (await import('subset-font')).default
  const text = [...used].join('')
  const sub = async (file: string) => Buffer.from(await subsetFont(fs.readFileSync(path.join(dir, file)), text, { targetFormat: 'truetype' }))
  const regBuf = await sub('NotoSerifKR-Regular.ttf'), boldBuf = await sub('NotoSerifKR-Bold.ttf')
  const reg = await doc.embedFont(regBuf, { subset: false })
  const bold = await doc.embedFont(boldBuf, { subset: false })
  const bg = await doc.embedJpg(opt.bg)

  // 글자 폭은 글꼴의 advance 값으로 직접 계산한다 (그릴 때의 폭과 정확히 일치)
  const metric = (buf: Buffer) => {
    const f: any = (fontkit as any).create(buf)
    const cache = new Map<number, number>()
    return { adv: (cp: number) => { let v = cache.get(cp); if (v === undefined) { v = f.glyphForCodePoint(cp).advanceWidth / f.unitsPerEm; cache.set(cp, v) } return v } }
  }
  const mReg = metric(regBuf), mBold = metric(boldBuf)
  const fontOf = (st: CharStyle): PDFFont => (st.bold ? bold : reg)
  let scale = 1     // 한 쪽에 맞춰 줄여야 하는 구역(동의서)에서 글자 전체를 같은 비율로 줄인다
  const isSp = (ch: string) => ch === ' ' || ch === ' '
  const wChar = (ch: string, st: CharStyle) => (isSp(ch) ? SPACE : (st.bold ? mBold : mReg).adv(ch.codePointAt(0)!) + CS) * st.size * scale
  const wOf = (t: string, st: CharStyle) => { let w = 0; for (const ch of t) w += wChar(ch, st); return w }
  const bodySt: CharStyle = { size: 10, bold: false, ul: false, strike: false }

  // 번호 문단의 내어쓰기 폭 계산: "1. " "가. " "· " "※ " 뒤에서 줄을 맞춘다
  function indents(p: Para): { first: number; rest: number } {
    const t = ptext(p)
    const st = p.runs[0]?.st || bodySt
    const num = t.match(/^(\d+\.\s+|[가-힣]\.\s+|[①-⑩]\s*|[·•]\s+|※\s+|-\s+)/)
    if (num) return { first: 0, rest: wOf(num[1], st) }
    // 앞 문단에 딸린 문장(" 단, ...")은 번호 글자만큼 들여 쓴다
    if (/^ \S/.test(t)) return { first: wOf('1. ', st), rest: wOf('1. ', st) }
    return { first: 0, rest: 0 }
  }

  // 문단 → 줄 (한국어는 단어 단위로 줄바꿈, 너무 긴 단어는 글자 단위)
  function layout(p: Para, width: number): Line[] {
    const ind = indents(p)
    const lines: Line[] = []
    let cur: Seg[] = [], curW = 0
    const lim = () => width - (lines.length === 0 ? ind.first : ind.rest)
    const push = (hard: boolean) => {
      while (cur.length > 1 && /^\s*$/.test(cur[cur.length - 1].text)) { curW -= wOf(cur[cur.length - 1].text, cur[cur.length - 1].st); cur.pop() }
      lines.push({ segs: cur, width: curW, hard, indent: lines.length === 0 ? ind.first : ind.rest }); cur = []; curW = 0
    }
    const add = (t: string, st: CharStyle) => {
      const last = cur[cur.length - 1]
      if (last && last.st === st) last.text += t; else cur.push({ text: t, st })
      curW += wOf(t, st)
    }
    let first = true
    for (const run of p.runs) {
      run.text.split('\n').forEach((part, pi) => {
        if (pi > 0) { push(true) }
        let words: string[] = part.match(/\s*\S+|\s+$/g) || []
        if (first && ind.first > 0) words = words.map((w, i) => (i === 0 ? w.replace(/^\s+/, '') : w))
        first = false
        for (const w of words) {
          const ww = wOf(w, run.st)
          if (curW + ww <= lim() + 0.01) { add(w, run.st); continue }
          const bare = w.replace(/^\s+/, '')
          if (cur.length && bare && wOf(bare, run.st) <= lim()) { push(false); add(bare, run.st); continue }
          for (const ch of bare || w) { if (curW + wChar(ch, run.st) > lim() && cur.length) push(false); add(ch, run.st) }
        }
      })
    }
    push(true)
    return lines
  }
  const lineHs = (p: Para, lines: Line[], lf: number) => lines.map(l => Math.max(p.baseSize, ...l.segs.map(s => s.st.size)) * lf * scale)

  // 한 줄 그리기
  function drawLine(page: PDFPage, line: Line, x0: number, yTop: number, width: number, align: Para['align'], size: number, color = INK) {
    const x = x0 + line.indent, w = width - line.indent
    const full = line.segs.map(s => s.text).join('')
    let cx = x
    let extra = 0
    if (align === 'CENTER') cx = x + (w - line.width) / 2
    else if (align === 'RIGHT') cx = x + w - line.width
    else if (align === 'JUSTIFY' && !line.hard) { const sp = (full.match(/[  ]/g) || []).length; if (sp > 0) extra = Math.max(0, (w - line.width) / sp) }
    const base = yTop - size * scale * 1.08
    const put = (s: string, st: CharStyle, px: number) => {
      page.pushOperators(pushGraphicsState(), setCharacterSpacing(CS * st.size * scale))
      try { page.drawText(s, { x: px, y: base, size: st.size * scale, font: fontOf(st), color }) } catch { /* 글꼴에 없는 글자 */ }
      page.pushOperators(popGraphicsState())
    }
    for (const seg of line.segs) {
      const start = cx
      // 띄어쓰기는 우리가 정한 폭으로 직접 띄운다 (단어 단위로 그린다)
      for (const tk of seg.text.split(/([  ])/)) {
        if (!tk) continue
        if (isSp(tk)) { cx += wChar(tk, seg.st) + (tk === ' ' ? extra : 0); continue }
        put(tk, seg.st, cx); cx += wOf(tk, seg.st)
      }
      if (seg.st.ul) page.drawLine({ start: { x: start, y: base - 1.6 }, end: { x: cx, y: base - 1.6 }, thickness: 0.5, color })
      if (seg.st.strike) page.drawLine({ start: { x: start, y: base + seg.st.size * scale * 0.3 }, end: { x: cx, y: base + seg.st.size * scale * 0.3 }, thickness: 0.9, color })
    }
  }

  // ── 높이 재기(measure) 와 그리기(draw) ──
  interface MCell { c: Cell; w: number; inner: Meas[]; need: number }
  type Meas =
    | { kind: 'p'; p: Para; lines: Line[]; hs: number[]; h: number; lf: number }
    | { kind: 'table'; t: Table; colX: number[]; colW: number[]; rowH: number[]; rowTop: number[]; cells: MCell[]; x0: number; tw: number; h: number }
    | { kind: 'amt'; rows: AmtRow[]; h: number }
    | { kind: 'sp'; h: number; pb?: boolean }

  const padY = () => (scale < 1 ? 1.4 : 3.2)
  const padX = (w: number) => Math.min(5, Math.max(1.6, w * 0.1))
  const AMT_ROW = 21

  function measure(blocks: Block[], width: number, lf = LINE): Meas[] {
    const out: Meas[] = []
    for (const b of blocks) {
      if (b.kind === 'sp') { out.push({ kind: 'sp', h: b.h * scale, pb: b.pb }); continue }
      if (b.kind === 'amt') { out.push({ kind: 'amt', rows: b.rows, h: b.rows.length * AMT_ROW * scale + 6 }); continue }
      if (b.kind === 'p') {
        const lines = layout(b.p, width), hs = lineHs(b.p, lines, lf)
        out.push({ kind: 'p', p: b.p, lines, hs, h: hs.reduce((a, v) => a + v, 0), lf })
        continue
      }
      const t = b.t
      const nCols = Math.max(...t.cells.map(c => c.c + c.cs)), nRows = Math.max(...t.cells.map(c => c.r + c.rs))
      const colW: number[] = new Array(nCols).fill(0)
      for (const c of t.cells) if (c.cs === 1) colW[c.c] = Math.max(colW[c.c], c.w)
      for (const c of t.cells) if (c.cs > 1) { const have = colW.slice(c.c, c.c + c.cs).reduce((a, v) => a + v, 0); if (have < c.w) { const empties = colW.slice(c.c, c.c + c.cs).filter(v => !v).length || c.cs; for (let k = c.c; k < c.c + c.cs; k++) if (!colW[k]) colW[k] += (c.w - have) / empties } }
      const total = colW.reduce((a, v) => a + v, 0) || 1
      const sc = Math.min(1, width / total)
      for (let k = 0; k < nCols; k++) colW[k] = (colW[k] || total / nCols) * sc
      const tw = colW.reduce((a, v) => a + v, 0)
      const x0 = t.align === 'CENTER' ? (width - tw) / 2 : t.align === 'RIGHT' ? width - tw : 0
      const cells: MCell[] = t.cells.map(c => {
        const w = colW.slice(c.c, c.c + c.cs).reduce((a, v) => a + v, 0)
        const inner = measure(c.blocks, w - padX(w) * 2, scale < 1 ? 1.22 : LINE_CELL)
        const content = inner.reduce((a, m) => a + m.h, 0) + padY() * 2 * scale
        const minH = c.tone === 'banner' ? 30 : c.h * sc * (scale < 1 ? 0.45 : 0.88)
        return { c, w, inner, need: Math.max(content, minH * scale) }
      })
      const rowH: number[] = new Array(nRows).fill(0)
      for (const mc of cells) if (mc.c.rs === 1) rowH[mc.c.r] = Math.max(rowH[mc.c.r], mc.need)
      for (const mc of cells) if (mc.c.rs > 1) { const have = rowH.slice(mc.c.r, mc.c.r + mc.c.rs).reduce((a, v) => a + v, 0); if (have < mc.need) rowH[mc.c.r + mc.c.rs - 1] += mc.need - have }
      const rowTop: number[] = []; let acc = 0
      for (let r = 0; r < nRows; r++) { rowTop[r] = acc; acc += rowH[r] }
      const colX: number[] = []; let ax = 0
      for (let k = 0; k < nCols; k++) { colX[k] = ax; ax += colW[k] }
      out.push({ kind: 'table', t, colX, colW, rowH, rowTop, cells, x0, tw, h: acc })
    }
    return out
  }

  function drawInner(page: PDFPage, items: Meas[], x: number, yTop: number, width: number, color = INK) {
    let y = yTop
    for (const m of items) {
      if (m.kind === 'p') { m.lines.forEach((l, i) => { drawLine(page, l, x, y, width, m.p.align, m.hs[i] / (m.lf * scale), color); y -= m.hs[i] }); continue }
      if (m.kind === 'table') { drawTableRows(page, m, 0, m.rowH.length, x + m.x0, y); y -= m.h; continue }
      y -= m.h
    }
  }
  function drawTableRows(page: PDFPage, m: Extract<Meas, { kind: 'table' }>, r0: number, r1: number, x: number, yTop: number) {
    for (const mc of m.cells) {
      const c = mc.c
      if (c.r < r0 || c.r >= r1) continue
      const cx = x + m.colX[c.c]
      const cy = yTop - (m.rowTop[c.r] - m.rowTop[r0])
      const h = m.rowH.slice(c.r, Math.min(c.r + c.rs, r1)).reduce((a, v) => a + v, 0)
      const dark = c.tone === 'header' || c.tone === 'banner'
      if (c.tone) page.drawRectangle({ x: cx, y: cy - h, width: mc.w, height: h, color: TONE_FILL[c.tone] })
      else if (c.fill) page.drawRectangle({ x: cx, y: cy - h, width: mc.w, height: h, color: hexRgb(c.fill) })
      if (c.border || c.tone) page.drawRectangle({ x: cx, y: cy - h, width: mc.w, height: h, borderColor: dark ? NAVY : GRID, borderWidth: 0.55 })
      const content = mc.inner.reduce((a, q) => a + q.h, 0)
      const px = padX(mc.w)
      drawInner(page, mc.inner, cx + px, cy - Math.max(padY() * scale, (h - content) / 2), mc.w - px * 2, dark ? WHITE : c.tone === 'off' ? OFF_TEXT : c.tone === 'label' ? NAVY : INK)
    }
  }
  // 착수금·부가세·총 대금: 금액 자리를 위아래로 딱 맞춘 작은 표
  function drawAmt(page: PDFPage, rows: AmtRow[], x: number, yTop: number) {
    const numW = wOf('2. ', bodySt)
    const valRight = x + numW + 210
    rows.forEach((r, i) => {
      const y = yTop - i * AMT_ROW * scale
      const base = y - 14 * scale
      const total = i === rows.length - 1
      const st: CharStyle = { ...bodySt, bold: total }
      const lx = x + (i === 0 ? 0 : numW)
      let cx = lx
      for (const tk of (i === 0 ? '2. ' : '') .split('')) cx += wChar(tk, st)
      const label = i === 0 ? r.label : r.label
      const put = (s: string, px: number, stt: CharStyle, color = INK) => {
        page.pushOperators(pushGraphicsState(), setCharacterSpacing(CS * stt.size * scale))
        try { page.drawText(s, { x: px, y: base, size: stt.size * scale, font: fontOf(stt), color }) } catch { /* */ }
        page.pushOperators(popGraphicsState())
      }
      if (i === 0) put('2.', x, bodySt)
      put(label, i === 0 ? x + numW : lx, st)
      const vw = wOf(r.value, { ...bodySt, bold: true })
      page.drawLine({ start: { x: x + numW + 96, y: base - 3.5 * scale }, end: { x: valRight + 16 * scale, y: base - 3.5 * scale }, thickness: 0.45, color: GRID })
      put(r.value, valRight - vw, { ...bodySt, bold: true }, total ? NAVY : INK)
      put('원', valRight + 3, st)
      if (r.note) put(r.note, valRight + 24 * scale, { ...bodySt, size: 8.5 }, rgb(0.4, 0.42, 0.48))
    })
  }

  // ── 쪽 관리 ──
  let page!: PDFPage
  let y = 0
  const top = PAGE_H - M.top
  const newPage = () => { page = doc.addPage([PAGE_W, PAGE_H]); page.drawImage(bg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H }); y = top }

  // 문단 앞뒤 정리: [별지] 제목 분리, 착수금 3줄 묶기, 연속된 빈 줄 줄이기
  function prepare(blocks: Block[]): Block[] {
    const out: Block[] = []
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]
      if (b.kind === 'p') {
        const t = ptext(b.p)
        // "[별지 1] 제목 \n 설명" → 제목 + 설명
        if (/^\[별지/.test(t.trim()) && !t.includes('\n')) {
          out.push({ kind: 'p', p: { align: 'LEFT', baseSize: 13, runs: [{ text: t.trim(), st: { size: 13, bold: true, ul: false, strike: false } }] } })
          out.push({ kind: 'sp', h: 4 })
          continue
        }
        if (/^\[별지/.test(t.trim()) && t.includes('\n')) {
          const runs = b.p.runs
          const k = runs.findIndex(r => r.text.includes('\n'))
          const cut = runs[k].text.indexOf('\n')
          const head = runs.slice(0, k).map(r => r.text).join('') + runs[k].text.slice(0, cut)
          const rest = [{ ...runs[k], text: runs[k].text.slice(cut + 1) }, ...runs.slice(k + 1)].filter(r => r.text)
          out.push({ kind: 'p', p: { align: 'LEFT', baseSize: 13, runs: [{ text: head.trim(), st: { size: 13, bold: true, ul: false, strike: false } }] } })
          out.push({ kind: 'sp', h: 4 })
          out.push({ kind: 'p', p: { ...b.p, runs: rest } })
          continue
        }
        const m1 = t.match(/^\s*2\.\s*착수금\s*:\s*([\d,]*)\s*원([\s\S]*)$/)
        const nxt = blocks[i + 1], nxt2 = blocks[i + 2]
        const m2 = nxt && nxt.kind === 'p' ? ptext(nxt.p).match(/^\s*부가가치세\(10%\)\s*:\s*([\d,]*)\s*원/) : null
        const m3 = nxt2 && nxt2.kind === 'p' ? ptext(nxt2.p).match(/^\s*총\s*대금\s*:\s*([\d,]*)\s*원/) : null
        if (m1 && m2 && m3) {
          out.push({ kind: 'amt', rows: [
            { label: '착수금', value: m1[1].trim(), note: '(부가가치세 별도)' },
            { label: '부가가치세(10%)', value: m2[1].trim(), note: '' },
            { label: '총 대금', value: m3[1].trim(), note: '' },
          ] })
          i += 2; continue
        }
      }
      // 빈 줄이 여러 개 이어지면 하나로 (간격은 조 제목 위 여백으로 대신한다)
      if (isEmptyPara(b) && out.length && isEmptyPara(out[out.length - 1] as Block)) continue
      out.push(b)
    }
    return out
  }

  const isArticle = (p: Para) => p.runs.length > 0 && p.runs.every(r => r.st.bold) && (/^제\s*\d+\s*조/.test(ptext(p).trim()) || (p.baseSize >= 10.2 && p.baseSize < 19 && ptext(p).trim().length < 90 && p.align !== "CENTER"))
  const isTitle = (p: Para) => p.align === 'CENTER' && p.baseSize >= 20 && p.runs.some(r => r.st.bold)
  const isSubHead = (p: Para) => /^■/.test(ptext(p).trim())
  const isSepHead = (p: Para) => p.runs.length === 1 && p.runs[0].st.size >= 13 && p.runs[0].st.bold && /^\[별지/.test(ptext(p).trim())

  for (let si = 0; si < opt.sections.length; si++) {
    const root = parseXml(opt.sections[si])
    const sec = kid(root, 'hs:sec')!
    const all = prepare(blocksFrom(sec, H))
    // 별지 2는 새 쪽에서 시작한다. 별지 1·별지 2·동의서는 각각 한 쪽에 들어가도록 글자와 칸을 같은 비율로 줄인다
    const sepIdx = si === 1 ? all.findIndex(b => b.kind === 'p' && /^\[별지 2\]/.test(ptext(b.p).trim())) : -1
    const dropBlank = (bs: Block[]) => { let k = 0; while (k < bs.length && isEmptyPara(bs[k])) k++; return bs.slice(k) }
    const groups: Block[][] = sepIdx > 0 ? [all.slice(0, sepIdx), dropBlank(all.slice(sepIdx))] : [all]
    for (const group of groups) {
    const blocks = group
    scale = 1
    if (si >= 1) {
      for (let s = 1; s >= 0.6; s -= 0.02) {
        scale = s
        const total = measure(blocks, CW).reduce((a, m) => a + m.h + (m.kind === 'table' ? 6 : 0), 0) + 24
        if (total <= top - M.bottom) break
      }
    }
    newPage()

    // 서명 묶음(확인 문구 ~ 끝)은 제14조 뒤에 이어 붙이되, 한 쪽에 안 들어가면 통째로 다음 쪽으로
    const sigIdx = blocks.findIndex(b => b.kind === 'p' && /별지 1\(업무범위 확인서\) 및 별지 2/.test(ptext(b.p)))
    // 제14조와 서명란은 항상 같은 쪽에 — 같이 안 들어가면 제14조부터 다음 쪽으로 (서명란만 따로 떨어지지 않게)
    const art14 = blocks.findIndex(b => b.kind === 'p' && isArticle(b.p) && /^제\s*14\s*조/.test(ptext(b.p).trim()))
    const sigStart = sigIdx >= 0 && art14 >= 0 && art14 < sigIdx ? art14 : sigIdx

    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi]
      if (bi === sigStart && sigStart >= 0) {
        const rest = measure(blocks.slice(sigStart).filter(x => !isEmptyPara(x)), CW)
        const need = rest.reduce((a, m) => a + m.h, 0) + 24
        if (need > y - M.bottom && y < top - 1) newPage()
      }
      if (b.kind === 'sp') { if (b.pb) { if (y < top - 1) newPage() } else y -= b.h; continue }
      if (b.kind === 'amt') {
        const [m] = measure([b], CW) as Extract<Meas, { kind: 'amt' }>[]
        if (y - m.h < M.bottom) newPage()
        drawAmt(page, m.rows, M.left, y)
        y -= m.h
        continue
      }
      if (b.kind === 'p') {
        const p = b.p
        const [m] = measure([b], CW) as Extract<Meas, { kind: 'p' }>[]
        const art = isArticle(p), title = isTitle(p), sepHead = isSepHead(p)
        // 조 제목이 쪽 맨 아래에 혼자 남지 않게
        if ((art || sepHead) && y - m.hs[0] - 56 < M.bottom) newPage()
        if (art && y < top - 1) y -= 4
        if (title) { y -= 4 }
        m.lines.forEach((l, i) => {
          if (y - m.hs[i] < M.bottom) newPage()
          const color = art || title || sepHead ? NAVY : INK
          if (art && i === 0) { page.drawRectangle({ x: M.left - 9, y: y - m.hs[i] * 0.86, width: 3, height: m.hs[i] * 0.66, color: GOLD }) }
          drawLine(page, l, M.left, y, CW, p.align, m.hs[i] / (m.lf * scale), color)
          y -= m.hs[i]
        })
        if (art) { /* 제목 아래 가는 선 */ page.drawLine({ start: { x: M.left, y: y + 2 }, end: { x: M.left + CW, y: y + 2 }, thickness: 0.35, color: GRID }); y -= 3 }
        if (title) { page.drawLine({ start: { x: PAGE_W / 2 - 26, y: y + 1 }, end: { x: PAGE_W / 2 + 26, y: y + 1 }, thickness: 1.6, color: GOLD }); y -= 8 }
        if (sepHead) { page.drawLine({ start: { x: M.left, y: y + 3 }, end: { x: M.left + CW, y: y + 3 }, thickness: 0.8, color: GOLD }); y -= 4 }
        if (isSubHead(p)) y -= 0
        continue
      }
      const [m] = measure([b], CW) as Extract<Meas, { kind: 'table' }>[]
      // 한 칸짜리 큰 표(본문이 통째로 한 칸인 경우)는 칸 안 글을 이어서 쪽을 넘겨 쓴다
      if (m.rowH.length === 1 && m.cells.length === 1 && m.h > (top - M.bottom) * 0.6 && m.cells[0].c.tone !== 'banner') {
        blocks.splice(bi + 1, 0, ...prepare(m.cells[0].c.blocks))
        continue
      }
      let r0 = 0
      while (r0 < m.rowH.length) {
        let used = 0, r1 = r0
        while (r1 < m.rowH.length && used + m.rowH[r1] <= y - M.bottom) { used += m.rowH[r1]; r1++ }
        if (r1 === r0) { if (y < top - 1) { newPage(); continue } r1 = r0 + 1; used = m.rowH[r0] }
        drawTableRows(page, m, r0, r1, M.left + m.x0, y)
        y -= used; r0 = r1
        if (r0 < m.rowH.length) newPage()
      }
      y -= 6
    }
    }
  }

  // 쪽 번호 (하단 파도 위, 흰 글씨)
  const pages = doc.getPages()
  pages.forEach((pg, i) => {
    const t = `${i + 1} / ${pages.length}`
    const st: CharStyle = { size: 8.5, bold: false, ul: false, strike: false }
    let w = 0; for (const ch of t) w += (mReg.adv(ch.codePointAt(0)!)) * st.size
    pg.drawText(t, { x: PAGE_W - 56 - w, y: 24, size: st.size, font: reg, color: WHITE })
  })
  return Buffer.from(await doc.save())
}
