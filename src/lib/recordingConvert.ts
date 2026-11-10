import { spawn } from 'child_process'
import { mkdtemp, writeFile, readFile, rm, access, copyFile, chmod } from 'fs/promises'
import { constants as fsConstants } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { supabaseAdmin } from '@/lib/supabase'

// 녹취는 소리만 들리면 되므로 wav(통화녹음기의 GSM 압축 wav 는 브라우저 재생도 안 됨)는 올릴 때
// 작은 mono mp3 로 바꿔 저장한다. 2분 통화 약 240KB.
// 서버(Linux)에서는 패키지 안의 실행 파일에 실행 권한이 없을 수 있어, 임시 폴더로 복사해 권한을 주고 쓴다
async function getFfmpegPath(): Promise<string> {
  const src = (await import('ffmpeg-static')).default as unknown as string
  if (!src) throw new Error('ffmpeg 를 찾을 수 없습니다')
  if (process.platform === 'win32') return src
  const dest = path.join(tmpdir(), 'ffmpeg-bin')
  try { await access(dest, fsConstants.X_OK); return dest } catch { /* 아직 없음 */ }
  await copyFile(src, dest)
  await chmod(dest, 0o755)
  return dest
}

/** 변환 실패 원인을 DB(settings.recording_convert_errors)에 남긴다 — 서버 로그를 못 볼 때 확인용 */
export async function logConvertError(where: string, err: unknown) {
  try {
    const { data } = await supabaseAdmin.from('settings').select('value').eq('key', 'recording_convert_errors').maybeSingle()
    const items: any[] = data?.value?.items || []
    items.unshift({ at: new Date().toISOString(), where, error: String((err as any)?.message || err).slice(0, 400) })
    await supabaseAdmin.from('settings').upsert({ key: 'recording_convert_errors', value: { items: items.slice(0, 20) } }, { onConflict: 'key' })
  } catch { /* 기록 실패는 무시 */ }
}

export async function convertToMp3(input: Buffer): Promise<Buffer> {
  const ffmpegPath = await getFfmpegPath()
  const dir = await mkdtemp(path.join(tmpdir(), 'rec-'))
  const inFile = path.join(dir, 'in.wav'), outFile = path.join(dir, 'out.mp3')
  try {
    await writeFile(inFile, input)
    let errTail = ''
    await new Promise<void>((resolve, reject) => {
      const p = spawn(ffmpegPath, ['-y', '-i', inFile, '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '16k', outFile], { stdio: ['ignore', 'ignore', 'pipe'] })
      p.stderr?.on('data', d => { errTail = (errTail + d).slice(-300) })
      p.on('error', reject)
      p.on('close', () => resolve())   // 끝부분 패킷 오류로 0이 아닌 코드가 나와도 출력 파일이 있으면 사용
    })
    const out = await readFile(outFile).catch(() => { throw new Error('변환 파일이 만들어지지 않음: ' + errTail) })
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

/** 녹취 공개 URL 이 재생 불가 wav 면 mp3 로 바꾼 URL 을 돌려준다 (실패하면 원래 URL + 원인 기록). 접수 때·정리 때 공통으로 쓴다 */
export async function playableUrl(url: string | null | undefined, where = 'playableUrl'): Promise<string> {
  const u = String(url || '')
  const MARK = '/dig-recordings/'
  if (!u || !/\.wav(\?|$)/i.test(u) || !u.includes(MARK)) return u
  try {
    const p = decodeURIComponent(u.slice(u.indexOf(MARK) + MARK.length).split('?')[0])
    return (await ensurePlayableWav(p)).url
  } catch (e) {
    await logConvertError(where, e)
    return u
  }
}
