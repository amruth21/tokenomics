import { clsx } from 'clsx'

/** Formats a raw token count into a compact human string: 952.6M, 20.7K, 1.92M, 340. */
export function formatTokens(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return `${Math.round(value)}`
}

type TokenCountProps = {
  value: number
  className?: string
  suffix?: string
}

export default function TokenCount({ value, className, suffix = ' tok' }: TokenCountProps) {
  return (
    <span className={clsx('tabular-nums', className)}>
      {formatTokens(value)}
      {suffix}
    </span>
  )
}
