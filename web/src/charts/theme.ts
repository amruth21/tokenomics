// Shared nivo dark theme so every chart in the app reads as one system.
// Matches the design tokens in src/index.css (--color-ink / surface / line / muted).

export const nivoDarkTheme = {
  background: 'transparent',
  text: {
    fill: '#8b97a8',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    fontSize: 11,
  },
  axis: {
    domain: { line: { stroke: '#232a35', strokeWidth: 1 } },
    ticks: {
      line: { stroke: '#232a35', strokeWidth: 1 },
      text: { fill: '#8b97a8', fontSize: 11 },
    },
    legend: { text: { fill: '#8b97a8', fontSize: 12 } },
  },
  grid: { line: { stroke: '#1b212a', strokeWidth: 1 } },
  legends: { text: { fill: '#8b97a8', fontSize: 11 } },
  tooltip: {
    container: {
      background: '#161b23',
      color: '#e8edf5',
      fontSize: 12,
      borderRadius: 8,
      border: '1px solid #232a35',
      boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
    },
  },
  crosshair: { line: { stroke: '#7dd3fc', strokeWidth: 1, strokeOpacity: 0.5 } },
  labels: { text: { fill: '#e8edf5' } },
  annotations: { text: { fill: '#e8edf5' } },
} as const

// Categorical palette: cash-green as the "good/productive" anchor, burn-red as the
// "waste" anchor, rest are neutral blues/violets. Keep this order stable across charts.
export const moneyPalette = [
  '#4ade80', // cash — productive
  '#7dd3fc', // accent
  '#a78bfa',
  '#fbbf24', // warn
  '#38bdf8',
  '#f472b6',
  '#fb7185', // burn — waste
  '#94a3b8',
]

export const modelColor: Record<string, string> = {
  'claude-opus-5': '#fb7185',
  'claude-opus-4-8': '#fb7185',
  'claude-sonnet-5': '#7dd3fc',
  'claude-haiku-4-5-20251001': '#4ade80',
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
