#!/usr/bin/env node
/**
 * migrate-monday.js
 * 먼데이 전산 자료 Excel 파일 → /api/customers 마이그레이션 스크립트
 *
 * 사용법:
 *   node scripts/migrate-monday.js            (dry-run: API 호출 없이 요약만)
 *   node scripts/migrate-monday.js --upload   (실제 API 업로드)
 *   API_URL=http://localhost:3001 node scripts/migrate-monday.js --upload
 */

const XLSX = require('xlsx');
const https = require('https');
const http = require('http');
const path = require('path');

// ──────────────────────────────────────────────
// 설정
// ──────────────────────────────────────────────
const API_URL = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const DRY_RUN = !process.argv.includes('--upload');
const BASE_DIR = path.resolve(__dirname, '../../먼데이 전산 자료');

const FILES = {
  // ── 김윤지 ──────────────────────────────────
  kimYunji_incall:    path.join(BASE_DIR, '영업팀/김윤지/김윤지 인콜일지.xlsx'),
  kimYunji_result:    path.join(BASE_DIR, '영업팀/김윤지/김윤지 인콜 결과.xlsx'),
  kimYunji_reject:    path.join(BASE_DIR, '영업팀/김윤지/김윤지 거절DB.xlsx'),
  kimYunji_selfrej:   path.join(BASE_DIR, '영업팀/김윤지/김윤지 자체거절DB.xlsx'),
  kimYunji_sales:     path.join(BASE_DIR, '영업팀/김윤지/김윤지 매출.xlsx'),
  // ── 손제후 ──────────────────────────────────
  sonJehu_incall:     path.join(BASE_DIR, '영업팀/손제후/손제후 인콜일지.xlsx'),
  sonJehu_result:     path.join(BASE_DIR, '영업팀/손제후/손제후 인콜 결과.xlsx'),
  sonJehu_reject:     path.join(BASE_DIR, '영업팀/손제후/손제후 거절DB.xlsx'),
  sonJehu_selfrej:    path.join(BASE_DIR, '영업팀/손제후/손제후 자체거절DB.xlsx'),
  sonJehu_sales:      path.join(BASE_DIR, '영업팀/손제후/손제후 매출.xlsx'),
  // ── 백승협 ──────────────────────────────────
  baekSeunghyup_incall: path.join(BASE_DIR, '영업팀/백승협/백승협 인콜일지.xlsx'),
  baek_active:        path.join(BASE_DIR, '관리팀/백승협 진행업체.xlsx'),
  baek_closed:        path.join(BASE_DIR, '관리팀/백승협 종료업체.xlsx'),
  baek_refund:        path.join(BASE_DIR, '관리팀/백승협 환불업체.xlsx'),
  // ── 대표 ────────────────────────────────────
  as_list:            path.join(BASE_DIR, '대표/as 목록.xlsx'),
};

// ──────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────

/** Excel 숫자 날짜 → YYYY-MM-DD */
function excelDateToISO(v) {
  if (!v) return '';
  if (typeof v === 'string') {
    // 이미 날짜 문자열인 경우
    const m = v.match(/(\d{4}[-\/]\d{2}[-\/]\d{2})/);
    return m ? m[1].replace(/\//g, '-') : v;
  }
  if (typeof v === 'number' && v > 40000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return '';
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  return String(v);
}

/** 전화번호 정규화: 숫자만 남기고 010XXXXXXXX 형식으로 */
function normalizePhone(v) {
  if (!v) return '';
  const digits = String(v).replace(/[^0-9]/g, '');
  return digits;
}

/** 업체명 정규화 (공백·괄호 제거해서 키로 사용) */
function companyKey(name) {
  if (!name) return '';
  return String(name).trim().replace(/[\s\(\)（）\[\]【】]/g, '').toLowerCase();
}

/** XLSX 파일 읽기 → 첫 번째 시트 JSON rows (헤더 = row[실제헤더행]) */
function readSheet(filePath, sheetIndex = 0) {
  try {
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[sheetIndex]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    return raw;
  } catch (e) {
    console.error(`  [ERROR] 파일 읽기 실패: ${path.basename(filePath)} — ${e.message}`);
    return [];
  }
}

/** rows에서 실제 헤더 행 인덱스 찾기 (Name 컬럼이 있는 행) */
function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (rows[i].includes('Name') || rows[i].includes('name')) return i;
  }
  return 0;
}

