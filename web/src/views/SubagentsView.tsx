import type { Analysis } from '../types/analysis'
import { motion } from 'framer-motion'
import { EmptyState, Panel, StatTile, ViewHeader, ViewSkeleton, money, pct } from './_shared'

export default function SubagentsView({ data }: { data: Analysis }) {
  if (!data) return <ViewSkeleton />
  const { subagents } = data
  if (!subagents || subagents.runs === 0) {
    return <EmptyState title="No subagent runs found" body="Delegate work to subagents and their boot-cost ledger shows up here." />
  }

  const spread = subagents.p90BootTokens - subagents.medianBootTokens
  const spreadPct = subagents.medianBootTokens > 0 ? spread / subagents.medianBootTokens : 0
  const maxByParent = Math.max(1, ...subagents.byParent.map((p) => p.cost))

  return (
    <div className="p-8">
      <ViewHeader
        eyebrow="Subagent ledger"
        title="Every subagent pays the same cover charge."
        subtitle={`${pct(subagents.shareOfTurns)} of all turns this window were subagent runs — ${subagents.runs} of them. The finding isn't that they're expensive one at a time. It's how little the boot cost varies by job.`}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Subagent runs" value={subagents.runs.toLocaleString()} />
        <StatTile label="Share of all turns" value={pct(subagents.shareOfTurns)} tone="warn" />
        <StatTile label="Total subagent cost" value={money(subagents.totalCost)} tone="burn" />
        <StatTile
          label="p90 − median spread"
          value={`${pct(spreadPct)}`}
          sub="tight spread = context isn't scoped per job"
        />
      </div>

      {/* boot token spread visual */}
      <Panel delay={0.15} className="mb-6">
        <div className="mb-4 text-sm font-medium text-[#e8edf5]">Boot tokens per subagent run</div>
        <BootSpread median={subagents.medianBootTokens} p90={subagents.p90BootTokens} />
        <p className="mt-4 text-xs text-[var(--color-muted)]">
          Median boot is <span className="font-mono tabular-nums text-[#e8edf5]">{subagents.medianBootTokens.toLocaleString()}</span> tokens.
          p90 is only <span className="font-mono tabular-nums text-[#e8edf5]">{subagents.p90BootTokens.toLocaleString()}</span> —
          a symbol-rename agent and an architecture agent are handed nearly identical context. That's boilerplate, not a job spec.
        </p>
      </Panel>

      {/* by parent session */}
      <Panel delay={0.2}>
        <div className="mb-4 text-sm font-medium text-[#e8edf5]">Delegation, by parent session</div>
        <div className="space-y-3">
          {subagents.byParent
            .slice()
            .sort((a, b) => b.cost - a.cost)
            .map((p, i) => (
              <motion.div
                key={p.sessionId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 * i, duration: 0.35 }}
                className="flex items-center gap-3"
              >
                <div className="w-24 shrink-0 truncate font-mono text-xs text-[var(--color-muted)]">{p.sessionId}</div>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-[var(--color-surface-2)]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(p.cost / maxByParent) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-md bg-[var(--color-accent)]/70"
                  />
                </div>
                <div className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-[var(--color-muted)]">{p.runs} runs</div>
                <div className="w-20 shrink-0 text-right font-mono text-sm font-medium tabular-nums text-[#e8edf5]">
                  {money(p.cost)}
                </div>
              </motion.div>
            ))}
        </div>
      </Panel>
    </div>
  )
}

function BootSpread({ median, p90 }: { median: number; p90: number }) {
  const max = p90 * 1.15
  const medianPct = (median / max) * 100
  const p90Pct = (p90 / max) * 100
  return (
    <div className="relative h-16">
      <div className="absolute inset-x-0 top-6 h-2 rounded-full bg-[var(--color-surface-2)]" />
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${p90Pct}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="absolute top-6 h-2 rounded-full bg-[var(--color-accent)]/40"
      />
      <motion.div
        initial={{ left: 0 }}
        animate={{ left: `${medianPct}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="absolute top-4 h-6 w-0.5 bg-[var(--color-cash)]"
      >
        <div className="absolute -top-5 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] tabular-nums text-[var(--color-cash)]">
          p50 {median.toLocaleString()}
        </div>
      </motion.div>
      <motion.div
        initial={{ left: 0 }}
        animate={{ left: `${p90Pct}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="absolute top-4 h-6 w-0.5 bg-[var(--color-warn)]"
      >
        <div className="absolute -top-5 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] tabular-nums text-[var(--color-warn)]">
          p90 {p90.toLocaleString()}
        </div>
      </motion.div>
    </div>
  )
}
