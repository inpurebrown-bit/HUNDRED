// 보고서 지식 폴더 → 정책자금 지식베이스(JSON) 생성 (로컬 1회 실행용)
// 사용: KB_TXT_DIR=<텍스트 추출 폴더> node scripts/build-policy-kb.js <출력 json 경로>
const fs = require('fs'), path = require('path')
const { GoogleGenerativeAI } = require('@google/generative-ai')
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim() })
const ROOT = 'C:/Users/user/Desktop/박원태/보고서 지식'
const TXT = process.env.KB_TXT_DIR
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite-preview']

const txt = (names) => names.map(n => { const f = path.join(TXT, n + '.txt'); return fs.existsSync(f) ? `\n=== 문서: ${n} ===\n` + fs.readFileSync(f, 'utf8') : '' }).join('\n')
const imgs = (dir, list) => list.map(n => ({ inlineData: { mimeType: 'image/png', data: fs.readFileSync(path.join(ROOT, dir, n)).toString('base64') } }))
const ls = (dir, ext) => fs.readdirSync(path.join(ROOT, dir)).filter(f => f.toLowerCase().endsWith(ext))
const allTxt = (prefix) => fs.readdirSync(TXT).filter(f => f.startsWith(prefix)).map(f => f.replace(/\.txt$/, ''))
const chunk = (name, size) => { const t = fs.readFileSync(path.join(TXT, name + '.txt'), 'utf8'); const r = []; for (let i = 0; i < t.length; i += size) r.push(t.slice(i, i + size)); return r }

const SCHEMA = `[출력] JSON 배열만. 각 원소:
{"org":"기관명","name":"상품/자금명","category":"운전|시설|보증|이차보전|인증|기타","purpose":"목적 1줄","eligibility":["신청대상·요건(업력, 업종, 매출, 신용, 고용 등 수치 포함)"],"exclusions":["융자/보증 제한·제외 사유"],"limit":"한도","rate":"금리/보증료","term":"기간(거치 포함)","method":"직접대출/대리대출/보증서 등","applyPeriod":"접수시기·차수","docs":["제출서류(있으면)"],"source":"근거 문서명(공고번호·날짜 포함)","notes":"특이사항"}
[규칙] 문서에 적힌 내용만 사용하고 추측·보충 금지. 없는 항목은 빈 문자열/빈 배열. 수치·요건은 원문 그대로. 같은 상품은 하나로 합치되 하위 유형(일반형/혁신형 등)은 별도 원소.`

async function ask(label, parts) {
  for (const m of MODELS) {
    for (let a = 0; a < 6; a++) {
      try {
        const model = genAI.getGenerativeModel({ model: m, generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 60000 } })
        const r = await model.generateContent(parts)
        const t = r.response.text().trim().replace(/^```(?:json)?/i, '').replace(/```$/, '')
        const j = JSON.parse(t)
        console.log('OK', label, m, j.length)
        return j
      } catch (e) {
        const msg = String(e.message)
        console.log('retry', label, m, a, msg.replace(/^.*\]: /, '').slice(0, 90))
        if (/404|no longer/i.test(msg)) break
        await new Promise(r => setTimeout(r, 6000 * (a + 1)))
      }
    }
  }
  console.log('FAIL', label)
  return []
}