/** rows → { header: [], data: [{...}] } */
function parseRows(rows) {
  const hi = findHeaderRow(rows);
  const header = rows[hi];
  const data = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;
    const obj = {};
    header.forEach((h, idx) => {
      if (h && h !== '') obj[h] = row[idx] !== undefined ? row[idx] : '';
    });
    data.push(obj);
  }
  return { header, data };
}

// ──────────────────────────────────────────────
// 파일별 파서
// ──────────────────────────────────────────────

/**
 * 인콜일지 (신규 DB) 파서
 * status: 'lead'
 */
function parseIncallLog(filePath, salesUserName) {
  const rows = readSheet(filePath);
  const { data } = parseRows(rows);
  const results = [];

  for (const r of data) {
    const company = String(r['Name'] || '').trim();
    if (!company) continue;

    const phone = normalizePhone(r['전화번호'] || '');
    const region = String(r['지역'] || '').trim();
    const rep = String(r['이름'] || '').trim();
    const receptionRaw = r['접수일자'] || r['접수일'] || '';
    const receptionDate = excelDateToISO(receptionRaw);
    const businessType = String(r['업종'] || '').trim();
    const realWork = String(r['실제하는일'] || '').trim();
    const notes = String(r['통화내용'] || '').trim();
    const solution = String(r['솔루션'] || '').trim();
    const innovation = String(r['혁신성장요건'] || '').trim();
    const patent = String(r['특허 등 지식재산권'] || '').trim();
    const empCount = String(r['4대보험가입자 명수'] || '').trim();
    const rev2026 = String(r['2026년도 매출'] || '').trim();
    const rev2025 = String(r['2025년도 매출'] || '').trim();
    const rev2024 = String(r['2024년도 매출'] || '').trim();
    const rev2023 = String(r['2023년도 매출'] || '').trim();
    const loanKibo = String(r['기보 기대출'] || '').trim();
    const loanShinbo = String(r['신보 기대출'] || '').trim();
    const loanJaedan = String(r['재단 기대출'] || '').trim();
    const loanJinjong = String(r['중진공 기대출'] || '').trim();
    const loanSojin = String(r['소진공 기대출'] || '').trim();
    const loanCredit = String(r['이외 신용/담보 대출'] || '').trim();
    const loanTotal = String(r['기대출 합계'] || '').trim();
    const kcb = String(r['KCB 점수'] || '').trim();
    const nice = String(r['NICE 점수'] || '').trim();
    const taxStatus = String(r['세금체납 상태'] || '').trim();
    const assets = String(r['자산'] || '').trim();
    const required = String(r['필요자금'] || '').trim();

    results.push({
      company,
      phone,
      name: rep,
      status: 'lead',
      notes,
      details: {
        sales_user_name: salesUserName,
        reception_date: receptionDate,
        region,
        business_type: businessType,
        real_work: realWork,
        innovation,
        patent,
        employee_count: empCount,
        revenue_2026: rev2026,
        revenue_2025: rev2025,
        revenue_2024: rev2024,
        revenue_2023: rev2023,
        loan_kibo: loanKibo,
        loan_shinbo: loanShinbo,
        loan_jaedan: loanJaedan,
        loan_jinjong: loanJinjong,
        loan_sojin: loanSojin,
        loan_credit: loanCredit,
        loan_total: loanTotal,
        credit_kcb: kcb,
        credit_nice: nice,
        tax_status: taxStatus,
        assets,
        required_funds: required,
        solution,
      },
    });
  }
  return results;
}

/**
 * 인콜 결과 파서
 * status 갱신 소스 (결정전 결과, 클로징 결과, 재통화 일정 등)
 */
