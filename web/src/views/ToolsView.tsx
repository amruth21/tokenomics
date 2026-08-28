import type { Analysis } from '../types/analysis'
import { ResponsiveTreeMap } from '@nivo/treemap'
import { nivoDarkTheme, moneyPalette } from '../charts/theme'
import { EmptyState, Panel, StatTile, ViewHeader, ViewSkeleton, money } from './_shared'

export default function ToolsView({ data }: { data: Analysis }) {
  if (!data) return <ViewSkeleton />
  const { tools } = data
  if (!tools || tools.length === 0) {
    return <EmptyState title="No tool payloads yet" body="Once sessions load, tool payload sizes and their re-read cost show up here." />
  }

  const screenshot = tools.find((t) => t.name === 'browser_take_screenshot')
  const totalAnnuity = tools.reduce((s, t) => s + t.annuityCost, 0)
  const totalBytes = tools.reduce((s, t) => s + t.bytes, 0)

  const treeData = {
    id: 'tools',
    children: tools.map((t) => ({ id: t.name, value: t.bytes, annuityCost: t.annuityCost, calls: t.calls })),
  }

  return (
    <div className="p-8">
      <ViewHeader
        eyebrow="Tool payloads"
        title="A fat tool result isn't a one-time charge."
        subtitle="It's an annuity: every byte a tool returns sits in context and gets re-read on every later turn in the session, at cache-read rates, until the session ends."
      />

      {screenshot && (
        <Panel delay={0.1} className="mb-6 border-[var(--color-burn)]/25">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm text-[var(--color-muted)]">The headline offender</div>
              <div className="mt-1 text-lg text-[#e8edf5]">
                One <span className="font-mono">browser_take_screenshot</span> = 153 KB ≈{' '}
                <span className="font-mono tabular-nums text-[var(--color-burn)]">38k tokens</span> — re-read on every
                later turn in that session.
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-2xl font-bold tabular-nums text-[var(--color-burn)]">
                {money(screenshot.annuityCost)}
              </div>
              <div className="text-xs text-[var(--color-muted)]">annuity cost, {screenshot.calls} calls</div>
            </div>
          </div>
        </Panel>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Tool bytes total" value={`${(totalBytes / 1_000_000).toFixed(1)} MB`} />
        <StatTile label="Annuity cost total" value={money(totalAnnuity)} tone="burn" />
        <StatTile label="Distinct tools" value={tools.length} />
        <StatTile
          label="Worst $/call"
          value={money(Math.max(...tools.map((t) => t.annuityCost / Math.max(1, t.calls))))}
        />
      </div>

      <Panel className="h-[420px]" delay={0.2}>
        <div className="mb-3 text-sm font-medium text-[#e8edf5]">Tool payload bytes, sized by re-read annuity cost</div>
        <div className="h-[360px]">
          <ResponsiveTreeMap
            data={treeData}
            theme={nivoDarkTheme}
            identity="id"
            value="value"
            valueFormat={(v) => `${(v / 1000).toFixed(0)} KB`}
            margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
            labelSkipSize={28}
            label={(n) => n.id}
            labelTextColor="#0a0d12"
            parentLabelPosition="top"
            borderColor="#0e1218"
            borderWidth={2}
            colors={moneyPalette}
            colorBy="id"
            nodeOpacity={1}
            animate
            motionConfig="gentle"
            tooltip={({ node }) => (
              <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 text-xs">
                <div className="font-medium text-[#e8edf5]">{node.id}</div>
                <div className="text-[var(--color-muted)]">{(node.value / 1000).toFixed(0)} KB payload</div>
                <div className="font-mono tabular-nums text-[var(--color-burn)]">
                  {money((node.data as unknown as { annuityCost: number }).annuityCost)} annuity
                </div>
              </div>
            )}
          />
        </div>
      </Panel>
    </div>
  )
}
