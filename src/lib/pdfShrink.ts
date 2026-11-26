// 스캔본 PDF 용량 줄이기 — 문서 작성 AI 가 큰 스캔본(등기부 등 4~6MB)을 읽다가 중간에 끊겨 실패하는 문제를 막는다.
// 페이지마다 들어 있는 스캔 이미지를 가로 1600px · 흑백 · JPEG 60 으로 줄여 새 PDF 로 만든다(글자 판독에는 지장 없음, 2026-11-26 포근함 등기부로 검증).
// 글자가 들어 있는 일반 PDF(이미지가 아닌 것)·지원하지 않는 형식은 건드리지 않는다(null).
import { PDFDocument, PDFName } from 'pdf-lib'
import { supabaseAdmin } from '@/lib/supabase'

export const SHRINK_OVER = 3 * 1024 * 1024
const BUCKET = 'consulting-docs'

export async function shrinkScanPdf(buf: Buffer, maxW = 1600, quality = 60): Promise<Buffer | null> {
  const sharp = (await import('sharp')).default
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  for (const pg of doc.getPages()) {
    const { width, height } = pg.getSize()
    const res: any = (pg.node as any).Resources?.()
    const xo: any = res?.lookup(PDFName.of('XObject'))
    let best: { o: any; w: number; h: number; f: string } | null = null
    if (xo) {
      for (const [, ref] of xo.entries()) {
        const o: any = doc.context.lookup(ref)
        if (!o?.dict) continue
        if (String(o.dict.get(PDFName.of('Subtype'))) !== '/Image') continue
        const w = o.dict.get(PDFName.of('Width'))?.asNumber?.() || 0, h = o.dict.get(PDFName.of('Height'))?.asNumber?.() || 0
        if (!best || w * h > best.w * best.h) best = { o, w, h, f: String(o.dict.get(PDFName.of('Filter'))) }
      }
    }
    if (!best || !/DCTDecode/.test(best.f)) return null   // 글자 PDF 이거나 지원하지 않는 이미지 형식 → 그대로 둔다
    const jpg = await sharp(Buffer.from(best.o.contents)).resize({ width: Math.min(maxW, best.w), withoutEnlargement: true }).grayscale().jpeg({ quality }).toBuffer()
    const img = await out.embedJpg(jpg)
    out.addPage([width, height]).drawImage(img, { x: 0, y: 0, width, height })
  }
  return Buffer.from(await out.save())
}

/** 저장소에 올라간 파일이 3MB 넘는 스캔 PDF 면 줄인 것으로 같은 자리에 바꾸고, 원본은 orig/ 에 보관한다. */
export async function shrinkStored(path: string): Promise<{ changed: boolean; before: number; after: number; note?: string }> {
  if (!/\.pdf$/i.test(path)) return { changed: false, before: 0, after: 0, note: 'PDF 아님' }
  const dl = await supabaseAdmin.storage.from(BUCKET).download(path)
  if (dl.error || !dl.data) return { changed: false, before: 0, after: 0, note: dl.error?.message || '내려받기 실패' }
  const src = Buffer.from(await dl.data.arrayBuffer())
  if (src.length <= SHRINK_OVER) return { changed: false, before: src.length, after: src.length, note: '작아서 그대로' }
  let small: Buffer | null = null
  try {
    small = await shrinkScanPdf(src)
    if (small && small.length > SHRINK_OVER) small = (await shrinkScanPdf(src, 1300, 50)) || small
  } catch (e: any) { return { changed: false, before: src.length, after: src.length, note: '줄이기 실패: ' + (e?.message || '') } }
  if (!small || small.length > src.length * 0.8) return { changed: false, before: src.length, after: src.length, note: '줄일 수 없는 형식' }
  await supabaseAdmin.storage.from(BUCKET).upload('orig/' + path, src, { contentType: 'application/pdf', upsert: true })
  const up = await supabaseAdmin.storage.from(BUCKET).upload(path, small, { contentType: 'application/pdf', upsert: true })
  if (up.error) return { changed: false, before: src.length, after: src.length, note: up.error.message }
  return { changed: true, before: src.length, after: small.length }
}
