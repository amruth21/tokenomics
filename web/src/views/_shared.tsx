// Local, dependency-free UI helpers for the views layer.
//
// Shell (src/components/ui/*) is being built in parallel by another agent. Rather than
// race an import against files that may not exist yet at any given build, every view in
// this folder is self-sufficient: plain divs + Tailwind, styled to the same tokens
// defined in src/index.css (--color-ink/surface/line/muted/cash/burn/warn/accent).
import { type ReactNode, useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export function ViewHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: ReactNode; subtitle?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mb-8"
    >
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-accent)]">{eyebrow}</div>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#e8edf5] sm:text-4xl">{title}</h1>
      {subtitle && <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">{subtitle}</p>}
    </motion.div>
  )
}

export function Panel({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
      className={`rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 ${className}`}
    >
      {children}
    </motion.div>
  )
}

export function StatTile({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'default' | 'cash' | 'burn' | 'warn'
}) {
  const toneClass = {
    default: 'text-[#e8edf5]',
    cash: 'text-[var(--color-cash)]',
    burn: 'text-[var(--color-burn)]',
    warn: 'text-[var(--color-warn)]',
  }[tone]
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-[var(--color-muted)]">{sub}</div>}
    </div>
  )
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'high' | 'medium' | 'heuristic' }) {
  const toneClass = {
    default: 'bg-[var(--color-surface-2)] text-[var(--color-muted)] border-[var(--color-line)]',
    high: 'bg-[#132a1d] text-[var(--color-cash)] border-[#1f4a30]',
    medium: 'bg-[#2a2312] text-[var(--color-warn)] border-[#4a3d1f]',
    heuristic: 'bg-[#151c2a] text-[var(--color-accent)] border-[#233250]',
  }[tone]
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${toneClass}`}>
      {children}
    </span>
  )
}

/** Count-up number animation. Renders `formatter(target)` once animation settles. */
export function CountUp({ value, formatter, duration = 0.9 }: { value: number; formatter: (n: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let raf: number
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000))
      const eased = 1 - (1 - t) * (1 - t)
      setDisplay(from + (value - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])
  return <span className="tabular-nums">{formatter(display)}</span>
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[var(--color-surface-2)] ${className}`} />
}

export function ViewSkeleton() {
  return (
    <div className="p-8">
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="mb-8 h-9 w-96" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="mt-6 h-72 w-full" />
    </div>
  )
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-line)] p-10 text-center">
      <div className="text-sm font-medium text-[#e8edf5]">{title}</div>
      {body && <div className="mt-1 max-w-sm text-xs text-[var(--color-muted)]">{body}</div>}
    </div>
  )
}

export function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

export function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`
}

export function compactTokens(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${Math.round(n)}`
}
