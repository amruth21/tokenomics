// Shared nivo dark theme so every chart in the app reads as one system.
// Matches the design tokens in src/index.css (--color-ink / surface / line / muted).

export const nivoDarkTheme = {
  background: 'transparent',
  text: {
    fill: '#8e8271',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    fontSize: 11,
  },
  axis: {
    domain: { line: { stroke: '#362e23', strokeWidth: 1 } },
    ticks: {
      line: { stroke: '#362e23', strokeWidth: 1 },
      text: { fill: '#8e8271', fontSize: 11 },
    },
    legend: { text: { fill: '#8e8271', fontSize: 12 } },
  },
  grid: { line: { stroke: '#29221a', strokeWidth: 1 } },
  legends: { text: { fill: '#8e8271', fontSize: 11 } },
  tooltip: {
    container: {
      background: '#262019',
      color: '#f2ece0',
      fontSize: 12,
      borderRadius: 8,
      border: '1px solid #362e23',
      boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
    },
  },
  crosshair: { line: { stroke: '#d99a2b', strokeWidth: 1, strokeOpacity: 0.5 } },
  labels: { text: { fill: '#f2ece0' } },
  annotations: { text: { fill: '#f2ece0' } },
} as const

// Categorical palette: cash-green as the "good/productive" anchor, burn-red as the
// "waste" anchor, rest are neutral blues/violets. Keep this order stable across charts.
export const moneyPalette = [
  '#869c5a', // cash — productive
  '#d99a2b', // accent
  '#9c6f4e',
  '#c98a3a', // warn
  '#b8843c',
  '#7a8f6a',
  '#c4553d', // burn — waste
  '#8e8271',
]

export const modelColor: Record<string, string> = {
  'claude-opus-5': '#c4553d',
  'claude-opus-4-8': '#c4553d',
  'claude-sonnet-5': '#d99a2b',
  'claude-haiku-4-5-20251001': '#869c5a',
}

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
