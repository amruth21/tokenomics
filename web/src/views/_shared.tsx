// Editorial kit for the views layer.
//
// The house style: every view is a page, not a dashboard. One masthead, one figure
// that carries the headline, one sentence that makes the argument, then evidence.
// Colour is meaning (ochre = look here, burn = loss, cash = working), never decoration.
import { type ReactNode, useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export const EASE = [0.22, 1, 0.36, 1] as const

/** One orchestrated entrance per page, staggered top to bottom. */
export const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.65, ease: EASE },
})

export type Tone = 'default' | 'cash' | 'burn' | 'accent'

const TONE_TEXT: Record<Tone, string> = {
  default: 'text-[var(--color-text)]',
  cash: 'text-[var(--color-cash)]',
  burn: 'text-[var(--color-burn)]',
  accent: 'text-[var(--color-accent)]',
}

/** Page masthead: small caps eyebrow, accent rule. No big rounded icon, ever. */
export function Masthead({ eyebrow, delay = 0 }: { eyebrow: string; delay?: number }) {
  return (
    <motion.header {...rise(delay)} className="mb-9">
      <div className="flex items-center gap-2 text-[0.72rem]">
        <span className="text-[var(--color-accent)]">$</span>
        <span className="key !text-[var(--color-text-dim)]">{eyebrow}</span>
        <span className="cursor" />
      </div>
      <div className="rule mt-3" />
    </motion.header>
  )
}

/** The headline figure. Big, serif, tabular. This is the thing seen from across a room. */
export function Figure({
  value,
  label,
  tone = 'default',
  sub,
  delay = 0.08,
}: {
  value: ReactNode
  label: string
  tone?: Tone
  sub?: ReactNode
  delay?: number
}) {
  return (
    <motion.div {...rise(delay)} className="mb-5">
      <p className="key">{label}</p>
      <div className={`display num mt-2 text-[length:var(--text-hero)] ${TONE_TEXT[tone]}`}>{value}</div>
      {sub && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)]">{sub}</p>}
    </motion.div>
  )
}

/** The argument. A sentence a person would say out loud, with the numbers inline. */
export function Lede({ children, delay = 0.2 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.p
      {...rise(delay)}
      className="max-w-3xl text-[length:var(--text-lede)] leading-snug text-[var(--color-text-dim)]"
    >
      {children}
    </motion.p>
  )
}

/** Inline emphasis inside a Lede — a number that carries meaning. */
export function N({ children, tone = 'accent' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`display num ${TONE_TEXT[tone]}`}>{children}</span>
}

/** Section under a hairline. Sections carry a title and a one-line takeaway. */
export function Section({
  title,
  note,
  children,
  delay = 0.3,
  className = '',
}: {
  title: string
  note?: ReactNode
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.section
      {...rise(delay)}
      className={`rule-double mt-14 pt-6 ${className}`}
    >
      <h2 className="key !text-[var(--color-accent)] !text-[0.78rem]">{title}</h2>
      {note && <p className="mt-1.5 max-w-2xl text-sm text-[var(--color-muted)]">{note}</p>}
      <div className="mt-6">{children}</div>
    </motion.section>
  )
}

