import { spawn } from 'child_process'
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { supabaseAdmin } from '@/lib/supabase'

// 녹취는 소리만 들리면 되므로 wav(통화녹음기의 GSM 압축 wav 는 브라우저 재생도 안 됨)는 올릴 때
// 작은 mono mp3 로 바꿔 저장한다. 2분 통화 약 240KB.
export async function convertToMp3(input: Buffer): Promise<Buffer> {
  const ffmpegPath = (await import('ffmpeg-static')).default as unknown as string
  if (!ffmpegPath) throw new Error('ffmpeg 를 찾을 수 없습니다')
  const dir = await mkdtemp(path.join(tmpdir(), 'rec-'))
  const inFile = path.join(dir, 'in.wav'), outFile = path.join(dir, 'out.mp3')
  try {
    await writeFile(inFile, input)
    await new Promise<void>((resolve, reject) => {
      const p = spawn(ffmpegPath, ['-y', '-i', inFile, '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '16k', outFile], { stdio: 'ignore' })
      p.on('error', reject)
      p.on('close', () => resolve())   // 끝부분 패킷 오류로 0이 아닌 코드가 나와도 출력 파일이 있으면 사용
    })
    const out = await readFile(outFile)
    if (out.length < 500) throw new Error('변환 결과가 비어 있습니다')
    return out
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/** 저장소의 wav 를 작은 mp3 로 바꿔 올리고 공개 URL 을 돌려준다. wav 가 아니면 그대로 */
export async function ensurePlayableWav(storagePath: string): Promise<{ url: string; path: string; converted: boolean }> {
  const bucket = supabaseAdmin.storage.from('dig-recordings')
  const pub = (p: string) => bucket.getPublicUrl(p).data.publicUrl
  if (!/\.wav$/i.test(storagePath)) return { url: pub(storagePath), path: storagePath, converted: false }
  const { data, error } = await bucket.download(storagePath)
  if (error || !data) throw new Error(error?.message || '녹취 파일을 읽지 못했습니다')
  const out = await convertToMp3(Buffer.from(await data.arrayBuffer()))
  const newPath = storagePath.replace(/(\.pcm)?\.wav$/i, '') + '.mp3'
  const up = await bucket.upload(newPath, out, { contentType: 'audio/mpeg', upsert: true })
  if (up.error) throw new Error(up.error.message)
  // 원본 wav 는 용량만 차지하므로 지운다 (변환본이 올라간 뒤에만)
  await bucket.remove([storagePath])
  return { url: pub(newPath), path: newPath, converted: true }
}
