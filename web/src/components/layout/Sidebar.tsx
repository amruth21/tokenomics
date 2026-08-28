import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { ChevronsLeft, ChevronsRight, HardDrive, Database, FileJson } from 'lucide-react'
import { NAV_ITEMS, type ViewId } from './registry'
import type { Analysis } from '../../types/analysis'

const SOURCE_LABEL: Record<Analysis['meta']['source'], string> = {
  demo: 'Demo data',
  local: 'Your machine',
  import: 'Imported snapshot',
}

const SOURCE_ICON: Record<Analysis['meta']['source'], typeof Database> = {
  demo: Database,
  local: HardDrive,
  import: FileJson,
}

function formatRange(from: string, to: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const f = new Date(from + 'T00:00:00')
  const t = new Date(to + 'T00:00:00')
  return `${f.toLocaleDateString('en-US', opts)} – ${t.toLocaleDateString('en-US', opts)}`
}

type SidebarProps = {
  activeId: ViewId
  onSelect: (id: ViewId) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  meta: Analysis['meta']
}

export default function Sidebar({ activeId, onSelect, collapsed, onToggleCollapsed, meta }: SidebarProps) {
  const SourceIcon = SOURCE_ICON[meta.source]

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 248 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex h-full shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-ink)]"
    >
      <div className={clsx('flex items-center gap-2 px-4 pt-5 pb-4', collapsed && 'justify-center px-0')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/15">
          <span className="text-sm font-bold text-[var(--color-accent)]">T</span>
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-[#f2f5fa]">Tokenomics</span>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = item.id === activeId
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              title={collapsed ? item.label : undefined}
              className={clsx(
                'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                collapsed && 'justify-center px-0',
                active
                  ? 'bg-[var(--color-surface)] text-[#f2f5fa]'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-surface)]/60 hover:text-[#e8edf5]',
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--color-accent)]"
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <Icon size={17} strokeWidth={1.75} className="shrink-0" />
              {!collapsed && <span className="truncate font-medium">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-[var(--color-line)] px-3 py-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={clsx(
            'mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface)]/60 hover:text-[#e8edf5]',
            collapsed && 'justify-center',
          )}
        >
          {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          {!collapsed && 'Collapse'}
        </button>

        <div className={clsx('flex items-center gap-2 rounded-lg px-2 py-2', collapsed && 'justify-center px-0')}>
          <SourceIcon size={15} className="shrink-0 text-[var(--color-accent)]" strokeWidth={1.75} />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-[#e8edf5]">{SOURCE_LABEL[meta.source]}</p>
              <p className="truncate text-[11px] tabular-nums text-[var(--color-muted)]">
                {formatRange(meta.from, meta.to)}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
