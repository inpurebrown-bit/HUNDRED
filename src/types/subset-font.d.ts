declare module 'subset-font' {
  const subsetFont: (font: Uint8Array, text: string, options?: { targetFormat?: 'sfnt' | 'truetype' | 'woff' | 'woff2' }) => Promise<Uint8Array>
  export default subsetFont
}
