// Shared nivo theme so every chart in the app reads as one system.
// Matches the design tokens in src/index.css (--color-ink / surface / line / muted).

export const nivoTheme = {
  background: 'transparent',
  text: {
    fill: '#6e6658',
    fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
    fontSize: 11,
  },
  axis: {
    domain: { line: { stroke: '#c4b49a', strokeWidth: 1 } },
    ticks: {
      line: { stroke: '#c4b49a', strokeWidth: 1 },
      text: { fill: '#6e6658', fontSize: 11 },
    },
    legend: { text: { fill: '#6e6658', fontSize: 12 } },
  },
  grid: { line: { stroke: '#d4c8b0', strokeWidth: 1 } },
  legends: { text: { fill: '#6e6658', fontSize: 11 } },
  tooltip: {
    container: {
      background: '#ebe4d4',
      color: '#1c1914',
      fontSize: 12,
      borderRadius: 0,
      border: '1px solid #c4b49a',
      boxShadow: 'none',
    },
  },
  crosshair: { line: { stroke: '#b56a12', strokeWidth: 1, strokeOpacity: 0.5 } },
  labels: { text: { fill: '#1c1914' } },
  annotations: { text: { fill: '#1c1914' } },
} as const

/** @deprecated use nivoTheme — kept so existing imports compile */
export const nivoDarkTheme = nivoTheme

// Categorical palette: cash-green as the "good/productive" anchor, burn-red as the
// "waste" anchor, rest are ink-adjacent ochres. Keep this order stable across charts.
export const moneyPalette = [
  '#3d6b2e', // cash — productive
  '#b56a12', // accent
  '#8a5a3c',
  '#9a5a0a', // warn
  '#c47a14',
  '#5a6e48',
  '#b83a1a', // burn — waste
  '#6e6658',
]

export const modelColor: Record<string, string> = {
  'claude-opus-5': '#b83a1a',
  'claude-opus-4-8': '#b83a1a',
  'claude-sonnet-5': '#b56a12',
  'claude-haiku-4-5-20251001': '#3d6b2e',
}

export const calendarEmpty = '#e0d6c4'
export const calendarColors = ['#ead9a8', '#d9b45a', '#c47a14', '#b56a12', '#b83a1a']
export const calendarBorder = '#f3eee4'

export function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

export function formatCompactMoney(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export function formatTokens(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}
