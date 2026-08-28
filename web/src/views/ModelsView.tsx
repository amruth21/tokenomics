import { useState } from 'react'
import type { Analysis } from '../types/analysis'
import { motion } from 'framer-motion'
import { EmptyState, Lede, Masthead, N, Page, Section, ViewSkeleton, compactTokens, money, rise, EASE } from './_shared'

const SHORT: Record<string, string> = {
  'claude-opus-5': 'OPUS 5',
  'claude-opus-4-8': 'OPUS 4.8',
  'claude-sonnet-5': 'SONNET 5',
  'claude-haiku-4-5-20251001': 'HAIKU 4.5',
}
const short = (m: string) => SHORT[m] ?? m.replace('claude-', '').toUpperCase()

export default function ModelsView({ data }: { data: Analysis }) {
  const [pctRouted, setPctRouted] = useState(30)
  if (!data) return <ViewSkeleton />
  const models = [...(data.models ?? [])].sort((a, b) => b.cost - a.cost)
  if (models.length === 0) return <EmptyState title="NO MODEL DATA" body="No priced turns in this window." />

  const totalCost = models.reduce((s, m) => s + m.cost, 0)
  const totalTurns = models.reduce((s, m) => s + m.turns, 0)
  const top = models[0]
  const cheapest = [...models].sort((a, b) => a.costPerTurn - b.costPerTurn)[0]
  const ratio = cheapest.costPerTurn > 0 ? top.costPerTurn / cheapest.costPerTurn : 0

  // Candidate turns, not a promise of savings — we cannot prove the smaller model succeeds.
  const candidateCost = top.cost * (pctRouted / 100)
  const repriced = candidateCost * (cheapest.costPerTurn / (top.costPerTurn || 1))

  return (
    <Page>
      <Masthead eyebrow="tokenomics --models --allocation" />
      <motion.div {...rise(0.06)} className="mb-5">
        <p className="key">{short(top.model)} SHARE OF SPEND</p>
        <div className="display num mt-1 text-[length:var(--text-hero)] text-[var(--color-burn)]">
          {((top.cost / totalCost) * 100).toFixed(0)}%
        </div>
      </motion.div>

      <Lede delay={0.16}>
        {short(top.model)} is <N tone="default">{((top.turns / totalTurns) * 100).toFixed(0)}%</N> of
        your turns but <N tone="burn">{((top.cost / totalCost) * 100).toFixed(0)}%</N> of the money —{' '}
        <N>{ratio.toFixed(1)}×</N> the per-turn cost of {short(cheapest.model)}.
      </Lede>

      <Section title="ALLOCATION" note="Turns on the left, dollars on the right. The gap is the story." delay={0.28}>
        <div className="space-y-4">
          {models.map((m, i) => (
            <motion.div
              key={m.model}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.34 + i * 0.07, duration: 0.4 }}
            >
              <div className="flex items-baseline justify-between text-[0.8rem]">
                <span className="key !text-[var(--color-text)]">{short(m.model)}</span>
                <span className="num text-[var(--color-muted)]">
                  {m.turns.toLocaleString()} turns · {money(m.costPerTurn)}/turn
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <div className="h-4 w-full bg-[var(--color-line-soft)]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(m.turns / totalTurns) * 100}%` }}
                      transition={{ delay: 0.4 + i * 0.07, duration: 0.7, ease: EASE }}
                      className="h-full bg-[var(--color-line)]"
                    />
                  </div>
                  <p className="key mt-1">{((m.turns / totalTurns) * 100).toFixed(0)}% of turns</p>
                </div>
                <div>
                  <div className="h-4 w-full bg-[var(--color-line-soft)]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(m.cost / totalCost) * 100}%` }}
                      transition={{ delay: 0.44 + i * 0.07, duration: 0.7, ease: EASE }}
                      className="h-full bg-[var(--color-accent)]"
                    />
                  </div>
                  <p className="key mt-1 !text-[var(--color-accent)]">
                    {((m.cost / totalCost) * 100).toFixed(0)}% of dollars · {money(m.cost)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section
        title="DOWNGRADE SIMULATOR"
        note="Hypothetical. These are candidate turns, not proven substitutions — the cheaper model is not guaranteed to have finished the job."
        delay={0.52}
      >
        <div className="border border-[var(--color-line-soft)] bg-[var(--color-surface)] p-5">
          <label className="key block" htmlFor="route">
            ROUTE {pctRouted}% OF {short(top.model)} TURNS → {short(cheapest.model)}
          </label>
          <input
            id="route"
            type="range"
            min={0}
            max={100}
            step={5}
            value={pctRouted}
            onChange={(e) => setPctRouted(Number(e.target.value))}
            className="mt-4 w-full accent-[var(--color-accent)]"
          />
          <div className="mt-5 grid grid-cols-3 gap-4 text-center sm:text-left">
            <div>
              <p className="key">CANDIDATE SPEND</p>
              <p className="display num mt-1 text-xl text-[var(--color-text)]">{money(candidateCost)}</p>
            </div>
            <div>
              <p className="key">REPRICED</p>
              <p className="display num mt-1 text-xl text-[var(--color-cash)]">{money(repriced)}</p>
            </div>
            <div>
              <p className="key">DIFFERENCE</p>
              <p className="display num mt-1 text-xl text-[var(--color-accent)]">
                {money(candidateCost - repriced)}
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="PER-TURN RATES" delay={0.62}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)]">
              <th className="key py-2 text-left">Model</th>
              <th className="key py-2 text-right">Turns</th>
              <th className="key py-2 text-right">$/turn</th>
              <th className="key py-2 text-right">Avg ctx read</th>
              <th className="key py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.model} className="border-b border-[var(--color-line-soft)] last:border-0">
                <td className="py-2.5 text-[var(--color-text)]">{short(m.model)}</td>
                <td className="num py-2.5 text-right text-[var(--color-muted)]">{m.turns.toLocaleString()}</td>
                <td className="num py-2.5 text-right text-[var(--color-accent)]">{money(m.costPerTurn)}</td>
                <td className="num py-2.5 text-right text-[var(--color-muted)]">{compactTokens(m.avgContextRead)}</td>
                <td className="num py-2.5 text-right text-[var(--color-text)]">{money(m.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </Page>
  )
}
