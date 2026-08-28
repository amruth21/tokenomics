import type { Analysis } from '../types/analysis'
import { ResponsiveLine } from '@nivo/line'
import { motion } from 'framer-motion'
import { nivoDarkTheme } from '../charts/theme'
import { CountUp, EmptyState, ViewSkeleton, money } from './_shared'

const EASE = [0.22, 1, 0.36, 1] as const

/** One orchestrated entrance, staggered top to bottom. */
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.7, ease: EASE },
})

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

export default function StatementView({ data }: { data: Analysis }) {
  if (!data) return <ViewSkeleton />
  const { summary, meta } = data
  if (!summary || summary.daily.length === 0) {
    return (
      <EmptyState
        title="No statement yet"
        body="Point Tokenomics at ~/.claude/projects and it will read your sessions here on your machine. Nothing is uploaded."
      />
    )
  }

  const t = summary.totalTokens
  const totalTokens = t.cacheRead + t.cacheWrite + t.output + t.input
  const seg = [
    { label: 'Context re-read', value: t.cacheRead, color: 'var(--color-burn)' },
    { label: 'Context written', value: t.cacheWrite, color: 'var(--color-accent-dim)' },
    { label: 'Actual output', value: t.output + t.input, color: 'var(--color-cash)' },
  ]

  const lineData = [{ id: 'daily', data: summary.daily.map((d) => ({ x: d.date, y: d.cost })) }]
  const peak = summary.daily.reduce((a, b) => (b.cost > a.cost ? b : a), summary.daily[0])

  return (
    <div className="mx-auto max-w-5xl px-2 pb-20 pt-4">
      {/* Masthead ------------------------------------------------------- */}
      <motion.header {...rise(0)} className="mb-14">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
          Statement · {shortDate(meta.from)} — {shortDate(meta.to)}
        </p>
        <div className="rule-accent mt-3 w-28" />
      </motion.header>

      {/* The figure ------------------------------------------------------ */}
      <motion.div {...rise(0.08)} className="mb-3">
        <p className="text-lg text-[var(--color-text-dim)]">You spent</p>
        <h1 className="display num mt-2 text-[length:var(--text-hero)] text-[var(--color-text)]">
          <CountUp value={summary.totalCost} formatter={money} />
        </h1>
      </motion.div>

      {/* The argument ---------------------------------------------------- */}
      <motion.p
        {...rise(0.2)}
        className="max-w-3xl text-[length:var(--text-lede)] leading-snug text-[var(--color-text-dim)]"
      >
        and{' '}
        <span className="display num text-[var(--color-burn)]">
          {Math.round(summary.readToWriteRatio)}
        </span>{' '}
        tokens were re-read for every <span className="text-[var(--color-text)]">1</span> you
        actually got back. Only{' '}
        <span className="display num text-[var(--color-cash)]">
          {(summary.productiveRateDollars * 100).toFixed(1)}%
        </span>{' '}
        of that money bought new work.
      </motion.p>

      {/* Proportion bar — one chart, load-bearing, not decoration -------- */}
      <motion.section {...rise(0.34)} className="mt-12">
        <div className="flex h-14 w-full overflow-hidden rounded-sm">
          {seg.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ width: 0 }}
              animate={{ width: `${(s.value / totalTokens) * 100}%` }}
              transition={{ delay: 0.45 + i * 0.09, duration: 0.9, ease: EASE }}
              style={{ background: s.color }}
              title={`${s.label}: ${(s.value / 1e6).toFixed(1)}M tokens`}
            />
          ))}
        </div>
        <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
          {seg.map((s) => (
            <div key={s.label} className="flex items-baseline gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <dt className="text-sm text-[var(--color-muted)]">{s.label}</dt>
              <dd className="num text-sm font-semibold text-[var(--color-text)]">
                {(s.value / 1e6).toFixed(1)}M
                <span className="ml-1.5 font-normal text-[var(--color-muted)]">
                  {((s.value / totalTokens) * 100).toFixed(1)}%
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </motion.section>

      {/* Ledger facts — a definition list, not four identical cards ------ */}
      <motion.section
        {...rise(0.5)}
        className="mt-14 grid grid-cols-2 gap-x-10 gap-y-8 border-t border-[var(--color-line-soft)] pt-8 sm:grid-cols-4"
      >
        {[
          { k: 'Sessions', v: meta.sessions.toLocaleString() },
          { k: 'Turns', v: meta.turns.toLocaleString() },
          { k: 'Duplicates skipped', v: meta.deduped.toLocaleString() },
          { k: 'Busiest day', v: money(peak.cost), sub: shortDate(peak.date) },
        ].map((f) => (
          <div key={f.k}>
            <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              {f.k}
            </dt>
            <dd className="display num mt-1.5 text-[length:var(--text-figure)] text-[var(--color-text)]">
              {f.v}
            </dd>
            {f.sub && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{f.sub}</p>}
          </div>
        ))}
      </motion.section>

      {/* Daily spend ----------------------------------------------------- */}
      <motion.section {...rise(0.62)} className="mt-16">
        <h2 className="display text-2xl text-[var(--color-text)]">Day by day</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--color-muted)]">
          Spend is spiky, not steady — the peak day cost {money(peak.cost)}, roughly{' '}
          {(peak.cost / (summary.totalCost / summary.daily.length)).toFixed(1)}× an average day.
        </p>
        <div className="mt-6 h-64">
          <ResponsiveLine
            data={lineData}
            theme={nivoDarkTheme}
            margin={{ top: 10, right: 8, bottom: 34, left: 44 }}
            xScale={{ type: 'point' }}
            yScale={{ type: 'linear', min: 0, max: 'auto' }}
            curve="monotoneX"
            axisBottom={{ tickRotation: 0, tickValues: Math.min(6, summary.daily.length), format: (v) => shortDate(String(v)) }}
            axisLeft={{ format: (v) => `$${v}`, tickValues: 4 }}
            enableArea
            areaOpacity={0.12}
            colors={['#d99a2b']}
            lineWidth={2}
            pointSize={0}
            enableGridX={false}
            useMesh
            enableSlices="x"
            sliceTooltip={({ slice }) => (
              <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 text-xs">
                <div className="text-[var(--color-muted)]">
                  {shortDate(String(slice.points[0].data.x))}
                </div>
                <div className="num font-semibold text-[var(--color-text)]">
                  {money(Number(slice.points[0].data.y))}
                </div>
              </div>
            )}
            animate
            motionConfig="gentle"
          />
        </div>
      </motion.section>
    </div>
  )
}
