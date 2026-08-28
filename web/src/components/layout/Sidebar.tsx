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
  // meta.from/to may be a date ('2026-07-26') or a full ISO timestamp — handle both.
  const parse = (v: string) => new Date(v.length <= 10 ? `${v}T00:00:00` : v)
  const f = parse(from)
  const t = parse(to)
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return ''
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
        {collapsed ? (
          <span className="display text-xl text-[var(--color-accent)]">$_</span>
        ) : (
          <div className="w-full leading-none">
            <span className="display text-base tracking-tight text-[var(--color-text)]">
              TOKENOMICS<span className="text-[var(--color-accent)]">_</span>
            </span>
            <div className="rule-accent mt-2" />
          </div>
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
                'group relative flex w-full items-center gap-3 border-l-2 px-3 py-2 text-[0.78rem] uppercase tracking-[0.1em] transition-colors',
                collapsed && 'justify-center px-0',
                active
                  ? 'border-[var(--color-accent)] bg-[var(--color-surface)] text-[var(--color-text)]'
                  : 'border-transparent text-[var(--color-muted)] hover:bg-[var(--color-surface)]/60 hover:text-[var(--color-text)]',
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute left-0 top-0 h-full w-[2px] bg-[var(--color-accent)]"
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
            'mb-2 flex w-full items-center gap-2 px-2 py-1.5 text-xs uppercase tracking-[0.1em] text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]',
            collapsed && 'justify-center',
          )}
        >
          {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          {!collapsed && 'Collapse'}
        </button>

        <div className={clsx('flex items-center gap-2 px-2 py-2', collapsed && 'justify-center px-0')}>
          <SourceIcon size={15} className="shrink-0 text-[var(--color-accent)]" strokeWidth={1.75} />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-[var(--color-text)]">{SOURCE_LABEL[meta.source]}</p>
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
