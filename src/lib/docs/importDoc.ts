// 한글(.hwpx/.hwp) · 워드(.docx) · 텍스트 파일을 읽어 규정 문서 내용(제목·조문·표)으로 바꾼다
import JSZip from 'jszip'
import zlib from 'zlib'
import type { DocBlock, DocContent } from './hwpxDoc'
import { parseXml, kids, kid, type XNode } from '../contract/pdf'

const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const clean = (s: string) => s.replace(/ /g, ' ').replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, m => (m.length > 3 ? '  ' : ''))

// 글 모양만으로 알 수 없을 때 쓰는 제목 판별
function classify(text: string, bold: boolean, size: number): DocBlock['t'] {
  const t = text.trim()
  if (/^제\s*\d+\s*(부|장)\b/.test(t) || /^부록\s*[A-Z가-힣]?/.test(t)) return 'h1'
  if (/^제\s*\d+\s*조\b/.test(t) && t.length < 70) return 'h2'
  if (/^\d+(-\d+)?\.\s+\S/.test(t) && t.length < 50 && (bold || size >= 11)) return 'h2'
  if (/^\d+(-\d+)?단계\s/.test(t) && t.length < 60) return 'h3'
  if (bold && size >= 14) return 'h1'
  if (bold && size >= 11 && t.length < 60) return 'h2'
  if (/^(☐|□|·|•|-|\*|\d+\)|[가-힣]\.)\s*/.test(t)) return 'li'
  return 'p'
}

// ── 한글 문서 (.hwpx) ──
async function fromHwpx(buf: Buffer): Promise<DocContent> {
  const zip = await JSZip.loadAsync(buf)
  const hdr = await zip.file('Contents/header.xml')!.async('string')
  const chars: Record<string, { size: number; bold: boolean }> = {}
  for (const m of hdr.matchAll(/<hh:charPr id="(\d+)" height="(\d+)"[\s\S]*?<\/hh:charPr>/g)) chars[m[1]] = { size: +m[2] / 100, bold: m[0].includes('<hh:bold/>') }
  const blocks: DocBlock[] = []
  const names = Object.keys(zip.files).filter(n => /^Contents\/section\d+\.xml$/.test(n)).sort()

  const paraText = (p: XNode) => {
    let text = '', bold = false, size = 10
    for (const run of kids(p, 'hp:run')) {
      const st = chars[run.attrs.charPrIDRef]
      for (const c of run.children) {
        if (c.tag === 'hp:t') for (const t of c.children) { if (t.tag === '#text') { text += unesc(t.text || ''); if (t.text?.trim() && st) { bold = bold || st.bold; size = Math.max(size, st.size) } } else if (t.tag === 'hp:lineBreak') text += '\n' }
        else if (c.tag === 'hp:tab') text += '  '
        else if (c.tag === 'hp:lineBreak') text += '\n'
      }
    }
    return { text, bold, size }
  }
  const tableRows = (tbl: XNode) => {
    const rows: Record<number, Record<number, string>> = {}
    for (const tr of kids(tbl, 'hp:tr')) for (const tc of kids(tr, 'hp:tc')) {
      const ad = kid(tc, 'hp:cellAddr')!; const sub = kid(tc, 'hp:subList')
      const txt = (sub ? kids(sub, 'hp:p') : []).map(p => paraText(p).text.trim()).filter(Boolean).join('\n')
      ;(rows[+ad.attrs.rowAddr] ||= {})[+ad.attrs.colAddr] = txt
    }
    const keys = Object.keys(rows).map(Number).sort((a, b) => a - b)
    return keys.map(k => { const r = rows[k]; const n = Math.max(...Object.keys(r).map(Number)) + 1; return Array.from({ length: n }, (_, i) => r[i] ?? '') })
  }
  for (const n of names) {
    const sec = kid(parseXml(await zip.file(n)!.async('string')), 'hs:sec')
    if (!sec) continue
    for (const p of kids(sec, 'hp:p')) {
      const tbls = kids(kid(p, 'hp:run') || p, 'hp:tbl').concat(kids(p, 'hp:run').flatMap(r => kids(r, 'hp:tbl')))
      if (tbls.length) { for (const t of tbls) { const rows = tableRows(t); if (rows.length) blocks.push({ t: 'table', rows }) } continue }
      const { text, bold, size } = paraText(p)
      for (const line of text.split('\n')) { if (!line.trim()) continue; blocks.push({ t: classify(line, bold, size), text: clean(line) } as DocBlock) }
    }
  }
  return finish(blocks)
}