/** Ledger facts as a definition list — never four identical cards. */
export function Facts({
  items,
  cols = 4,
}: {
  items: { k: string; v: ReactNode; sub?: ReactNode; tone?: Tone }[]
  cols?: 3 | 4
}) {
  return (
    <dl className={`grid grid-cols-2 gap-x-10 gap-y-8 ${cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
      {items.map((f) => (
        <div key={f.k} className="border-l-2 border-[var(--color-line-soft)] pl-3">
          <dt className="key">{f.k}</dt>
          <dd className={`display num mt-1.5 text-[length:var(--text-figure)] ${TONE_TEXT[f.tone ?? 'default']}`}>
            {f.v}
          </dd>
          {f.sub && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{f.sub}</p>}
        </div>
      ))}
    </dl>
  )
}

/** A ranked row: rank, label, bar, figure. The workhorse of the evidence views. */
export function RankRow({
  rank,
  label,
  meta,
  fraction,
  value,
  tone = 'accent',
  delay = 0,
}: {
  rank: number
  label: ReactNode
  meta?: ReactNode
  fraction: number
  value: ReactNode
  tone?: Tone
  delay?: number
}) {
  const bar = tone === 'burn' ? 'var(--color-burn)' : tone === 'cash' ? 'var(--color-cash)' : 'var(--color-accent)'
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5, ease: EASE }}
      className="group grid grid-cols-[2rem_1fr_auto] items-baseline gap-4 border-b border-[var(--color-line-soft)] py-3.5 last:border-0"
    >
      <span className="num text-sm text-[var(--color-muted)]">{String(rank).padStart(2, '0')}</span>
      <div className="min-w-0">
        <p className="truncate text-sm text-[var(--color-text)]">{label}</p>
        {meta && <p className="mt-1 truncate text-xs text-[var(--color-muted)]">{meta}</p>}
        <div className="mt-2 h-2 w-full overflow-hidden bg-[var(--color-line-soft)]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(1.5, Math.min(100, fraction * 100))}%` }}
            transition={{ delay: delay + 0.1, duration: 0.8, ease: EASE }}
            style={{ background: bar }}
            className="h-full"
          />
        </div>
      </div>
      <span className={`display num text-lg ${TONE_TEXT[tone]}`}>{value}</span>
    </motion.div>
  )
}

/** Confidence badge. Estimates must look like estimates. */
export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'high' | 'medium' | 'heuristic' }) {
  const styles: Record<string, string> = {
    default: 'border-[var(--color-line)] text-[var(--color-muted)]',
    high: 'border-[var(--color-cash)]/45 text-[var(--color-cash)]',
    medium: 'border-[var(--color-accent)]/45 text-[var(--color-accent)]',
    heuristic: 'border-[var(--color-muted)]/40 text-[var(--color-muted)]',
  }
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] ${styles[tone]}`}>
      [{children}]
    </span>
  )
}

export function CountUp({ value, formatter, duration = 0.9 }: { value: number; formatter: (n: number) => string; duration?: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / (duration * 1000))
      // ease-out-quint: real objects decelerate smoothly
      setN(value * (1 - Math.pow(1 - p, 5)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{formatter(n)}</>
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--color-surface-2)] ${className}`} />
}

export function ViewSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-2 pt-6">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-6 h-20 w-80" />
      <Skeleton className="mt-6 h-5 w-full max-w-2xl" />
      <Skeleton className="mt-12 h-14 w-full" />
      <Skeleton className="mt-10 h-56 w-full" />
    </div>
  )
}

/** Empty states teach the interface rather than saying "nothing here". */
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-xl px-2 py-24">
      <div className="rule-accent w-20" />
      <h2 className="display mt-6 text-2xl text-[var(--color-text)]">{title}</h2>
      {body && <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">{body}</p>}
    </div>
  )
}

/** Page wrapper — consistent measure and rhythm across every view. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl px-2 pb-24 pt-4">{children}</div>
}

// ---- formatters -----------------------------------------------------------
export function money(n: number): string {
  return n >= 1000
    ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : `$${n.toFixed(2)}`
}
export function money0(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}
export function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`
}
export function compactTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`
  return String(Math.round(n))
}
export function shortDate(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

// Back-compat shims so a view mid-refactor still compiles.
export function ViewHeader({ eyebrow }: { eyebrow: string; title?: ReactNode; subtitle?: ReactNode }) {
  return <Masthead eyebrow={eyebrow} />
}
export function Panel({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div {...rise(delay)} className={`border border-[var(--color-line-soft)] bg-[var(--color-surface)] p-5 ${className}`}>
      {children}
    </motion.div>
  )
}
export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return <Facts items={[{ k: label, v: value, sub }]} />
}