function parseIncallResult(filePath) {
  const rows = readSheet(filePath);
  const { data } = parseRows(rows);
  const map = new Map(); // company key → 추가 details

  for (const r of data) {
    const company = String(r['Name'] || '').trim();
    if (!company) continue;
    const ck = companyKey(company);
    const phone = normalizePhone(r['전화번호'] || '');
    const callResult = String(r['결정전 결과'] || '').trim();
    const closingResult = String(r['클로징 결과'] || '').trim();
    const followUpRaw = r['재통화 일정'] || '';
    const followUpDate = excelDateToISO(followUpRaw);
    const notes = String(r['내용'] || '').trim();
    const asRequested = String(r['a/s 요청'] || '').trim() !== '';

    map.set(ck, {
      phone,
      company,
      call_result: callResult,
      closing_result: closingResult,
      follow_up_date: followUpDate,
      result_memo: notes,
      as_requested: asRequested,
    });
  }
  return map;
}

/**
 * 거절DB 파서  → status: 'emotional'
 */
function parseRejectDB(filePath, salesUserName) {
  const rows = readSheet(filePath);
  const { data } = parseRows(rows);
  const results = [];

  for (const r of data) {
    const company = String(r['Name'] || '').trim();
    if (!company) continue;
    const phone = normalizePhone(r['전화번호'] || '');
    const region = String(r['지역'] || '').trim();
    const businessType = String(r['업종'] || '').trim();
    const notes = String(r['내용'] || '').trim();
    const innovation = String(r['혁신성장요건'] || '').trim();

    results.push({
      company,
      phone,
      name: '',
      status: 'emotional',
      notes,
      details: {
        sales_user_name: salesUserName,
        region,
        business_type: businessType,
        innovation,
      },
    });
  }
  return results;
}

/**
 * 자체거절DB 파서 → status: 'trash'
 */
function parseSelfRejectDB(filePath, salesUserName) {
  const rows = readSheet(filePath);
  const { data } = parseRows(rows);
  const results = [];

  for (const r of data) {
    const company = String(r['Name'] || '').trim();
    if (!company) continue;
    const phone = normalizePhone(r['전화번호'] || '');
    const region = String(r['지역'] || '').trim();
    const businessType = String(r['업종'] || '').trim();
    const notes = String(r['내용'] || '').trim();

    results.push({
      company,
      phone,
      name: '',
      status: 'trash',
      notes,
      details: {
        sales_user_name: salesUserName,
        region,
        business_type: businessType,
      },
    });
  }
  return results;
}

/**
 * 매출 파일 파서 → status: 'contracted' 소스
 * 계약금 있으면 contracted
 */
function parseSalesFile(filePath, salesUserName) {
  const rows = readSheet(filePath);
  const { data } = parseRows(rows);
  const map = new Map(); // companyKey → sales details

  for (const r of data) {
    const company = String(r['Name'] || '').trim();
    if (!company) continue;

    const contractDateRaw = r['계약일'] || '';
    const contractDate = excelDateToISO(contractDateRaw);
    const paymentAmount = r['입금액'] || r['입금액(부가세포함)'] || '';
    const myRevenue = r['본인매출'] || '';
    const contractFee = r['계약금 (부가세 제외)'] || r['계약금'] || paymentAmount || '';

    const ck = companyKey(company);
    map.set(ck, {
      company,
      sales_user_name: salesUserName,
      contract_fee: contractFee ? String(contractFee) : '',
      payment_amount: paymentAmount ? String(paymentAmount) : '',
      my_revenue: myRevenue ? String(myRevenue) : '',
      reception_date: contractDate,
    });
  }
  return map;
}

/**
 * 백승협 진행/종료/환불 업체 파서 → status: 'contracted'
 */
function parseManagedFile(filePath) {
  const rows = readSheet(filePath);
  const { data } = parseRows(rows);
  const results = [];

  for (const r of data) {
    const company = String(r['Name'] || '').trim();
    if (!company) continue;

    const salesUser = String(r['담당자'] || '').trim();
    const region = String(r['지역'] || '').trim();
    const currentStatus = String(r['현재 진행 상태'] || '').trim();
    const contractDateRaw = r['계약 날짜'] || '';
    const contractDate = excelDateToISO(contractDateRaw);
    const contractFee = r['계약금 (부가세 제외)'] || '';
    const paymentAmount = r['입금액 (부가세 제외)'] || '';
    const totalRevenue = r['총 매출'] || '';
    const notes = String(r['계약 특이사항(계약팀에서 전달)'] || r['이전 접수 내용'] || '').trim();

    results.push({
      company,
      phone: '',
      name: '',
      status: 'contracted',
      notes,
      details: {
        sales_user_name: salesUser,
        region,
        reception_date: contractDate,
        contract_fee: contractFee ? String(contractFee) : '',
        payment_amount: paymentAmount ? String(paymentAmount) : '',
        cumulative_revenue: totalRevenue ? String(totalRevenue) : '',
        call_result: currentStatus,
      },
    });
  }
  return results;
}

