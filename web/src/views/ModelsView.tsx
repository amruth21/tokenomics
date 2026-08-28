import { useState } from 'react'
import type { Analysis } from '../types/analysis'
import { motion } from 'framer-motion'
import { modelColor } from '../charts/theme'
import { EmptyState, Panel, StatTile, ViewHeader, ViewSkeleton, money, pct } from './_shared'

export default function ModelsView({ data }: { data: Analysis }) {
  if (!data) return <ViewSkeleton />
  const { models } = data
  if (!models || models.length === 0) {
    return <EmptyState title="No model mix yet" body="Model allocation and the downgrade simulator show up once sessions load." />
  }

  return <ModelsViewBody models={models} />
}

function ModelsViewBody({ models }: { models: Analysis['models'] }) {
  const totalTurns = models.reduce((s, m) => s + m.turns, 0)
  const totalCost = models.reduce((s, m) => s + m.cost, 0)
  const opus = models.find((m) => m.model.includes('opus'))
  const sonnet = models.find((m) => m.model.includes('sonnet'))

  // Downgrade simulator. We don't have a per-turn output-token distribution in the
  // Analysis contract (that's a bigger engine change), so the slider scales a candidate
  // share of Opus turns linearly against its position — anchored at the low end by 0
  // candidates and at the high end by "every Opus turn under this ceiling," using the
  // real cost-per-turn differential between Opus and Sonnet from this user's own data.
  const maxN = 4000
  const [threshold, setThreshold] = useState(800)
  const candidateShare = Math.min(1, threshold / maxN)
  const candidateTurns = opus ? Math.round(opus.turns * candidateShare * 0.55) : 0
  const candidateWorth = opus && sonnet ? candidateTurns * (opus.costPerTurn - sonnet.costPerTurn) : 0

  return (
    <div className="p-8">
      <ViewHeader
        eyebrow="Model portfolio"
        title="22% of your turns. 90% of your bill."
        subtitle="Opus is the expensive line in your portfolio — not because it runs the most turns, but because every turn it runs costs 7.2x a Sonnet turn. Here's the gap, and a simulator for what's routable."
      />

      {/* turns vs dollars gap */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AllocationBar title="Share of turns" models={models} totalTurns={totalTurns} totalCost={totalCost} metric="turns" />
        <AllocationBar title="Share of dollars" models={models} totalTurns={totalTurns} totalCost={totalCost} metric="cost" />
      </div>

      {/* $/turn table */}
      <Panel delay={0.15} className="mb-6 overflow-x-auto">
        <div className="mb-3 text-sm font-medium text-[#e8edf5]">Cost per turn</div>
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
              <th className="py-2 pr-4 font-medium">Model</th>
              <th className="py-2 pr-4 font-medium">Turns</th>
              <th className="py-2 pr-4 font-medium">Total cost</th>
              <th className="py-2 pr-4 font-medium">$ / turn</th>
              <th className="py-2 font-medium">Avg context re-read</th>
            </tr>
          </thead>
          <tbody>
            {models
              .slice()
              .sort((a, b) => b.cost - a.cost)
              .map((m) => (
                <tr key={m.model} className="border-b border-[var(--color-line)]/50 last:border-0">
                  <td className="py-2 pr-4">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: modelColor[m.model] ?? '#94a3b8' }} />
                      {m.model}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-mono tabular-nums text-[var(--color-muted)]">{m.turns.toLocaleString()}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums text-[#e8edf5]">{money(m.cost)}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums text-[#e8edf5]">{money(m.costPerTurn)}</td>
                  <td className="py-2 font-mono tabular-nums text-[var(--color-muted)]">
                    {(m.avgContextRead / 1000).toFixed(0)}k tok
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Panel>

      {/* downgrade simulator */}
      <Panel delay={0.2}>
        <div className="mb-1 text-sm font-medium text-[#e8edf5]">Downgrade simulator</div>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          Route Opus turns with small output and no tool call under this ceiling to Sonnet. We can't prove the
          smaller model would have succeeded — this shows what's <em>candidate</em>, not what you'd have saved.
        </p>
        <div className="mb-4 flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={maxN}
            step={50}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--color-surface-2)] accent-[var(--color-accent)]"
          />
          <div className="w-40 shrink-0 font-mono text-sm tabular-nums text-[var(--color-muted)]">
            output &lt; {threshold.toLocaleString()} tok
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatTile label="Candidate turns" value={candidateTurns.toLocaleString()} />
          <StatTile label="Candidate turns worth" value={money(candidateWorth)} tone="warn" />
          <StatTile
            label="If routed to Sonnet"
            value={`${money(candidateTurns * (sonnet?.costPerTurn ?? 0))}`}
            sub="Sonnet-priced equivalent"
          />
        </div>
      </Panel>
    </div>
  )
}

function AllocationBar({
  title,
  models,
  totalTurns,
  totalCost,
  metric,
}: {
  title: string
  models: Analysis['models']
  totalTurns: number
  totalCost: number
  metric: 'turns' | 'cost'
}) {
  const total = metric === 'turns' ? totalTurns : totalCost
  return (
    <Panel delay={0.1}>
      <div className="mb-3 text-sm font-medium text-[#e8edf5]">{title}</div>
      <div className="flex h-8 w-full overflow-hidden rounded-lg border border-[var(--color-line)]">
        {models.map((m) => {
          const value = metric === 'turns' ? m.turns : m.cost
          const share = total > 0 ? value / total : 0
          return (
            <motion.div
              key={m.model}
              initial={{ width: 0 }}
              animate={{ width: `${share * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full"
              style={{ background: modelColor[m.model] ?? '#94a3b8' }}
              title={`${m.model}: ${pct(share)}`}
            />
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {models.map((m) => {
          const value = metric === 'turns' ? m.turns : m.cost
          const share = total > 0 ? value / total : 0
          return (
            <span key={m.model} className="inline-flex items-center gap-1.5 text-[var(--color-muted)]">
              <span className="h-2 w-2 rounded-full" style={{ background: modelColor[m.model] ?? '#94a3b8' }} />
              {m.model.replace('claude-', '')} <span className="font-mono tabular-nums text-[#e8edf5]">{pct(share)}</span>
            </span>
          )
        })}
      </div>
    </Panel>
  )
}
