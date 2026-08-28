import type { Analysis } from '../types/analysis'
import { EmptyState, Lede, Masthead, N, Page, Section, ViewSkeleton, compactTokens, money, rise } from './_shared'
import { motion } from 'framer-motion'

const KIND_LABEL: Record<string, string> = {
  'claude-md': 'CLAUDE.md + system prompt',
  'mcp-tools': 'MCP tool definitions',
  skills: 'Skill listing injection',
  system: 'System overhead',
}

export default function RecurringView({ data }: { data: Analysis }) {
  if (!data) return <ViewSkeleton />
  const rows = [...(data.recurring ?? [])].sort((a, b) => b.monthlyCost - a.monthlyCost)
  if (rows.length === 0) return <EmptyState title="NO STANDING CHARGES" body="Nothing is being re-sent on every session in this window." />

  const total = rows.reduce((s, r) => s + r.monthlyCost, 0)
  const perSession = rows.reduce((s, r) => s + r.tokensPerSession, 0)

  return (
    <Page>
      <Masthead eyebrow="tokenomics --recurring" />
      <motion.div {...rise(0.06)} className="mb-5">
        <p className="key">STANDING CHARGES / MONTH</p>
        <div className="display num mt-1 text-[length:var(--text-hero)] text-[var(--color-accent)]">
          {money(total)}
        </div>
      </motion.div>

      <Lede delay={0.16}>
        <N>{compactTokens(perSession)}</N> tokens are billed before you type a single word — the same
        context re-sent at the start of every session, whether you use it or not.
      </Lede>

      <Section title="SUBSCRIPTIONS" note="Each line is charged once per session. Trim the file, cancel the charge." delay={0.28}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)]">
                <th className="key py-2 text-left">Charge</th>
                <th className="key py-2 text-right">Tok/session</th>
                <th className="key py-2 text-right">Sessions</th>
                <th className="key py-2 text-right">Monthly</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <motion.tr
                  key={r.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.34 + i * 0.06, duration: 0.4 }}
                  className="border-b border-[var(--color-line-soft)] last:border-0"
                >
                  <td className="py-3 pr-4">
                    <p className="text-[var(--color-text)]">{r.label}</p>
                    <p className="key mt-0.5 !tracking-[0.1em]">{KIND_LABEL[r.kind] ?? r.kind}</p>
                  </td>
                  <td className="num py-3 text-right text-[var(--color-text-dim)]">{compactTokens(r.tokensPerSession)}</td>
                  <td className="num py-3 text-right text-[var(--color-muted)]">{r.sessions.toLocaleString()}</td>
                  <td className="num py-3 text-right text-[var(--color-accent)]">{money(r.monthlyCost)}</td>
                </motion.tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="rule-double">
                <td className="key pt-3">TOTAL</td>
                <td className="num pt-3 text-right text-[var(--color-text-dim)]">{compactTokens(perSession)}</td>
                <td />
                <td className="num display pt-3 text-right text-[var(--color-accent)]">{money(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>
    </Page>
  )
}
