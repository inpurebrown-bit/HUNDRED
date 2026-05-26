'use client'

import { useState, useEffect } from 'react'

interface Freelancer {
  id: string
  name: string
  resident_id: string
  address: string
  phone: string
  bank_account: string
  bank_name: string
  team: 'ops' | 'sales'
  join_date: string
  note: string
}

const BLANK: Omit<Freelancer, 'id'> = {
  name: '', resident_id: '', address: '', phone: '',
  bank_account: '', bank_name: '카카오뱅크', team: 'sales',
  join_date: '', note: '',
}

// 빠른 선택 버튼 목록
const QUICK_NAMES = ['손제후', '김윤지', '백승협', '장재혁', '박원태']

function mask(id: string) {
  return id ? id.replace(/^(\d{6})-?(\d{1})\d{6}$/, '$1-$2******') : ''
}

function fmt(ds: string) {
  if (!ds) return '-'
  const [y, m, d] = ds.split('-')
  return `${y}.${m}.${d}`
}

// 주민번호 자동 포맷: 6자리 입력 후 자동으로 '-' 삽입
function formatResidentId(v: string) {
  const d = v.replace(/[^0-9]/g, '').slice(0, 13)
  return d.length > 6 ? d.slice(0, 6) + '-' + d.slice(6) : d
}

