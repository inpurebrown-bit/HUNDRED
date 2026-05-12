#!/usr/bin/env node
/**
 * migrate-contracted.js
 * 백승협 진행/종료/환불 업체 Excel → API 마이그레이션 스크립트
 *
 * 사용법:
 *   node scripts/migrate-contracted.js           # dry-run (기본값)
 *   node scripts/migrate-contracted.js --upload  # 실제 API 호출
 */

const XLSX = require('xlsx');
const path = require('path');

const IS_UPLOAD = process.argv.includes('--upload');
const BASE_URL = 'http://localhost:3000';

// ── 파일 경로 ──────────────────────────────────────────────────────────────
const EXCEL_BASE = path.join(__dirname, '../../먼데이 전산 자료/관리팀');
const FILES = [
  {
    name: '진행업체',
    path: path.join(EXCEL_BASE, '백승협 진행업체.xlsx'),
    status: 'contracted',
    refunded: false,
  },
  {
    name: '종료업체',
    path: path.join(EXCEL_BASE, '백승협 종료업체.xlsx'),
    status: 'contracted',
    refunded: false,
  },
  {
    name: '환불업체',
    path: path.join(EXCEL_BASE, '백승협 환불업체.xlsx'),
    status: 'contracted',
    refunded: true,
  },
];

// ── 유틸 ───────────────────────────────────────────────────────────────────

/** Excel 날짜 숫자 → YYYY-MM-DD 변환 */
function excelDateToStr(val) {
  if (!val) return null;
  if (typeof val === 'string' && val.includes('-')) return val.slice(0, 10);
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    if (!date) return null;
    const y = date.y;
    const m = String(date.m).padStart(2, '0');
    const d = String(date.d).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).trim() || null;
}

/** 업체명 정규화: 공백 제거, 소문자, 특수문자 제거 */
function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '');
}