// ── 워드 문서 (.docx) ──
async function fromDocx(buf: Buffer): Promise<DocContent> {
  const zip = await JSZip.loadAsync(buf)
  const xml = await zip.file('word/document.xml')!.async('string')
  const body = xml.slice(xml.indexOf('<w:body>'))
  const blocks: DocBlock[] = []
  const text = (p: string) => unesc((p.match(/<w:t[^>]*>[^<]*<\/w:t>|<w:tab\/>|<w:br\/>/g) || []).map(t => (t.startsWith('<w:tab') ? '  ' : t.startsWith('<w:br') ? '\n' : t.replace(/<[^>]+>/g, ''))).join(''))
  // 표와 문단을 문서 순서대로
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g
  for (const m of body.matchAll(re)) {
    const x = m[0]
    if (x.startsWith('<w:tbl>')) {
      const rows = (x.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []).map(tr => (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(tc => (tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(text).map(s => s.trim()).filter(Boolean).join('\n')))
      if (rows.length) blocks.push({ t: 'table', rows })
      continue
    }
    const style = (x.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || ''
    const t = text(x)
    if (!t.trim()) continue
    const bold = /<w:b\/>|<w:b w:val="(1|true)"/.test(x)
    const kind: DocBlock['t'] = style === 'Heading1' ? 'h1' : style === 'Heading2' ? 'h2' : style === 'Heading3' ? 'h3' : style === 'ListParagraph' ? 'li' : classify(t, bold, 10)
    blocks.push({ t: kind, text: clean(t) } as DocBlock)
  }
  return finish(blocks)
}

// ── 한글 구버전 (.hwp) — 본문 글만 읽는다 (표는 줄글로 나온다) ──
async function fromHwp(buf: Buffer): Promise<DocContent> {
  const CFB: any = await import('cfb')
  const cf = (CFB.default || CFB).read(buf, { type: 'buffer' })
  const lib = CFB.default || CFB
  const hdr = lib.find(cf, '/FileHeader').content as Buffer
  const compressed = !!(hdr.readUInt32LE(36) & 1)
  if (hdr.readUInt32LE(36) & 2) throw new Error('암호가 걸린 한글 파일은 읽을 수 없습니다')
  const blocks: DocBlock[] = []
  const sections = (cf.FullPaths as string[]).filter(p => /BodyText\/Section\d+$/.test(p)).sort()
  for (const path of sections) {
    let b: Buffer = lib.find(cf, path).content
    if (compressed) b = zlib.inflateRawSync(b)
    let i = 0
    while (i + 4 <= b.length) {
      const h = b.readUInt32LE(i); i += 4
      const tag = h & 0x3ff; let size = (h >>> 20) & 0xfff
      if (size === 0xfff) { size = b.readUInt32LE(i); i += 4 }
      if (tag === 67) {
        const d = b.subarray(i, i + size); let s = ''
        for (let k = 0; k + 1 < d.length; k += 2) {
          const c = d.readUInt16LE(k)
          if (c >= 32 || c === 9) s += String.fromCharCode(c)
          else if (c === 10 || c === 13) s += '\n'
          else if ([1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31].includes(c)) k += 14
        }
        for (const line of s.split('\n')) { if (line.trim()) blocks.push({ t: classify(line, false, 10), text: clean(line) } as DocBlock) }
      }
      i += size
    }
  }
  return finish(blocks)
}

function fromText(buf: Buffer): DocContent {
  const blocks: DocBlock[] = []
  for (const line of buf.toString('utf8').split(/\r?\n/)) { if (line.trim()) blocks.push({ t: classify(line, false, 10), text: clean(line) } as DocBlock) }
  return finish(blocks)
}

// 첫 줄(문서 제목)을 떼어 내고 정리한다
function finish(blocks: DocBlock[]): DocContent {
  const firstText = blocks.findIndex(b => b.t !== 'table')
  let title = '규정 문서'
  if (firstText >= 0) { title = (blocks[firstText] as any).text; blocks.splice(firstText, 1) }
  return { title, blocks }
}

export async function parseDocFile(buf: Buffer, filename: string): Promise<DocContent> {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (ext === 'hwpx') return fromHwpx(buf)
  if (ext === 'docx') return fromDocx(buf)
  if (ext === 'hwp') return fromHwp(buf)
  if (ext === 'txt' || ext === 'md') return fromText(buf)
  throw new Error('한글(.hwp, .hwpx), 워드(.docx), 텍스트(.txt) 파일만 읽을 수 있습니다')
}
