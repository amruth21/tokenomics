import { clsx } from 'clsx'
import type { Confidence } from '../../types/analysis'

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: 'bg-[var(--color-cash)]/12 text-[var(--color-cash)] border-[var(--color-cash)]/25',
  medium: 'bg-[var(--color-warn)]/12 text-[var(--color-warn)] border-[var(--color-warn)]/25',
  heuristic: 'bg-[var(--color-muted)]/12 text-[var(--color-muted)] border-[var(--color-muted)]/25',
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  heuristic: 'Heuristic',
}

export function ConfidenceBadge({ confidence, className }: { confidence: Confidence; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        CONFIDENCE_STYLE[confidence],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {CONFIDENCE_LABEL[confidence]}
    </span>
  )
}

type BadgeProps = {
  children: React.ReactNode
  tone?: 'default' | 'accent' | 'cash' | 'burn' | 'warn'
  className?: string
}

const TONE_STYLE: Record<NonNullable<BadgeProps['tone']>, string> = {
  default: 'bg-[var(--color-surface-2)] text-[var(--color-muted)] border-[var(--color-line)]',
  accent: 'bg-[var(--color-accent)]/12 text-[var(--color-accent)] border-[var(--color-accent)]/25',
  cash: 'bg-[var(--color-cash)]/12 text-[var(--color-cash)] border-[var(--color-cash)]/25',
  burn: 'bg-[var(--color-burn)]/12 text-[var(--color-burn)] border-[var(--color-burn)]/25',
  warn: 'bg-[var(--color-warn)]/12 text-[var(--color-warn)] border-[var(--color-warn)]/25',
}

export default function Badge({ children, tone = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONE_STYLE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
