import type { Analysis } from '../types/analysis'
import { ResponsiveLine } from '@nivo/line'
import { motion } from 'framer-motion'
import { nivoDarkTheme } from '../charts/theme'
import { CountUp, EmptyState, Panel, StatTile, ViewHeader, ViewSkeleton, money } from './_shared'

export default function StatementView({ data }: { data: Analysis }) {
  if (!data) return <ViewSkeleton />
  const { summary, meta } = data
  if (!summary || summary.daily.length === 0) {
    return <EmptyState title="No statement yet" body="Load a folder of Claude Code sessions to generate your first statement." />
  }

  const lineData = [
    {
      id: 'daily spend',
      data: summary.daily.map((d) => ({ x: d.date, y: d.cost })),
    },
  ]

  return (
    <div className="p-8">
      <ViewHeader
        eyebrow={`Statement · ${meta.from} → ${meta.to}`}
        title="Here's where your month went."
        subtitle={`${meta.sessions.toLocaleString()} sessions, ${meta.turns.toLocaleString()} turns, deduped from ${meta.deduped.toLocaleString()} raw records.`}
      />

      {/* The wince line */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="mb-8 rounded-2xl border border-[var(--color-burn)]/30 bg-gradient-to-br from-[#1a0f13] to-[var(--color-surface)] p-6"
      >
        <div className="text-sm text-[var(--color-muted)]">You spent</div>
        <div className="mt-1 font-mono text-5xl font-bold tabular-nums text-[#e8edf5] sm:text-6xl">
          <CountUp value={summary.totalCost} formatter={money} />
        </div>
        <div className="mt-3 text-lg text-[var(--color-burn)]">
          <span className="font-mono tabular-nums">{Math.round(summary.readToWriteRatio)}</span>{' '}
          tokens read for every 1 written.
        </div>
      </motion.div>

      {/* Productive rate hero */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Panel delay={0.2} className="border-[var(--color-cash)]/25">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
            Productive tokens
          </div>
          <div className="mt-2 font-mono text-4xl font-bold tabular-nums text-[var(--color-cash)]">
            <CountUp value={summary.productiveRateTokens * 100} formatter={(n) => `${n.toFixed(1)}%`} />
          </div>
          <div className="mt-2 text-sm text-[var(--color-muted)]">
            of every token moved this window was net-new work output. The rest was re-reading
            context you already paid for.
          </div>
        </Panel>
        <Panel delay={0.25} className="border-[var(--color-warn)]/25">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
            Productive dollars
          </div>
          <div className="mt-2 font-mono text-4xl font-bold tabular-nums text-[var(--color-warn)]">
            <CountUp value={summary.productiveRateDollars * 100} formatter={(n) => `${n.toFixed(1)}%`} />
          </div>
          <div className="mt-2 text-sm text-[var(--color-muted)]">
            Dollars skew more productive than tokens because output tokens are priced
            far higher than cache reads — but 92 cents of every dollar still went to context.
          </div>
        </Panel>
      </div>

      {/* Stat row */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Sessions" value={meta.sessions.toLocaleString()} />
        <StatTile label="Turns" value={meta.turns.toLocaleString()} />
        <StatTile
          label="Tokens read"
          value={`${(summary.totalTokens.cacheRead / 1_000_000).toFixed(0)}M`}
          sub="cache reads, this window"
        />
        <StatTile
          label="Tokens written"
          value={`${(summary.totalTokens.output / 1000).toFixed(0)}k`}
          sub="net-new output"
          tone="cash"
        />
      </div>

      {/* Daily spend chart */}
      <Panel delay={0.3} className="h-80">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="text-sm font-medium text-[#e8edf5]">Daily spend</div>
          <div className="text-xs text-[var(--color-muted)]">{meta.from} – {meta.to}</div>
        </div>
        <div className="h-64">
          <ResponsiveLine
            data={lineData}
            theme={nivoDarkTheme}
            margin={{ top: 10, right: 20, bottom: 40, left: 50 }}
            xScale={{ type: 'point' }}
            yScale={{ type: 'linear', min: 0, max: 'auto' }}
            curve="monotoneX"
            axisBottom={{ tickRotation: -35, tickValues: Math.min(8, summary.daily.length) }}
            axisLeft={{ format: (v) => `$${v}` }}
            enableArea
            areaOpacity={0.15}
            colors={['#4ade80']}
            lineWidth={2}
            pointSize={0}
            enableGridX={false}
            useMesh
            enableSlices="x"
            sliceTooltip={({ slice }) => (
              <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 text-xs">
                <div className="text-[var(--color-muted)]">{slice.points[0].data.xFormatted}</div>
                <div className="font-mono font-semibold text-[#e8edf5]">
                  {money(Number(slice.points[0].data.y))}
                </div>
              </div>
            )}
            animate
            motionConfig="gentle"
          />
        </div>
      </Panel>
    </div>
  )
}
