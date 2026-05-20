'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────

interface Loan {
  id: string
  amount: number
  rate: number
  institution: string
  bank: string
  repayment_type: string
  repayment_day: string
  p1_principal: number
  p1_interest: number
  p1_monthly: number
  p2_same: boolean
  p2_principal: number
  p2_interest: number
  p2_monthly: number
  memo: string
  goal: string
}

interface Subscription {
  id: string
  name: string
  cycle: string
  last_date: string
  next_date: string
  monthly_amount: number
  annual_amount: number
  memo: string
  payment_route: string
  corp_card: boolean
}

// ─── 기본 데이터 ──────────────────────────────────────────

const DEFAULT_LOANS: Loan[] = [
  {
    id: '1', amount: 20000000, rate: 2.90, institution: '재단', bank: '신한',
    repayment_type: '2년거치', repayment_day: '매월 20일',
    p1_principal: 0, p1_interest: 49000, p1_monthly: 49000,
    p2_same: false, p2_principal: 340000, p2_interest: 490000, p2_monthly: 390000,
    memo: '2,5,8,11월에 3개월주기 상환이나 머리아프니까 다달이 넣어놓기\n대출금의 70%만 내고 2033만 만기때 30퍼인 720만원 내기',
    goal: '28년 1월까지 5천 상환 목표 = 2년동안 5전 = 1년에 2,500 = 1달에 200',
  },
  {
    id: '2', amount: 30000000, rate: 4.56, institution: '신보', bank: '소진공(기업)',
    repayment_type: '2년거치', repayment_day: '매월 11일',
    p1_principal: 0, p1_interest: 114000, p1_monthly: 114000,
    p2_same: false, p2_principal: 500000, p2_interest: 114000, p2_monthly: 614000,
    memo: '', goal: '',
  },
  {
    id: '3', amount: 18000000, rate: 6.23, institution: '서민금융', bank: 'ibk저축',
    repayment_type: '매월상환', repayment_day: '매월 18일',
    p1_principal: 333333, p1_interest: 84831, p1_monthly: 420000,
    p2_same: true, p2_principal: 0, p2_interest: 0, p2_monthly: 0,
    memo: '재단결로 밀려왔으나 사업 확장위해 예비비로 일단 두기로 결정\n가능하면 4-5월중 밀 예정',
    goal: '',
  },
]

