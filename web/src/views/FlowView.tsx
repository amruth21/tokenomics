import { useState } from 'react'
import type { Analysis } from '../types/analysis'
import { ResponsiveSankey } from '@nivo/sankey'
import { nivoTheme, moneyPalette } from '../charts/theme'
import { EmptyState, Panel, ViewHeader, ViewSkeleton, money } from './_shared'

export default function FlowView({ data }: { data: Analysis }) {
  const [activeNode, setActiveNode] = useState<string | null>(null)

  if (!data) return <ViewSkeleton />
  const { flow } = data
  if (!flow || flow.nodes.length === 0 || flow.links.length === 0) {
    return <EmptyState title="No flow to show" body="Load session data to see how spend moves from model to category to main-vs-subagent." />
  }

  const total = flow.links
    .filter((l) => l.source === flow.nodes[0]?.id)
    .reduce((s, l) => s + l.value, 0)

  return (
    <div className="p-8">
      <ViewHeader
        eyebrow="Where it goes"
        title="One dollar in, four places out."
        subtitle="Every dollar splits by model, then by what it paid for — re-read context, newly written context, or output — then by whether it happened in your main session or a delegated subagent. Click a node to trace it."
      />

      <Panel className="h-[560px]" delay={0.1}>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium text-[var(--color-text)]">
            {activeNode ? `Highlighting: ${activeNode}` : `Total spend: ${money(total)}`}
          </div>
          {activeNode && (
            <button
              type="button"
              onClick={() => setActiveNode(null)}
              className="border border-[var(--color-line)] px-3 py-1 text-xs uppercase tracking-[0.1em] text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              Clear
            </button>
          )}
        </div>
        <div className="h-[500px]">
          <ResponsiveSankey
            data={flow}
            theme={nivoTheme}
            margin={{ top: 10, right: 140, bottom: 10, left: 140 }}
            align="justify"
            colors={moneyPalette}
            nodeOpacity={1}
            nodeHoverOthersOpacity={0.25}
            nodeThickness={16}
            nodeSpacing={20}
            nodeBorderWidth={0}
            nodeBorderRadius={0}
            linkOpacity={activeNode ? 0.15 : 0.45}
            linkHoverOthersOpacity={0.1}
            linkContract={2}
            linkBlendMode="normal"
            enableLinkGradient={false}
            labelPosition="outside"
            labelOrientation="horizontal"
            labelPadding={10}
            label={(n) => n.id}
            labelTextColor="#1c1914"
            animate
            motionConfig="gentle"
            onClick={(node) => {
              if ('id' in node) setActiveNode((prev) => (prev === node.id ? null : String(node.id)))
            }}
            linkTooltip={({ link }) => (
              <div className="border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-xs">
                <div className="text-[var(--color-muted)]">
                  {link.source.id} → {link.target.id}
                </div>
                <div className="font-mono font-semibold text-[var(--color-text)]">{money(link.value)}</div>
              </div>
            )}
            nodeTooltip={({ node }) => (
              <div className="border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-xs">
                <div className="font-medium text-[var(--color-text)]">{node.id}</div>
                <div className="font-mono tabular-nums text-[var(--color-muted)]">{money(node.value)}</div>
              </div>
            )}
          />
        </div>
      </Panel>
    </div>
  )
}