/** 숫자값 추출 */
function toNum(val) {
  if (val === '' || val === null || val === undefined) return 0;
  const n = Number(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

// ── Excel 파싱 ─────────────────────────────────────────────────────────────

/**
 * 한 시트에서 실제 업체 행 추출.
 * - 헤더 행: row[0] === 'Name'
 * - 데이터 행: row[0]가 있고, 카테고리 섹션 제목이 아닌 행
 * - 카테고리 섹션 제목 패턴: row[1]~row[5]가 모두 비어 있고 row[0]이 짧은 단어
 */
function parseSheet(ws, fileInfo) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // 진행업체는 헤더 컬럼 위치가 다름 (스크립트 컬럼이 있어서 +1 오프셋)
  // 공통 헤더: Name(0), 신규업체(2), 담당자(3), 계약날짜(13 or 14), 계약금(15 or 16), 입금액(16 or 17), 잔금(24 or 25)
  // 헤더 행에서 컬럼 인덱스를 동적으로 찾아서 처리

  const results = [];

  // 헤더 행 찾기
  let headerRowIdx = -1;
  let colMap = null;

  for (let i = 0; i < raw.length; i++) {
    if (String(raw[i][0]).trim() === 'Name') {
      headerRowIdx = i;
      const headerRow = raw[i];
      colMap = {};
      headerRow.forEach((col, idx) => {
        const c = String(col).trim();
        colMap[c] = idx;
      });
      // 이 헤더 다음 행부터 데이터 행 수집
      let j = i + 1;
      while (j < raw.length) {
        const row = raw[j];
        const nameRaw = String(row[0]).trim();

        // 다음 헤더 또는 섹션 제목이면 스킵 (headerRowIdx 갱신 포함)
        if (nameRaw === 'Name') {
          // 새 헤더 행 – 컬럼맵 갱신
          colMap = {};
          raw[j].forEach((col, idx) => {
            const c = String(col).trim();
            colMap[c] = idx;
          });
          j++;
          continue;
        }

        // 빈 행 스킵
        if (!nameRaw) {
          j++;
          continue;
        }

        // 섹션 구분자 행 스킵 (col[1]~col[5] 모두 빈값이고 이름이 짧은 단어)
        const isSectionTitle =
          String(row[1]).trim() === '' &&
          String(row[2]).trim() === '' &&
          String(row[3]).trim() === '' &&
          String(row[16] ?? row[15] ?? '').trim() === '' &&
          nameRaw.length <= 20 &&
          !nameRaw.includes('(주)') &&
          !nameRaw.match(/[0-9]/);

        if (isSectionTitle) {
          j++;
          continue;
        }

        // 컬럼 인덱스 동적 매핑
        const contractDateIdx = colMap['계약 날짜'] ?? colMap['계약날짜'] ?? -1;
        const feeIdx = colMap['계약금 (부가세 제외)'] ?? colMap['계약금(부가세 제외)'] ?? -1;
        const payIdx = colMap['입금액 (부가세 제외)'] ?? colMap['입금액(부가세 제외)'] ?? -1;
        const unpaidIdx = colMap['미입금액 (부가세 제외)'] ?? colMap['미입금액(부가세 제외)'] ?? -1;
        const managerIdx = colMap['담당자'] ?? 3;
        const bizNameIdx = colMap['신규업체'] ?? 2;

        const bizName = String(row[bizNameIdx] || row[0]).trim();
        const displayName = String(row[0]).trim();

        // 업체명이 없으면 스킵
        if (!bizName && !displayName) {
          j++;
          continue;
        }

        const contractDateRaw = contractDateIdx >= 0 ? row[contractDateIdx] : '';
        const contractFeeRaw = feeIdx >= 0 ? row[feeIdx] : '';
        const paymentRaw = payIdx >= 0 ? row[payIdx] : '';
        const unpaidRaw = unpaidIdx >= 0 ? row[unpaidIdx] : '';
        const managerRaw = managerIdx >= 0 ? row[managerIdx] : '';

        results.push({
          company_name: bizName || displayName,
          display_name: displayName,
          source_file: fileInfo.name,
          status: fileInfo.status,
          refunded: fileInfo.refunded,
          contract_date: excelDateToStr(contractDateRaw),
          contract_fee: contractFeeRaw !== '' ? String(contractFeeRaw) : null,
          payment_amount: toNum(paymentRaw),
          unpaid_amount: toNum(unpaidRaw),
          sales_user_name: String(managerRaw).trim() || '백승협',
        });

        j++;
      }
      break; // 첫 번째 Name 행부터 끝까지 처리 완료
    }
  }

  return results;
}

/** 모든 Excel 파일에서 업체 목록 수집 */
function loadAllCompanies() {
  const all = [];
  for (const f of FILES) {
    const wb = XLSX.readFile(f.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = parseSheet(ws, f);
    console.log(`[${f.name}] ${rows.length}개 업체 로드됨`);
    rows.forEach((r) => all.push(r));
  }
  return all;
}

// ── API 헬퍼 ──────────────────────────────────────────────────────────────

async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function apiPatch(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ── 메인 ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('백승협 계약업체 마이그레이션 스크립트');
  console.log(`모드: ${IS_UPLOAD ? '실제 업로드 (--upload)' : 'DRY-RUN (읽기 전용)'}`);
  console.log('='.repeat(60));
  console.log('');

  // 1. Excel 데이터 로드
  console.log('[1] Excel 파일 파싱 중...');
  const companies = loadAllCompanies();
  console.log(`    총 ${companies.length}개 업체 수집`);
  console.log('');

  // 2. 기존 고객 목록 조회 (dry-run 포함)
  let existingCustomers = [];
  try {
    console.log('[2] 기존 고객 목록 조회 중... GET /api/customers');
    const result = await apiGet('/api/customers');
    existingCustomers = Array.isArray(result)
      ? result
      : result.customers ?? result.data ?? [];
    console.log(`    기존 고객 ${existingCustomers.length}명 조회됨`);
  } catch (err) {
    console.warn(`    [경고] 고객 목록 조회 실패: ${err.message}`);
    console.warn('    서버가 실행 중인지 확인하세요. 매칭 없이 전부 신규 생성으로 처리됩니다.');
  }
  console.log('');

  // 3. 업체명 정규화 맵 생성
  const existingMap = new Map();
  for (const c of existingCustomers) {
    const key = normalizeName(c.company_name || c.name || '');
    if (key) existingMap.set(key, c);
  }

  // 4. 매칭 및 처리 계획 수립
  console.log('[3] 매칭 분석 중...');
  const matched = [];
  const unmatched = [];

  for (const co of companies) {
    const key = normalizeName(co.company_name);
    const existing = existingMap.get(key);
    if (existing) {
      matched.push({ excel: co, existing });
    } else {
      unmatched.push(co);
    }
  }

  console.log(`    매칭 성공: ${matched.length}개`);
  console.log(`    신규 생성: ${unmatched.length}개`);
  console.log('');

  // 5. 처리 계획 출력
  console.log('[4] 처리 계획:');
  console.log('');

  if (matched.length > 0) {
    console.log('  [PATCH - 업데이트 예정]');
    matched.forEach(({ excel, existing }) => {
      console.log(
        `    ✓ ${excel.company_name} (id: ${existing.id}) [${excel.source_file}]` +
          ` → status:${excel.status}${excel.refunded ? '+환불' : ''}` +
          ` 계약금:${excel.contract_fee ?? '-'}` +
          ` 입금:${excel.payment_amount}` +
          ` 잔금:${excel.unpaid_amount}` +
          ` 날짜:${excel.contract_date ?? '-'}` +
          ` 담당:${excel.sales_user_name}`
      );
    });
    console.log('');
  }

  if (unmatched.length > 0) {
    console.log('  [POST - 신규 생성 예정]');
    unmatched.forEach((co) => {
      console.log(
        `    + ${co.company_name} [${co.source_file}]` +
          ` → status:${co.status}${co.refunded ? '+환불' : ''}` +
          ` 계약금:${co.contract_fee ?? '-'}` +
          ` 입금:${co.payment_amount}` +
          ` 잔금:${co.unpaid_amount}` +
          ` 날짜:${co.contract_date ?? '-'}` +
          ` 담당:${co.sales_user_name}`
      );
    });
    console.log('');
  }

  // 6. 실제 API 호출 (--upload 모드)
  if (!IS_UPLOAD) {
    console.log('='.repeat(60));
    console.log('[DRY-RUN] API 호출 없이 종료합니다.');
    console.log('실제 업로드하려면: node scripts/migrate-contracted.js --upload');
    console.log('='.repeat(60));
    printSummary(companies.length, matched.length, unmatched.length);
    return;
  }

  console.log('[5] API 업로드 시작...');
  let patchOk = 0, patchFail = 0;
  let postOk = 0, postFail = 0;

  // PATCH
  for (const { excel, existing } of matched) {
    const body = buildPayload(excel);
    try {
      await apiPatch(`/api/customers/${existing.id}`, body);
      patchOk++;
      console.log(`    [OK] PATCH /api/customers/${existing.id} - ${excel.company_name}`);
    } catch (err) {
      patchFail++;
      console.error(`    [ERR] PATCH ${existing.id} (${excel.company_name}): ${err.message}`);
    }
  }

  // POST
  for (const co of unmatched) {
    const body = buildPayload(co);
    try {
      const created = await apiPost('/api/customers', body);
      postOk++;
      console.log(`    [OK] POST /api/customers → id:${created?.id ?? '?'} - ${co.company_name}`);
    } catch (err) {
      postFail++;
      console.error(`    [ERR] POST (${co.company_name}): ${err.message}`);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('[완료]');
  console.log(`  PATCH 성공: ${patchOk} / 실패: ${patchFail}`);
  console.log(`  POST  성공: ${postOk} / 실패: ${postFail}`);
  printSummary(companies.length, matched.length, unmatched.length);
}

/** API 요청 바디 생성 */
function buildPayload(co) {
  const details = {
    contract_fee: co.contract_fee,
    payment_amount: co.payment_amount,
    unpaid_amount: co.unpaid_amount,
    contract_date: co.contract_date,
    sales_user_name: co.sales_user_name,
  };
  if (co.refunded) {
    details.refunded = true;
  }

  return {
    company_name: co.company_name,
    status: co.status,
    details,
  };
}

function printSummary(total, matched, newCount) {
  console.log('');
  console.log('┌─────────────────────────────┐');
  console.log('│          결과 요약           │');
  console.log('├─────────────────────────────┤');
  console.log(`│  총 업체 수     : ${String(total).padStart(5)}개    │`);
  console.log(`│  매칭 성공      : ${String(matched).padStart(5)}개    │`);
  console.log(`│  신규 생성 대상 : ${String(newCount).padStart(5)}개    │`);
  console.log('└─────────────────────────────┘');
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
