import { useEffect, useRef } from 'react'
import { animate } from 'framer-motion'
import { clsx } from 'clsx'
import { formatMoney } from './Money'
import { formatTokens } from './TokenCount'

type StatTileProps = {
  label: string
  value: number
  /** how to render the animated number */
  format?: 'money' | 'tokens' | 'percent' | 'ratio' | 'number'
  delta?: string
  deltaTone?: 'cash' | 'burn' | 'neutral'
  hint?: string
  className?: string
  size?: 'md' | 'lg'
  decimals?: number
}

function render(value: number, format: NonNullable<StatTileProps['format']>, decimals?: number) {
  switch (format) {
    case 'money':
      return formatMoney(value)
    case 'tokens':
      return formatTokens(value)
    case 'percent':
      return `${(value * 100).toFixed(decimals ?? 1)}%`
    case 'ratio':
      return `${Math.round(value)}x`
    default:
      return value.toLocaleString('en-US', { maximumFractionDigits: decimals ?? 0 })
  }
}

const DELTA_TONE: Record<NonNullable<StatTileProps['deltaTone']>, string> = {
  cash: 'text-[var(--color-cash)]',
  burn: 'text-[var(--color-burn)]',
  neutral: 'text-[var(--color-muted)]',
}

export default function StatTile({
  label,
  value,
  format = 'number',
  delta,
  deltaTone = 'neutral',
  hint,
  className,
  size = 'md',
  decimals,
}: StatTileProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        el.textContent = render(latest, format, decimals)
      },
    })
    return () => controls.stop()
  }, [value, format, decimals])

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </span>
      <span
        ref={ref}
        className={clsx(
          'font-semibold tabular-nums text-[#f2ece0]',
          size === 'lg' ? 'text-4xl md:text-5xl' : 'text-2xl',
        )}
      >
        {render(0, format, decimals)}
      </span>
      {(delta || hint) && (
        <div className="flex items-center gap-2 text-xs">
          {delta ? <span className={clsx('font-medium tabular-nums', DELTA_TONE[deltaTone])}>{delta}</span> : null}
          {hint ? <span className="text-[var(--color-muted)]">{hint}</span> : null}
        </div>
      )}
    </div>
  )
}
