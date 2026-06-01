'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  tabName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * 탭 단위 에러 경계
 * - 탭 내부에서 렌더링 오류 발생 시 전체 페이지 크래시 방지
 * - 재시도 버튼으로 탭을 unmount → remount
 */
export default class TabErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[TabErrorBoundary]', error, info)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="text-4xl">⚠️</div>
          <p className="text-base font-semibold text-gray-700">
            {this.props.tabName || '탭'} 로딩 중 오류가 발생했습니다
          </p>
          <p className="text-xs text-gray-400 max-w-xs text-center">
            {this.state.error?.message || '알 수 없는 오류'}
          </p>
          <button
            onClick={this.handleRetry}
            className="mt-2 px-5 py-2 bg-[#1B2A45] text-white text-sm font-bold rounded-xl hover:bg-[#263d66] transition-colors"
          >
            다시 시도
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