/**
 * A/S 목록 파서 → as_requested: true
 */
function parseASList(filePath) {
  const rows = readSheet(filePath);
  const { data } = parseRows(rows);
  const map = new Map(); // companyKey → as info

  for (const r of data) {
    const company = String(r['Name'] || '').trim();
    if (!company) continue;
    const ck = companyKey(company);
    const asResult = String(r['a/s 요청 결과'] || '').trim();
    const phone = normalizePhone(r['전화번호'] || '');
    const notes = String(r['내용'] || '').trim();

    map.set(ck, {
      company,
      phone,
      as_requested: true,
      inspection_status: asResult,
      result_memo: notes,
    });
  }
  return map;
}

// ──────────────────────────────────────────────
// 상태 우선순위
// ──────────────────────────────────────────────
const STATUS_PRIORITY = {
  contracted: 4,
  emotional: 3,
  lead: 2,
  db010: 1,
  trash: 0,
};

function higherStatus(a, b) {
  return (STATUS_PRIORITY[a] ?? -1) >= (STATUS_PRIORITY[b] ?? -1) ? a : b;
}

// ──────────────────────────────────────────────
// 중복 제거 & 머지
// ──────────────────────────────────────────────

/**
 * 고객 Map에 entry를 머지/추가
 * - 동일 업체명 키가 있으면 status 높은 것 유지, details 보완
 * - phone이 비어있으면 기존 것 유지
 */
function mergeInto(map, entry) {
  const ck = companyKey(entry.company);
  if (!ck) return;

  if (!map.has(ck)) {
    map.set(ck, { ...entry });
    return;
  }

  const existing = map.get(ck);

  // status: 더 높은 것
  existing.status = higherStatus(existing.status, entry.status);

  // phone: 비어있으면 새 값
  if (!existing.phone && entry.phone) existing.phone = entry.phone;

  // name: 비어있으면 새 값
  if (!existing.name && entry.name) existing.name = entry.name;

  // notes: 비어있으면 새 값, 있으면 append
  if (entry.notes) {
    existing.notes = existing.notes
      ? existing.notes + '\n---\n' + entry.notes
      : entry.notes;
  }

  // details: 필드별로 비어있으면 채움
  if (entry.details) {
    existing.details = existing.details || {};
    for (const [k, v] of Object.entries(entry.details)) {
      if (v !== '' && v !== null && v !== undefined && !existing.details[k]) {
        existing.details[k] = v;
      }
    }
  }
}

// ──────────────────────────────────────────────
// API 호출
// ──────────────────────────────────────────────

function postCustomer(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const url = new URL(`${API_URL}/api/customers`);
    const lib = url.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); }
            catch { resolve(data); }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ──────────────────────────────────────────────