const DEFAULT_SUBS: Subscription[] = [
  { id:'s1',  name:'독서탈(개인)',    cycle:'1달', last_date:'2026-03-13', next_date:'2026-04-13', monthly_amount:990,   annual_amount:0,      memo:'왜싸지?',                payment_route:'본폰 요금',           corp_card:false },
  { id:'s2',  name:'독서탈(회사)',    cycle:'1달', last_date:'2026-03-16', next_date:'2026-04-16', monthly_amount:2900,  annual_amount:0,      memo:'30GB',                   payment_route:'',                    corp_card:true  },
  { id:'s3',  name:'컬러링',          cycle:'',    last_date:'',           next_date:'',           monthly_amount:990,   annual_amount:0,      memo:'휴대폰요금에 나오는도',   payment_route:'',                    corp_card:false },
  { id:'s4',  name:'미리캔버스',      cycle:'1년', last_date:'2025-11-28', next_date:'2026-11-28', monthly_amount:13400, annual_amount:160800, memo:'pro 요금제',             payment_route:'',                    corp_card:true  },
  { id:'s5',  name:'캡컷',            cycle:'1년', last_date:'2025-10-21', next_date:'2026-10-21', monthly_amount:14833, annual_amount:178000, memo:'pro 요금제',             payment_route:'',                    corp_card:true  },
  { id:'s6',  name:'GPT',             cycle:'1달', last_date:'2026-03-13', next_date:'2026-04-13', monthly_amount:29000, annual_amount:0,      memo:'Plus',                   payment_route:'',                    corp_card:false },
  { id:'s7',  name:'애들뮤직',        cycle:'1달', last_date:'2026-03-12', next_date:'2026-04-12', monthly_amount:14900, annual_amount:0,      memo:'유튜브프리미엄',          payment_route:'',                    corp_card:false },
  { id:'s8',  name:'루팡',            cycle:'1달', last_date:'2026-02-28', next_date:'2026-03-31', monthly_amount:7890,  annual_amount:0,      memo:'',                       payment_route:'',                    corp_card:false },
  { id:'s9',  name:'모두싸인',        cycle:'1년', last_date:'2025-09-30', next_date:'2026-09-29', monthly_amount:31900, annual_amount:382800, memo:'요금제 team 1년',        payment_route:'',                    corp_card:true  },
  { id:'s10', name:'넷플릭스',        cycle:'1달', last_date:'2026-02-27', next_date:'2026-03-27', monthly_amount:17000, annual_amount:0,      memo:'원태량 반반',             payment_route:'현대카드',            corp_card:false },
  { id:'s11', name:'웨이브',          cycle:'1달', last_date:'2026-03-14', next_date:'2026-04-14', monthly_amount:12500, annual_amount:0,      memo:'',                       payment_route:'',                    corp_card:false },
  { id:'s12', name:'대표번호',        cycle:'1달', last_date:'2026-04-20', next_date:'2026-05-20', monthly_amount:11000, annual_amount:0,      memo:'1688-1000 (세종네트워크)', payment_route:'기업카드(사업자체크)', corp_card:true  },
  { id:'s13', name:'업무폰 통신료',   cycle:'1달', last_date:'2026-02-28', next_date:'2026-03-31', monthly_amount:17000, annual_amount:0,      memo:'2월 1달요금',             payment_route:'현대카드',            corp_card:true  },
  { id:'s14', name:'아이클라우드',    cycle:'1달', last_date:'2026-03-01', next_date:'2026-04-01', monthly_amount:1100,  annual_amount:0,      memo:'50GB',                   payment_route:'',                    corp_card:false },
  { id:'s15', name:'클로드',          cycle:'1달', last_date:'2026-05-01', next_date:'2026-06-01', monthly_amount:30000, annual_amount:0,      memo:'',                       payment_route:'',                    corp_card:false },
  { id:'s16', name:'네이버클라우드',  cycle:'1년', last_date:'2025-10-18', next_date:'2026-10-18', monthly_amount:2750,  annual_amount:33000,  memo:'180GB',                  payment_route:'',                    corp_card:false },
]

// ─── 유틸 ─────────────────────────────────────────────────

function won(n: number) { return n > 0 ? n.toLocaleString('ko-KR') + '원' : '-' }
function fmtI(n: number) { return n > 0 ? n.toLocaleString('ko-KR') : '' }
function parseN(s: string) { return parseInt(s.replace(/[^0-9]/g, ''), 10) || 0 }