export default function FreelancerTab() {
  const [list, setList] = useState<Freelancer[]>([])
  const [selected, setSelected] = useState<Freelancer | null>(null)
  const [editData, setEditData] = useState<Freelancer | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [showMasked, setShowMasked] = useState(true)
  // 팀 탭 필터
  const [teamTab, setTeamTab] = useState<'all' | 'sales' | 'ops'>('all')
  // 계좌번호 복사 피드백
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // payslip-settings에서 직원 목록 공유
  useEffect(() => {
    async function load() {
      const res = await fetch('/api/payslip-settings')
      const json = await res.json()
      if (json.settings?.employees) {
        // payslip-settings의 employees를 freelancers로 쓰되, 추가 필드를 병합
        const emps = json.settings.employees as any[]
        setList(emps.map(e => ({
          id: e.id || Date.now().toString(),
          name: e.name || '',
          resident_id: e.resident_id || '',
          address: e.address || '',
          phone: e.phone || '',
          bank_account: e.bank_account || '',
          bank_name: e.bank_name || '카카오뱅크',
          team: e.team || 'sales',
          join_date: e.join_date || '',
          note: e.note || '',
        })))
      }
    }
    load()
  }, [])

  async function save(emp: Freelancer) {
    setSaving(true)
    setMsg('')
    try {
      const updated = isNew
        ? [...list, emp]
        : list.map(e => e.id === emp.id ? emp : e)
      // 저장 시 payslip-settings와 동기화
      const res = await fetch('/api/payslip-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees: updated }),
      })
      const json = await res.json()
      if (json.settings) {
        setList(updated)
        setSelected(emp)
        setEditData(null)
        setIsNew(false)
        setMsg('저장 완료')
      } else {
        setMsg('저장 실패')
      }
    } catch { setMsg('저장 실패') }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('이 프리랜서를 삭제하시겠습니까?')) return
    const updated = list.filter(e => e.id !== id)
    await fetch('/api/payslip-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employees: updated }),
    })
    setList(updated)
    setSelected(null)
    setEditData(null)
  }

  // 이름 지정 없이 빈 폼으로 새 직원 추가
  function startNew(name = '') {
    const emp: Freelancer = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      ...BLANK,
      name,
    }
    setEditData(emp)
    setIsNew(true)
    setSelected(null)
  }

  // 계좌번호 클립보드 복사
  function copyAccount(emp: Freelancer) {
    const text = `${emp.bank_name} ${emp.bank_account}`
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(emp.id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  // 팀 탭 필터 적용
  const filteredList = list.filter(e =>
    teamTab === 'all' ? true : e.team === teamTab
  )

  return (
    <div className="space-y-4 pb-8">
      {/* 헤더 */}
      <div className="bg-[#1B2A45] rounded-xl px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-white text-base">프리랜서 관리대장</h2>
            <p className="text-xs text-white/50 mt-0.5">헌드레드 컨설팅 · 사업자 533-36-01551</p>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={() => setShowMasked(m => !m)}
              className="text-xs text-white/70 border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
              {showMasked ? '마스킹' : '전체보기'}
            </button>
            <button onClick={() => startNew()}
              className="text-xs bg-white text-[#1B2A45] font-semibold px-3 py-1.5 rounded-lg hover:bg-white/90 transition-colors">
              + 등록
            </button>
            {msg && <span className="text-xs text-white/80">{msg}</span>}
          </div>
        </div>
        {/* 빠른 직원 선택 버튼 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white/50">빠른 등록:</span>
          {QUICK_NAMES.map(name => {
            const exists = list.some(e => e.name === name)
            return (
              <button
                key={name}
                onClick={() => !exists && startNew(name)}
                disabled={exists}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  exists
                    ? 'border-white/10 text-white/25 cursor-default'
                    : 'border-white/30 text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                {exists ? `✓ ${name}` : `+ ${name}`}
              </button>
            )
          })}
        </div>
      </div>

      {/* 팀 구분 탭 */}
      <div className="flex gap-2">
        {([
          ['all', '전체', list.length],
          ['sales', '영업팀', list.filter(e => e.team === 'sales').length],
          ['ops', '관리팀', list.filter(e => e.team === 'ops').length],
        ] as ['all' | 'sales' | 'ops', string, number][]).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTeamTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              teamTab === key
                ? key === 'sales'
                  ? 'bg-blue-600 text-white'
                  : key === 'ops'
                    ? 'bg-violet-600 text-white'
                    : 'bg-[#1B2A45] text-white'
                : 'bg-white border border-[#E8E2D4] text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              teamTab === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {/* 목록 테이블 */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-[#E8E2D4] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-[#E8E2D4]">
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 w-8">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500">
                  성명 <span className="text-red-400">*</span>
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500">팀</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500">
                  주민등록번호 <span className="text-red-400">*</span>
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500">연락처</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500">
                  계좌 (은행) <span className="text-red-400">*</span>
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500">등록일</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500">주소</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400 text-sm">
                    {teamTab === 'all' ? '등록된 프리랜서가 없습니다' : '해당 팀에 등록된 프리랜서가 없습니다'}
                  </td>
                </tr>
              )}
              {filteredList.map((emp, idx) => (
                <tr key={emp.id}
                  onClick={() => { setSelected(emp); setEditData(null); setIsNew(false) }}
                  className={`border-b border-gray-50 cursor-pointer transition-colors ${
                    selected?.id === emp.id ? 'bg-blue-50/50' : 'hover:bg-gray-50/60'
                  }`}>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-gray-900">{emp.name || '-'}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      emp.team === 'ops' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {emp.team === 'ops' ? '관리팀' : '영업팀'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 font-mono">
                    {showMasked ? mask(emp.resident_id) : (emp.resident_id || '-')}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{emp.phone || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <span>{emp.bank_account ? `${emp.bank_account} (${emp.bank_name})` : '-'}</span>
                      {emp.bank_account && (
                        <button
                          onClick={e => { e.stopPropagation(); copyAccount(emp) }}
                          title="계좌번호 복사"
                          className="text-gray-400 hover:text-blue-500 transition-colors shrink-0"
                        >
                          {copiedId === emp.id ? (
                            <span className="text-[10px] text-emerald-500 font-medium">복사됨</span>
                          ) : (
                            <span className="text-xs">복사</span>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{fmt(emp.join_date)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[160px] truncate">{emp.address || '-'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); setEditData({ ...emp }); setSelected(emp); setIsNew(false) }}
                        className="text-xs text-blue-500 hover:text-blue-700 px-2 py-0.5 rounded hover:bg-blue-50">
                        편집
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); remove(emp.id) }}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-0.5 rounded hover:bg-red-50">
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 오른쪽 상세/편집 */}
        {(editData || selected) && (
          <div className="w-80 shrink-0 bg-white rounded-xl border border-[#E8E2D4] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E8E2D4] bg-gray-50/50 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-700">
                {editData ? (isNew ? '+ 신규 등록' : '편집') : '상세정보'}
              </p>
              {editData && (
                <button onClick={() => { setEditData(null); setIsNew(false) }}
                  className="text-gray-400 hover:text-gray-700 text-sm">✕</button>
              )}
            </div>

            {editData ? (
              /* 편집 폼 */
              <div className="p-4 space-y-3">
                {/* 성명 — 필수 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    성명 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editData.name}
                    onChange={e => setEditData(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>

                {/* 주민등록번호 — 필수, 자동 포맷 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    주민등록번호 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editData.resident_id}
                    onChange={e => setEditData(prev =>
                      prev ? { ...prev, resident_id: formatResidentId(e.target.value) } : null
                    )}
                    placeholder="000000-0000000"
                    maxLength={14}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>

                {/* 연락처 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">연락처</label>
                  <input
                    type="text"
                    value={editData.phone}
                    onChange={e => setEditData(prev => prev ? { ...prev, phone: e.target.value } : null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>

                {/* 은행명 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">은행명</label>
                  <input
                    type="text"
                    value={editData.bank_name}
                    onChange={e => setEditData(prev => prev ? { ...prev, bank_name: e.target.value } : null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>

                {/* 계좌번호 — 필수 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    계좌번호 <span className="text-red-400">*</span>
                  </label>
                  <div className="relative flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editData.bank_account}
                      onChange={e => setEditData(prev => prev ? { ...prev, bank_account: e.target.value } : null)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    {editData.bank_account && (
                      <button
                        type="button"
                        onClick={() => copyAccount(editData)}
                        title="계좌번호 복사"
                        className="shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
                      >
                        {copiedId === editData.id ? (
                          <span className="text-[10px] text-emerald-500 font-medium">복사됨</span>
                        ) : (
                          <span className="text-base">복사</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* 등록일 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">등록일</label>
                  <input
                    type="date"
                    value={editData.join_date}
                    onChange={e => setEditData(prev => prev ? { ...prev, join_date: e.target.value } : null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>

                {/* 팀 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">팀</label>
                  <select
                    value={editData.team}
                    onChange={e => setEditData(prev => prev ? { ...prev, team: e.target.value as 'ops' | 'sales' } : null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
                    <option value="sales">영업팀</option>
                    <option value="ops">관리팀</option>
                  </select>
                </div>

                {/* 주소 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">주소</label>
                  <input
                    value={editData.address}
                    onChange={e => setEditData(prev => prev ? { ...prev, address: e.target.value } : null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>

                {/* 메모 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">메모</label>
                  <textarea
                    value={editData.note}
                    onChange={e => setEditData(prev => prev ? { ...prev, note: e.target.value } : null)}
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setEditData(null); setIsNew(false) }}
                    className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
                    취소
                  </button>
                  <button onClick={() => editData && save(editData)} disabled={saving}
                    className="flex-1 bg-[#1B2A45] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#243552] disabled:opacity-40">
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            ) : selected ? (
              /* 상세 보기 */
              <div className="p-4 space-y-3">
                <div className="text-center py-3">
                  <div className="w-14 h-14 rounded-full bg-[#1B2A45] flex items-center justify-center text-white text-2xl font-black mx-auto mb-2">
                    {selected.name?.[0] || '?'}
                  </div>
                  <p className="font-bold text-gray-900 text-base">{selected.name}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    selected.team === 'ops' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {selected.team === 'ops' ? '관리팀' : '영업팀'}
                  </span>
                </div>
                <div className="space-y-2 text-sm border-t border-gray-100 pt-3">
                  {[
                    ['주민등록번호', showMasked ? mask(selected.resident_id) : selected.resident_id],
                    ['연락처', selected.phone],
                    ['등록일', fmt(selected.join_date)],
                    ['주소', selected.address],
                  ].map(([label, value]) => value && (
                    <div key={label} className="flex gap-2">
                      <span className="text-xs text-gray-400 w-24 shrink-0">{label}</span>
                      <span className="text-xs text-gray-700 flex-1">{value}</span>
                    </div>
                  ))}
                  {/* 계좌 — 복사 버튼 포함 */}
                  {(selected.bank_account) && (
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-gray-400 w-24 shrink-0">은행/계좌</span>
                      <span className="text-xs text-gray-700 flex-1">
                        {selected.bank_name} {selected.bank_account}
                      </span>
                      <button
                        onClick={() => copyAccount(selected)}
                        title="계좌번호 복사"
                        className="text-gray-400 hover:text-blue-500 transition-colors shrink-0"
                      >
                        {copiedId === selected.id ? (
                          <span className="text-[10px] text-emerald-500 font-medium">복사됨</span>
                        ) : (
                          <span className="text-xs">복사</span>
                        )}
                      </button>
                    </div>
                  )}
                  {selected.note && (
                    <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 mt-2">
                      {selected.note}
                    </div>
                  )}
                </div>
                <button onClick={() => setEditData({ ...selected })}
                  className="w-full border border-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50 mt-2">
                  편집
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-[#E8E2D4] p-4 text-center">
          <p className="text-2xl font-black text-gray-900">{list.length}</p>
          <p className="text-xs text-gray-500 mt-1">전체 프리랜서</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E8E2D4] p-4 text-center">
          <p className="text-2xl font-black text-blue-600">{list.filter(e => e.team === 'sales').length}</p>
          <p className="text-xs text-gray-500 mt-1">영업팀</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E8E2D4] p-4 text-center">
          <p className="text-2xl font-black text-violet-600">{list.filter(e => e.team === 'ops').length}</p>
          <p className="text-xs text-gray-500 mt-1">관리팀</p>
        </div>
      </div>
    </div>
  )
}
