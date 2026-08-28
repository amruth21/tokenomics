import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Analysis } from '../types/analysis'
import type { Recommendation } from '../types/analysis'
import { Badge, EmptyState, Panel, ViewHeader, ViewSkeleton, money } from './_shared'

export default function AdvisorView({ data }: { data: Analysis }) {
  if (!data) return <ViewSkeleton />
  const { advice } = data
  if (!advice || advice.length === 0) {
    return <EmptyState title="No advice yet" body="Deterministic recommendations, each with evidence, show up here once we've analyzed enough sessions." />
  }

  const totalMonthly = advice.reduce((s, a) => s + a.monthlySaving, 0)

  return (
    <div className="p-8">
      <ViewHeader
        eyebrow="Advisor"
        title="What to actually change."
        subtitle="Every card below is computed from your own history — not a generic tip. Open the evidence drawer to see the exact sessions and turns behind the number."
      />

      <Panel delay={0.1} className="mb-6 border-[var(--color-cash)]/25">
        <div className="text-sm text-[var(--color-muted)]">If you acted on everything below</div>
        <div className="mt-1 font-mono text-4xl font-bold tabular-nums text-[var(--color-cash)]">
          {money(totalMonthly)}
          <span className="ml-2 text-base font-normal text-[var(--color-muted)]">/mo</span>
        </div>
      </Panel>

      <div className="space-y-4">
        {advice
          .slice()
          .sort((a, b) => b.monthlySaving - a.monthlySaving)
          .map((rec, i) => (
            <AdviceCard key={rec.id} rec={rec} delay={0.06 * i} />
          ))}
      </div>
    </div>
  )
}

const categoryLabel: Record<Recommendation['category'], string> = {
  loop: 'Loop',
  context: 'Context',
  routing: 'Routing',
  habit: 'Habit',
}

function AdviceCard({ rec, delay }: { rec: Recommendation; delay: number }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge>{categoryLabel[rec.category]}</Badge>
            <Badge tone={rec.confidence}>{rec.confidence}</Badge>
          </div>
          <h3 className="text-lg font-semibold text-[#e8edf5]">{rec.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{rec.body}</p>
          <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[#e8edf5]">
            <span className="text-[var(--color-accent)]">Fix: </span>
            {rec.fix}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-2xl font-bold tabular-nums text-[var(--color-cash)]">
            {money(rec.monthlySaving)}
          </div>
          <div className="text-xs text-[var(--color-muted)]">/mo</div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:underline"
      >
        {open ? 'Hide evidence' : `Show evidence (${rec.evidence.length})`}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          ▾
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2 border-t border-[var(--color-line)] pt-3">
              {rec.evidence.map((ev, i) => (
                <div
                  key={`${ev.sessionId}-${i}`}
                  className="flex flex-col gap-1 rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[var(--color-muted)]">session {ev.sessionId}</div>
                    <div className="mt-0.5 text-[#e8edf5]">{ev.label}</div>
                  </div>
                  <div className="flex shrink-0 gap-4 font-mono tabular-nums text-[var(--color-muted)]">
                    <span>{ev.turns} turns</span>
                    <span className="text-[#e8edf5]">{money(ev.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
