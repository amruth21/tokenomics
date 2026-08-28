import { motion } from 'framer-motion'
import type { Analysis } from '../types/analysis'
import { EmptyState, Panel, StatTile, ViewHeader, ViewSkeleton, money, pct } from './_shared'

export default function ReworkView({ data }: { data: Analysis }) {
  if (!data) return <ViewSkeleton />
  const { rework } = data
  if (!rework || rework.cases.length === 0) {
    return <EmptyState title="No rework detected" body="No file was edited 3+ times in a session — nothing to flag." />
  }

  const worst = rework.cases.slice().sort((a, b) => b.edits - a.edits)[0]
  const totalCost = rework.cases.reduce((s, c) => s + c.cost, 0)
  const maxEdits = Math.max(1, ...rework.cases.map((c) => c.edits))

  return (
    <div className="p-8">
      <ViewHeader
        eyebrow="Rework"
        title="You paid for the same file more than once."
        subtitle="Every case here is a file edited 3+ times in one session, plus the tool-error rate across the whole corpus — declined transactions that still cost a turn."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Rework cases" value={rework.cases.length} />
        <StatTile label="Worst case" value={`${worst?.edits}x`} sub={worst?.path} tone="burn" />
        <StatTile label="Total rework cost" value={money(totalCost)} tone="warn" />
        <StatTile label="Tool error rate" value={pct(rework.errorRate)} sub="declined transactions" tone="burn" />
      </div>

      <Panel delay={0.15}>
        <div className="mb-4 text-sm font-medium text-[#e8edf5]">Files paid for more than once</div>
        <div className="space-y-3">
          {rework.cases
            .slice()
            .sort((a, b) => b.edits - a.edits)
            .map((c, i) => (
              <motion.div
                key={`${c.sessionId}-${c.path}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * i, duration: 0.35 }}
                className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm text-[#e8edf5]">{c.path}</div>
                    <div className="mt-0.5 text-xs text-[var(--color-muted)]">session {c.sessionId}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-semibold tabular-nums text-[var(--color-burn)]">
                      {c.edits}x edited
                    </div>
                    <div className="font-mono text-xs tabular-nums text-[var(--color-muted)]">{money(c.cost)}</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface)]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(c.edits / maxEdits) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full bg-[var(--color-burn)]"
                  />
                </div>
              </motion.div>
            ))}
        </div>
      </Panel>
    </div>
  )
}
