'use client'

import React from 'react'

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string           // raw numeric string (no commas), e.g. "500000"
  onChange: (raw: string) => void
  suffix?: string         // e.g. "원"
}

/**
 * 숫자 입력 시 자동으로 천단위 콤마 표시.
 * value/onChange는 콤마 없는 순수 숫자 문자열로 통신.
 */
export default function NumberInput({ value, onChange, suffix, className, ...rest }: NumberInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    onChange(raw)
  }

  const display = value ? Number(value).toLocaleString('ko-KR') : ''

  return (
    <div className="relative">
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        className={className}
      />
      {suffix && display && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  )
}

/** 콤마 포함된 문자열 → 숫자 파싱 */
export function parseNumber(val: string): number {
  return parseFloat(val.replace(/[^0-9.]/g, '')) || 0
}

/** 숫자 → 콤마 포함 표시용 문자열 */
export function formatNumber(val: number | string): string {
  const n = typeof val === 'string' ? parseNumber(val) : val
  return n ? n.toLocaleString('ko-KR') : ''
}