;(async () => {
  const jobs = []
  allTxt('소진공 공문__').forEach((n, i) => jobs.push(['소진공-' + (i + 1), [
    { text: `소상공인시장진흥공단(소진공) 2026년 정책자금 문서 1건입니다(문서명: ${n}). 이 문서에 나오는 모든 자금(일반형/희망형/도약형/혁신형 등 세부 유형은 각각 별도 원소)을 빠짐없이 추출하고, 융자제한·제외 사유, 신청·제출서류, 평가 방식을 exclusions/docs/notes에 상세히 넣으세요.\n${SCHEMA}` },
    { text: txt([n]) }]]))
  allTxt('중진공 공문__').forEach((n, i) => chunk(n, 22000).forEach((c, k) => jobs.push(['중진공-' + (i + 1) + '-' + (k + 1), [
    { text: `중소벤처기업진흥공단(중진공) 2026년 정책자금 문서(${n})의 일부 구간입니다. 이 구간에 나오는 모든 자금·제도·한도·금리 규정·융자제한 사유를 빠짐없이 추출하세요(사업별 자금은 각각 별도 원소, 공통 규정은 org:"중진공" name:"공통규정-주제"). 구간 경계에서 잘린 내용은 보이는 만큼만.\n${SCHEMA}` },
    { text: `=== ${n} 구간 ${k + 1} ===\n${c}` }]])))
  jobs.push(['서울재단+로드맵', [
    { text: `서울신용보증재단 중소기업육성자금 공고, 정책자금 로드맵·기초 교육자료입니다. 상품별로 추출하고, 로드맵·교육자료의 진행 순서·요령은 org:"공통" name:"진행 로드맵/요령-주제" 항목으로 요약하세요.\n${SCHEMA}` },
    { text: txt(['재단 자료__서울재단__2026년 중소기업육성자금 융자지원 변경계획 공고문(260504).pdf', '정책자금(신규로드맵).pdf', '정부지원사업_로드맵.pdf', '4. 정부지원 및 인증 사업 로드맵.pdf', '접수시 요령.txt', '2. 무상지원금 로드맵.pdf', '교육자료_수탁 미소 재도전 도자금.pdf', '각기관 2.pdf']) }]])
  jobs.push(['기보', [
    { text: `기술보증기금(기보) 프로그램 자료(텍스트+이미지)입니다. 각 보증/프로그램을 빠짐없이 추출하세요.\n${SCHEMA}` },
    { text: txt(allTxt('기보 자료__')) }, ...imgs('기보 자료', ls('기보 자료', '.png'))]])
  const shinbo = ls('신보 자료', '.png')
  for (let i = 0; i < shinbo.length; i += 3) jobs.push(['신보-' + (i / 3 + 1), [
    { text: `신용보증기금(신보) 자료(이미지)입니다. 보이는 보증 상품·요건·한도·보증료 등을 빠짐없이 추출하세요.\n${SCHEMA}` }, ...imgs('신보 자료', shinbo.slice(i, i + 3))]])
  jobs.push(['농신보', [{ text: `농림수산업자신용보증기금(농신보) 자료(이미지)입니다.\n${SCHEMA}` }, ...imgs('농신보', ls('농신보', '.png'))]])
  const gg = ls('재단 자료/경기재단', '.png')
  for (let i = 0; i < gg.length; i += 4) jobs.push(['경기재단-' + (i / 4 + 1), [
    { text: `경기신용보증재단 자료(이미지)입니다. 상품·요건·한도·보증료를 빠짐없이 추출하세요.\n${SCHEMA}` }, ...imgs('재단 자료/경기재단', gg.slice(i, i + 4))]])
  const others = ls('재단 자료/그외 재단', '.png')
  for (let i = 0; i < others.length; i += 3) jobs.push(['그외재단-' + (i / 3 + 1), [
    { text: `지역신용보증재단 자료(이미지, 파일명=${others.slice(i, i + 3).join(', ')})입니다. org에 해당 지역 신용보증재단명을 쓰고 상품·요건·한도·보증료를 빠짐없이 추출하세요.\n${SCHEMA}` }, ...imgs('재단 자료/그외 재단', others.slice(i, i + 3))]])
  jobs.push(['무보', [{ text: `한국무역보험공사 수출신용보증 자료입니다. 상품을 추출하세요.\n${SCHEMA}` }, { text: txt(allTxt('무보__')) }]])

  const out = {}
  let idx = 0
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (idx < jobs.length) { const [k, parts] = jobs[idx++]; out[k] = await ask(k, parts) }
  }))
  fs.writeFileSync(process.argv[2] || 'scripts/policy-kb.raw.json', JSON.stringify(out, null, 1))
  console.log(Object.entries(out).map(([k, v]) => k + ':' + v.length).join(' '))
})()