// 메인
// ──────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('먼데이 전산 자료 마이그레이션 스크립트');
  console.log(`모드: ${DRY_RUN ? 'DRY-RUN (--upload 플래그 없음)' : '실제 업로드'}`);
  console.log(`API: ${API_URL}`);
  console.log('='.repeat(60));

  // ── 1. 전체 고객 Map (companyKey → customer entry)
  const customerMap = new Map();

  // ── 2. 인콜일지 (lead)
  console.log('\n[1/8] 인콜일지 읽는 중...');
  const incallSources = [
    { file: FILES.kimYunji_incall,       user: '김윤지' },
    { file: FILES.sonJehu_incall,        user: '손제후' },
    { file: FILES.baekSeunghyup_incall,  user: '백승협' },
  ];
  for (const src of incallSources) {
    const entries = parseIncallLog(src.file, src.user);
    console.log(`  ${path.basename(src.file)}: ${entries.length}건`);
    entries.forEach(e => mergeInto(customerMap, e));
  }

  // ── 3. 거절DB (emotional)
  console.log('\n[2/8] 거절DB 읽는 중...');
  const rejectSources = [
    { file: FILES.kimYunji_reject,  user: '김윤지' },
    { file: FILES.sonJehu_reject,   user: '손제후' },
  ];
  for (const src of rejectSources) {
    const entries = parseRejectDB(src.file, src.user);
    console.log(`  ${path.basename(src.file)}: ${entries.length}건`);
    entries.forEach(e => mergeInto(customerMap, e));
  }

  // ── 4. 자체거절DB (trash)
  console.log('\n[3/8] 자체거절DB 읽는 중...');
  const selfRejectSources = [
    { file: FILES.kimYunji_selfrej,  user: '김윤지' },
    { file: FILES.sonJehu_selfrej,   user: '손제후' },
  ];
  for (const src of selfRejectSources) {
    const entries = parseSelfRejectDB(src.file, src.user);
    console.log(`  ${path.basename(src.file)}: ${entries.length}건`);
    entries.forEach(e => mergeInto(customerMap, e));
  }

  // ── 5. 인콜 결과 → details 보완
  console.log('\n[4/8] 인콜 결과 읽는 중...');
  const resultSources = [
    { file: FILES.kimYunji_result, user: '김윤지' },
    { file: FILES.sonJehu_result,  user: '손제후' },
  ];
  for (const src of resultSources) {
    const resultMap = parseIncallResult(src.file);
    console.log(`  ${path.basename(src.file)}: ${resultMap.size}건`);
    for (const [ck, rd] of resultMap) {
      if (customerMap.has(ck)) {
        const ex = customerMap.get(ck);
        if (!ex.phone && rd.phone) ex.phone = rd.phone;
        ex.details = ex.details || {};
        if (rd.call_result)    ex.details.call_result    = ex.details.call_result    || rd.call_result;
        if (rd.closing_result) ex.details.closing_result = ex.details.closing_result || rd.closing_result;
        if (rd.follow_up_date) ex.details.follow_up_date = ex.details.follow_up_date || rd.follow_up_date;
        if (rd.result_memo)    ex.details.result_memo    = ex.details.result_memo    || rd.result_memo;
        if (rd.as_requested)   ex.details.as_requested   = true;
      } else {
        // 결과만 있고 인콜일지 없는 케이스 → lead로 추가
        customerMap.set(ck, {
          company: rd.company,
          phone: rd.phone,
          name: '',
          status: 'lead',
          notes: rd.result_memo || '',
          details: {
            sales_user_name: src.user,
            call_result: rd.call_result,
            closing_result: rd.closing_result,
            follow_up_date: rd.follow_up_date,
            as_requested: rd.as_requested,
          },
        });
      }
    }
  }

  // ── 6. 매출 파일 → contracted 갱신
  console.log('\n[5/8] 매출 파일 읽는 중...');
  const salesSources = [
    { file: FILES.kimYunji_sales, user: '김윤지' },
    { file: FILES.sonJehu_sales,  user: '손제후' },
  ];
  for (const src of salesSources) {
    const salesMap = parseSalesFile(src.file, src.user);
    console.log(`  ${path.basename(src.file)}: ${salesMap.size}건`);
    for (const [ck, sd] of salesMap) {
      if (customerMap.has(ck)) {
        const ex = customerMap.get(ck);
        ex.status = 'contracted'; // 매출 있으면 contracted
        ex.details = ex.details || {};
        if (sd.contract_fee)    ex.details.contract_fee    = sd.contract_fee;
        if (sd.payment_amount)  ex.details.payment_amount  = sd.payment_amount;
        if (sd.my_revenue)      ex.details.my_revenue      = sd.my_revenue;
        if (sd.reception_date && !ex.details.reception_date)
          ex.details.reception_date = sd.reception_date;
      } else {
        // 매출에만 있는 업체
        customerMap.set(ck, {
          company: sd.company,
          phone: '',
          name: '',
          status: 'contracted',
          notes: '',
          details: {
            sales_user_name: sd.sales_user_name,
            reception_date: sd.reception_date,
            contract_fee: sd.contract_fee,
            payment_amount: sd.payment_amount,
            my_revenue: sd.my_revenue,
          },
        });
      }
    }
  }

  // ── 7. 관리팀 진행/종료/환불 업체 → contracted
  console.log('\n[6/8] 관리팀 파일 읽는 중...');
  const managedSources = [
    FILES.baek_active,
    FILES.baek_closed,
    FILES.baek_refund,
  ];
  for (const f of managedSources) {
    const entries = parseManagedFile(f);
    console.log(`  ${path.basename(f)}: ${entries.length}건`);
    entries.forEach(e => mergeInto(customerMap, e));
  }

  // ── 8. A/S 목록 → as_requested 플래그
  console.log('\n[7/8] A/S 목록 읽는 중...');
  const asMap = parseASList(FILES.as_list);
  console.log(`  as 목록.xlsx: ${asMap.size}건`);
  for (const [ck, ad] of asMap) {
    if (customerMap.has(ck)) {
      const ex = customerMap.get(ck);
      ex.details = ex.details || {};
      ex.details.as_requested = true;
      if (ad.inspection_status) ex.details.inspection_status = ad.inspection_status;
      if (!ex.phone && ad.phone) ex.phone = ad.phone;
      if (ad.result_memo) ex.details.result_memo = ex.details.result_memo || ad.result_memo;
    } else {
      customerMap.set(ck, {
        company: ad.company,
        phone: ad.phone,
        name: '',
        status: 'lead',
        notes: ad.result_memo || '',
        details: {
          as_requested: true,
          inspection_status: ad.inspection_status,
        },
      });
    }
  }

  // ──────────────────────────────────────────────
  // 요약 리포트
  // ──────────────────────────────────────────────
  const allCustomers = Array.from(customerMap.values());

  console.log('\n' + '='.repeat(60));
  console.log('요약 리포트');
  console.log('='.repeat(60));
  console.log(`전체 업체 수 (중복 제거): ${allCustomers.length}개`);

  // 담당자별
  const byUser = {};
  for (const c of allCustomers) {
    const u = c.details?.sales_user_name || '미분류';
    byUser[u] = (byUser[u] || 0) + 1;
  }
  console.log('\n담당자별 업체 수:');
  for (const [u, cnt] of Object.entries(byUser).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${u}: ${cnt}개`);
  }

  // 상태별
  const byStatus = {};
  for (const c of allCustomers) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  }
  console.log('\n상태별 업체 수:');
  for (const [s, cnt] of Object.entries(byStatus).sort((a,b) => (STATUS_PRIORITY[b]??-1)-(STATUS_PRIORITY[a]??-1))) {
    console.log(`  ${s}: ${cnt}개`);
  }

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] 실제 API 호출 없음. --upload 플래그를 추가하면 업로드됩니다.');
    console.log('\n샘플 (처음 3건):');
    allCustomers.slice(0, 3).forEach((c, i) => {
      console.log(`\n  [${i+1}] ${c.company} | ${c.status} | 전화:${c.phone || '-'}`);
      console.log(`       담당:${c.details?.sales_user_name || '-'} | 접수:${c.details?.reception_date || '-'}`);
    });
    return;
  }

  // ──────────────────────────────────────────────
  // API 업로드
  // ──────────────────────────────────────────────
  console.log('\n[8/8] API 업로드 시작...');
  let success = 0;
  let failed = 0;
  const errors = [];

  for (const c of allCustomers) {
    const payload = {
      name:    c.name || c.company,   // 대표자명 없으면 업체명으로
      phone:   c.phone || '',
      company: c.company,
      status:  c.status,
      notes:   c.notes  || '',
      details: c.details || {},
    };

    try {
      await postCustomer(payload);
      success++;
      if (success % 10 === 0) {
        process.stdout.write(`\r  진행: ${success}/${allCustomers.length} (실패: ${failed})`);
      }
    } catch (e) {
      failed++;
      errors.push({ company: c.company, error: e.message });
      console.error(`\n  [FAIL] ${c.company}: ${e.message}`);
    }
  }

  console.log(`\n\n완료: 성공 ${success}건 / 실패 ${failed}건 / 전체 ${allCustomers.length}건`);

  if (errors.length > 0) {
    console.log('\n실패 목록:');
    errors.forEach(e => console.log(`  - ${e.company}: ${e.error}`));
  }
}

main().catch(e => {
  console.error('\n[FATAL]', e.message);
  process.exit(1);
});