function dday(dateStr: string): number | null {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function DdayBadge({ dateStr }: { dateStr: string }) {
  const d = dday(dateStr)
  if (d === null) return null
  if (d < 0) return <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-bold">완료</span>
  if (d === 0) return <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse">D-Day</span>
  if (d <= 7)  return <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">D-{d}</span>
  if (d <= 30) return <span className="text-[9px] bg-orange-100 text-orange-500 px-1.5 py-0.5 rounded-full font-bold">D-{d}</span>
  return <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">D-{d}</span>
}

const defaultLoan = (): Loan => ({
  id: Date.now().toString(), amount: 0, rate: 0, institution: '', bank: '',
  repayment_type: '', repayment_day: '',
  p1_principal: 0, p1_interest: 0, p1_monthly: 0,
  p2_same: false, p2_principal: 0, p2_interest: 0, p2_monthly: 0,
  memo: '', goal: '',
})
const defaultSub = (): Subscription => ({
  id: Date.now().toString(), name: '', cycle: '1달', last_date: '', next_date: '',
  monthly_amount: 0, annual_amount: 0, memo: '', payment_route: '', corp_card: false,
})

// ─── 대출 편집 모달 ───────────────────────────────────────

function LoanModal({
  loan, phaseLabels, onSave, onClose,
}: {
  loan: Loan
  phaseLabels: [string, string]
  onSave: (l: Loan) => void
  onClose: () => void
}) {
  const [f, setF] = useState<Loan>({ ...loan })
  const set = (k: keyof Loan, v: any) => setF(p => ({ ...p, [k]: v }))

  const INP = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B2A45]/30'
  const INP_NUM = INP + ' text-right'

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-[#1B2A45] to-[#2d4a7a] px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">🏦 대출 편집</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white text-lg">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-400 mb-1 block">원금</label>
              <input className={INP_NUM} type="text" inputMode="numeric"
                value={fmtI(f.amount)} onChange={e => set('amount', parseN(e.target.value))} placeholder="20,000,000" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 mb-1 block">금리 (%)</label>
              <input className={INP} type="number" step="0.01"
                value={f.rate || ''} onChange={e => set('rate', parseFloat(e.target.value) || 0)} placeholder="2.90" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 mb-1 block">기관</label>
              <input className={INP} type="text" value={f.institution} onChange={e => set('institution', e.target.value)} placeholder="재단" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 mb-1 block">은행/플랫폼</label>
              <input className={INP} type="text" value={f.bank} onChange={e => set('bank', e.target.value)} placeholder="신한" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 mb-1 block">상환방법</label>
              <input className={INP} type="text" value={f.repayment_type} onChange={e => set('repayment_type', e.target.value)} placeholder="2년거치" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 mb-1 block">상환일</label>
              <input className={INP} type="text" value={f.repayment_day} onChange={e => set('repayment_day', e.target.value)} placeholder="매월 20일" />
            </div>
          </div>

          {/* 거치기간 */}
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-[11px] font-bold text-blue-600 mb-2">📅 {phaseLabels[0]}</p>
            <div className="grid grid-cols-3 gap-2">
              {[['p1_principal','원금'] as const,['p1_interest','이자'] as const,['p1_monthly','월상환금'] as const].map(([k,l]) => (
                <div key={k}>
                  <label className="text-[10px] text-blue-500 mb-1 block">{l}</label>
                  <input className={INP_NUM} type="text" inputMode="numeric"
                    value={fmtI(f[k])} onChange={e => set(k, parseN(e.target.value))} placeholder="0" />
                </div>
              ))}
            </div>
          </div>

          {/* 상환기간 */}
          <div className="bg-emerald-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-emerald-600">📅 {phaseLabels[1]}</p>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={f.p2_same} onChange={e => set('p2_same', e.target.checked)} className="accent-emerald-500 w-3 h-3" />
                <span className="text-[11px] text-emerald-600 font-medium">상동 (Phase 1과 동일)</span>
              </label>
            </div>
            {f.p2_same ? (
              <p className="text-xs text-emerald-500 text-center py-2">Phase 1 값과 동일하게 표시됩니다</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {[['p2_principal','원금'] as const,['p2_interest','이자'] as const,['p2_monthly','월상환금'] as const].map(([k,l]) => (
                  <div key={k}>
                    <label className="text-[10px] text-emerald-600 mb-1 block">{l}</label>
                    <input className={INP_NUM} type="text" inputMode="numeric"
                      value={fmtI(f[k])} onChange={e => set(k, parseN(e.target.value))} placeholder="0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 메모 + 목표 */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 mb-1 block">📝 메모</label>
            <textarea className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B2A45]/30 resize-none"
              rows={2} value={f.memo} onChange={e => set('memo', e.target.value)} placeholder="메모..." />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-400 mb-1 block">🎯 목표</label>
            <input className={INP} type="text" value={f.goal} onChange={e => set('goal', e.target.value)} placeholder="상환 목표..." />
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">취소</button>
          <button onClick={() => onSave(f)} className="px-5 py-2 bg-[#1B2A45] text-white rounded-xl text-sm font-semibold hover:bg-[#1B2A45]/90">저장</button>
        </div>
      </div>
    </div>
  )
}

// ─── 구독 행 컴포넌트 ─────────────────────────────────────

function SubRow({
  sub, onSave, onDelete,
}: {
  sub: Subscription
  onSave: (s: Subscription) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState(sub)
  const set = (k: keyof Subscription, v: any) => setF(p => ({ ...p, [k]: v }))
  const INP = 'w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300'

  function save() { onSave(f); setEditing(false) }
  function cancel() { setF(sub); setEditing(false) }

  const d = dday(sub.next_date)
  const isUrgent = d !== null && d >= 0 && d <= 7

  if (editing) {
    return (
      <tr className="bg-blue-50/50 border-b border-blue-100">
        <td className="px-3 py-2"><input className={INP} value={f.name} onChange={e => set('name', e.target.value)} /></td>
        <td className="px-2 py-2">
          <select className={INP + ' w-16'} value={f.cycle} onChange={e => set('cycle', e.target.value)}>
            <option value="1달">1달</option><option value="1년">1년</option><option value="">기타</option>
          </select>
        </td>
        <td className="px-2 py-2"><input className={INP + ' w-28'} type="date" value={f.next_date} onChange={e => set('next_date', e.target.value)} /></td>
        <td className="px-2 py-2 text-right">
          <input className={INP + ' w-24 text-right'} type="text" inputMode="numeric"
            value={fmtI(f.monthly_amount)} onChange={e => set('monthly_amount', parseN(e.target.value))} />
        </td>
        <td className="px-2 py-2">
          <input className={INP + ' w-28'} type="text" inputMode="numeric"
            value={fmtI(f.annual_amount)} onChange={e => set('annual_amount', parseN(e.target.value))} placeholder="0" />
        </td>
        <td className="px-2 py-2"><input className={INP} value={f.payment_route} onChange={e => set('payment_route', e.target.value)} placeholder="결제루트" /></td>
        <td className="px-2 py-2 text-center">
          <input type="checkbox" checked={f.corp_card} onChange={e => set('corp_card', e.target.checked)} className="accent-[#1B2A45] w-3.5 h-3.5" />
        </td>
        <td className="px-2 py-2"><input className={INP} value={f.memo} onChange={e => set('memo', e.target.value)} placeholder="비고" /></td>
        <td className="px-2 py-2 whitespace-nowrap">
          <button onClick={save} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold mr-1">✓</button>
          <button onClick={cancel} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
        </td>
      </tr>
    )
  }

  return (
    <tr className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${isUrgent ? 'bg-red-50/30' : ''}`}>
      <td className="px-3 py-2.5">
        <span className="text-sm font-semibold text-[#1B2A45]">{sub.name}</span>
      </td>
      <td className="px-2 py-2.5">
        {sub.cycle && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sub.cycle === '1년' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
            {sub.cycle}
          </span>
        )}
      </td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">{sub.next_date || '-'}</span>
          <DdayBadge dateStr={sub.next_date} />
        </div>
      </td>
      <td className="px-2 py-2.5 text-right">
        <span className={`text-sm font-bold ${isUrgent ? 'text-red-600' : 'text-gray-800'}`}>
          {sub.monthly_amount > 0 ? sub.monthly_amount.toLocaleString('ko-KR') : '-'}
        </span>
      </td>
      <td className="px-2 py-2.5 text-right">
        <span className="text-xs text-gray-500">{sub.annual_amount > 0 ? sub.annual_amount.toLocaleString('ko-KR') : '-'}</span>
      </td>
      <td className="px-2 py-2.5">
        {sub.payment_route && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{sub.payment_route}</span>}
      </td>
      <td className="px-2 py-2.5 text-center">
        {sub.corp_card && <span className="text-[10px] bg-[#1B2A45] text-white px-1.5 py-0.5 rounded-full font-bold">기업</span>}
      </td>
      <td className="px-2 py-2.5 max-w-[120px]">
        <span className="text-[11px] text-gray-400 line-clamp-1">{sub.memo}</span>
      </td>
      <td className="px-2 py-2.5 whitespace-nowrap">
        <button onClick={() => setEditing(true)} className="text-[10px] text-blue-500 hover:text-blue-700 mr-2">편집</button>
        <button onClick={onDelete} className="text-[10px] text-red-400 hover:text-red-600">삭제</button>
      </td>
    </tr>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────

export default function PersonalFinanceTab() {
  const [activeTab, setActiveTab] = useState<'loans' | 'subs'>('loans')
  const [loans, setLoans]         = useState<Loan[]>(DEFAULT_LOANS)
  const [subs, setSubs]           = useState<Subscription[]>(DEFAULT_SUBS)
  const [phaseLabels, setPhaseLabels] = useState<[string, string]>(['28년 1월까지', '28년 2월부터'])
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [msg, setMsg]             = useState('')
  const [editPhase, setEditPhase] = useState(false)

  // 불러오기
  useEffect(() => {
    setLoading(true)
    fetch('/api/personal-finance')
      .then(r => r.json())
      .then(json => {
        if (json.record?.employees) {
          const d = json.record.employees
          if (d.loans?.length) setLoans(d.loans)
          if (d.subs?.length)  setSubs(d.subs)
          if (d.phaseLabels)   setPhaseLabels(d.phaseLabels)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // 저장
  async function save() {
    setSaving(true); setMsg('')
    const res = await fetch('/api/personal-finance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { loans, subs, phaseLabels } }),
    })
    const json = await res.json()
    setMsg(json.record ? '저장 완료 ✓' : '저장 실패')
    setSaving(false)
  }

  // 대출 집계
  const totalDebt       = loans.reduce((s, l) => s + Number(l.amount), 0)
  const currentMonthly  = loans.reduce((s, l) => s + Number(l.p1_monthly), 0)
  const futureMonthly   = loans.reduce((s, l) => s + (l.p2_same ? l.p1_monthly : Number(l.p2_monthly)), 0)

  // 구독 집계
  const subMonthly = subs.reduce((s, sub) => s + Number(sub.monthly_amount), 0)
  const subAnnual  = subs.reduce((s, sub) => s + Number(sub.annual_amount), 0)
  const corpSubs   = subs.filter(s => s.corp_card)
  const corpMonthly = corpSubs.reduce((s, sub) => s + Number(sub.monthly_amount), 0)
  const urgentSubs = subs.filter(s => { const d = dday(s.next_date); return d !== null && d >= 0 && d <= 7 })

  return (
    <div className="space-y-5 pb-8">

      {/* 헤더 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {([['loans','🏦 대출 현황'],['subs','💳 정기구독']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setActiveTab(k)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === k ? 'bg-white text-[#1B2A45] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={save} disabled={saving}
          className="ml-auto bg-[#1B2A45] hover:bg-[#1B2A45]/90 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-semibold">
          {saving ? '저장 중...' : '💾 저장'}
        </button>
        {loading && <span className="text-xs text-blue-400 animate-pulse">불러오는 중...</span>}
        {msg && <span className={`text-xs font-medium ${msg.includes('완료') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</span>}
      </div>

      {/* ════════════════ 대출 현황 ════════════════ */}
      {activeTab === 'loans' && (
        <div className="space-y-4">
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-4 text-white">
              <p className="text-white/60 text-[11px] font-semibold mb-1">총 부채</p>
              <p className="text-2xl font-black tracking-tight">{(totalDebt / 10000).toFixed(0)}만원</p>
              <p className="text-white/50 text-xs mt-0.5">{totalDebt.toLocaleString('ko-KR')}원</p>
            </div>
            <div className="bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl p-4 text-white">
              <p className="text-white/70 text-[11px] font-semibold mb-1">{phaseLabels[0]} 월납부</p>
              <p className="text-2xl font-black tracking-tight">{(currentMonthly / 10000).toFixed(0)}만원</p>
              <p className="text-white/50 text-xs mt-0.5">{currentMonthly.toLocaleString('ko-KR')}원/월</p>
            </div>
            <div className="bg-gradient-to-br from-[#1B2A45] to-[#2d4a7a] rounded-2xl p-4 text-white">
              <p className="text-white/70 text-[11px] font-semibold mb-1">{phaseLabels[1]} 월납부</p>
              <p className="text-2xl font-black tracking-tight">{(futureMonthly / 10000).toFixed(0)}만원</p>
              <p className="text-white/50 text-xs mt-0.5">{futureMonthly.toLocaleString('ko-KR')}원/월</p>
            </div>
          </div>

          {/* 구간 라벨 편집 */}
          <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
            <span>구간 구분:</span>
            {editPhase ? (
              <>
                <input value={phaseLabels[0]} onChange={e => setPhaseLabels([e.target.value, phaseLabels[1]])}
                  className="border border-gray-200 rounded px-2 py-0.5 text-xs w-28 focus:outline-none" />
                <span className="text-gray-300">→</span>
                <input value={phaseLabels[1]} onChange={e => setPhaseLabels([phaseLabels[0], e.target.value])}
                  className="border border-gray-200 rounded px-2 py-0.5 text-xs w-28 focus:outline-none" />
                <button onClick={() => setEditPhase(false)} className="text-emerald-500 font-bold">완료</button>
              </>
            ) : (
              <>
                <span className="bg-blue-50 text-blue-500 px-2 py-0.5 rounded font-medium">{phaseLabels[0]}</span>
                <span>→</span>
                <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-medium">{phaseLabels[1]}</span>
                <button onClick={() => setEditPhase(true)} className="text-gray-400 hover:text-gray-600">✏️ 편집</button>
              </>
            )}
          </div>

          {/* 대출 카드 목록 */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loans.map((loan, i) => {
              const c = calcOps(loan) // just for display
              return (
                <div key={loan.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {/* 카드 헤더 */}
                  <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white font-black text-lg leading-none">{(loan.amount / 10000).toFixed(0)}<span className="text-sm font-normal text-white/60 ml-0.5">만원</span></p>
                        <p className="text-white/60 text-xs mt-0.5">{loan.bank} · {loan.institution}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-amber-300 font-black text-lg">{loan.rate}%</span>
                        <p className="text-white/50 text-[10px] mt-0.5">{loan.repayment_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] bg-white/15 text-white/70 px-2 py-0.5 rounded-full">{loan.repayment_day}</span>
                    </div>
                  </div>

                  {/* 두 구간 비교 */}
                  <div className="grid grid-cols-2 divide-x divide-gray-100">
                    <div className="px-3 py-2.5 bg-blue-50/50">
                      <p className="text-[10px] font-bold text-blue-500 mb-1.5">{phaseLabels[0]}</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs"><span className="text-gray-400">원금</span><span className="font-semibold text-gray-700">{loan.p1_principal > 0 ? loan.p1_principal.toLocaleString('ko-KR') : '-'}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-400">이자</span><span className="font-semibold text-gray-700">{won(loan.p1_interest)}</span></div>
                        <div className="flex justify-between text-xs border-t border-blue-100 pt-1"><span className="text-blue-600 font-bold">월납부</span><span className="font-black text-blue-600">{won(loan.p1_monthly)}</span></div>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 bg-emerald-50/50">
                      <p className="text-[10px] font-bold text-emerald-600 mb-1.5">{phaseLabels[1]}</p>
                      {loan.p2_same ? (
                        <p className="text-xs text-emerald-500 font-semibold pt-3 text-center">상동</p>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs"><span className="text-gray-400">원금</span><span className="font-semibold text-gray-700">{won(loan.p2_principal)}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-gray-400">이자</span><span className="font-semibold text-gray-700">{won(loan.p2_interest)}</span></div>
                          <div className="flex justify-between text-xs border-t border-emerald-100 pt-1"><span className="text-emerald-600 font-bold">월납부</span><span className="font-black text-emerald-600">{won(loan.p2_monthly)}</span></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 메모 / 목표 */}
                  {(loan.memo || loan.goal) && (
                    <div className="px-3 py-2.5 border-t border-gray-100 space-y-1.5">
                      {loan.memo && (
                        <p className="text-[11px] text-gray-500 leading-relaxed whitespace-pre-line">{loan.memo}</p>
                      )}
                      {loan.goal && (
                        <div className="flex items-start gap-1.5">
                          <span className="text-amber-400 text-[10px] font-bold shrink-0 mt-0.5">🎯</span>
                          <p className="text-[11px] text-amber-700 font-medium leading-relaxed">{loan.goal}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 편집/삭제 버튼 */}
                  <div className="px-3 pb-3 flex gap-2">
                    <button onClick={() => setEditingLoan(loan)}
                      className="flex-1 py-1.5 text-xs font-semibold text-[#1B2A45] border border-[#1B2A45]/20 rounded-lg hover:bg-[#1B2A45]/5 transition-colors">
                      ✏️ 편집
                    </button>
                    <button onClick={() => setLoans(prev => prev.filter((_, j) => j !== i))}
                      className="px-3 py-1.5 text-xs text-red-400 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
                      삭제
                    </button>
                  </div>
                </div>
              )
            })}

            {/* 대출 추가 */}
            <button onClick={() => setEditingLoan(defaultLoan())}
              className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-gray-300 hover:border-gray-300 hover:text-gray-400 transition-colors flex flex-col items-center justify-center gap-2 min-h-[200px]">
              <span className="text-3xl">+</span>
              <span className="text-sm font-semibold">대출 추가</span>
            </button>
          </div>
        </div>
      )}

      {/* ════════════════ 정기구독 ════════════════ */}
      {activeTab === 'subs' && (
        <div className="space-y-4">
          {/* 요약 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-[#1B2A45] to-[#2d4a7a] rounded-2xl p-4 text-white">
              <p className="text-white/60 text-[11px] font-semibold mb-1">월 구독 합계</p>
              <p className="text-xl font-black">{subMonthly.toLocaleString('ko-KR')}<span className="text-sm font-normal text-white/60 ml-0.5">원</span></p>
            </div>
            <div className="bg-emerald-600 rounded-2xl p-4 text-white">
              <p className="text-white/70 text-[11px] font-semibold mb-1">연간 합산 결제</p>
              <p className="text-xl font-black">{(subMonthly * 12 / 10000).toFixed(0)}<span className="text-sm font-normal text-white/70 ml-0.5">만원↑</span></p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-gray-400 text-[11px] font-semibold mb-1">기업카드 결제</p>
              <p className="text-xl font-black text-[#1B2A45]">{corpMonthly.toLocaleString('ko-KR')}<span className="text-sm font-normal text-gray-400 ml-0.5">원/월</span></p>
            </div>
            <div className={`rounded-2xl p-4 ${urgentSubs.length > 0 ? 'bg-red-50 border border-red-100' : 'bg-white border border-gray-200'}`}>
              <p className={`text-[11px] font-semibold mb-1 ${urgentSubs.length > 0 ? 'text-red-400' : 'text-gray-400'}`}>7일 내 결제</p>
              <p className={`text-xl font-black ${urgentSubs.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>{urgentSubs.length}<span className="text-sm font-normal ml-0.5">건</span></p>
            </div>
          </div>

          {/* 추가 버튼 */}
          <div className="flex justify-end">
            <button onClick={() => setSubs(prev => [...prev, defaultSub()])}
              className="flex items-center gap-2 bg-[#1B2A45] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#1B2A45]/90 transition-colors">
              + 항목 추가
            </button>
          </div>

          {/* 구독 테이블 */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-400 whitespace-nowrap">서비스</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-gray-400 whitespace-nowrap">주기</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-gray-400 whitespace-nowrap">차후결제일</th>
                    <th className="px-2 py-3 text-right text-xs font-bold text-gray-400 whitespace-nowrap">월금액</th>
                    <th className="px-2 py-3 text-right text-xs font-bold text-gray-400 whitespace-nowrap">연간금액</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-gray-400 whitespace-nowrap">결제루트</th>
                    <th className="px-2 py-3 text-center text-xs font-bold text-gray-400 whitespace-nowrap">기업</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-gray-400 whitespace-nowrap">비고</th>
                    <th className="px-2 py-3 whitespace-nowrap" />
                  </tr>
                </thead>
                <tbody>
                  {subs.map((sub, i) => (
                    <SubRow
                      key={sub.id}
                      sub={sub}
                      onSave={updated => setSubs(prev => prev.map((s, j) => j === i ? updated : s))}
                      onDelete={() => setSubs(prev => prev.filter((_, j) => j !== i))}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#1B2A45]/5 border-t-2 border-[#1B2A45]/10">
                    <td className="px-3 py-3 text-xs font-bold text-[#1B2A45]">합계</td>
                    <td colSpan={2} />
                    <td className="px-2 py-3 text-right text-sm font-black text-[#1B2A45]">{subMonthly.toLocaleString('ko-KR')}원</td>
                    <td className="px-2 py-3 text-right text-xs font-bold text-gray-500">{subAnnual > 0 ? subAnnual.toLocaleString('ko-KR') : '-'}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 대출 편집 모달 */}
      {editingLoan && (
        <LoanModal
          loan={editingLoan}
          phaseLabels={phaseLabels}
          onSave={updated => {
            setLoans(prev => {
              const idx = prev.findIndex(l => l.id === updated.id)
              if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n }
              return [...prev, updated]
            })
            setEditingLoan(null)
          }}
          onClose={() => setEditingLoan(null)}
        />
      )}
    </div>
  )
}

// 대출 계산은 사용하지 않으므로 빈 함수 (실제 계산은 각 카드에서 직접 처리)
function calcOps(_: Loan) { return {} }
