import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 계약서 PDF: 글꼴 파일(읽어서 쓰는 파일)과 글꼴 자르기 모듈(wasm)이 서버 함수에 함께 올라가도록 한다
  serverExternalPackages: ['subset-font', 'harfbuzzjs'],
  outputFileTracingIncludes: {
    '/api/contract/generate': ['./src/lib/contract/fonts/**/*'],
  },
};

export default nextConfig;
