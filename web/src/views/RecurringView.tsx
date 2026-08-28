import type { Analysis } from '../types/analysis'
import { motion } from 'framer-motion'
import { Badge, EmptyState, Panel, ViewHeader, ViewSkeleton, compactTokens, money } from './_shared'

const kindLabel: Record<string, string> = {
  'claude-md': 'System prompt',
  'mcp-tools': 'Tool definitions',
  skills: 'Skill listing',
  system: 'System overhead',
}

export default function RecurringView({ data }: { data: Analysis }) {
  if (!data) return <ViewSkeleton />
  const { recurring } = data
  if (!recurring || recurring.length === 0) {
    return <EmptyState title="No recurring charges found" body="Nothing shows up as an always-on tax yet." />
  }

  const monthlyTotal = recurring.reduce((s, r) => s + r.monthlyCost, 0)

  return (
    <div className="p-8">
      <ViewHeader
        eyebrow="Recurring charges"
        title="Your subscriptions, audited."
        subtitle="These charges hit before you type a single word — boilerplate context re-paid on every session. Think of it like the gym membership you forgot to cancel."
      />

      <Panel className="mb-6" delay={0.1}>
        <div className="flex items-baseline justify-between">
          <div className="text-sm text-[var(--color-muted)]">Total recurring, projected monthly</div>
          <div className="font-mono text-2xl font-bold tabular-nums text-[var(--color-burn)]">{money(monthlyTotal)}</div>
        </div>
      </Panel>

      <div className="space-y-3">
        {recurring
          .slice()
          .sort((a, b) => b.monthlyCost - a.monthlyCost)
          .map((r, i) => (
            <motion.div
              key={r.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.4 }}
              className="flex flex-col gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge>{kindLabel[r.kind] ?? r.kind}</Badge>
                  <div className="truncate text-sm font-medium text-[#e8edf5]">{r.label}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--color-muted)]">
                  <span>
                    <span className="font-mono tabular-nums text-[#e8edf5]">{compactTokens(r.tokensPerSession)}</span> tok / session
                  </span>
                  <span>
                    billed <span className="font-mono tabular-nums text-[#e8edf5]">{r.sessions}</span> sessions
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4 sm:justify-end">
                <div className="text-right">
                  <div className="font-mono text-lg font-semibold tabular-nums text-[var(--color-warn)]">
                    {money(r.monthlyCost)}
                    <span className="ml-1 text-xs font-normal text-[var(--color-muted)]">/mo</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="whitespace-nowrap rounded-full border border-[var(--color-burn)]/40 px-3 py-1.5 text-xs font-medium text-[var(--color-burn)] transition hover:bg-[var(--color-burn)]/10"
                  title="Not wired to any backend — this is a framing affordance, not a real action."
                >
                  Trim this
                </button>
              </div>
            </motion.div>
          ))}
      </div>
    </div>
  )
}
