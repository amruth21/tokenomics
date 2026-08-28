import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Menu } from 'lucide-react'
import Sidebar from './components/layout/Sidebar'
import ViewLoader from './components/layout/ViewLoader'
import DataSourceControl, { DataSourceProvider, useDataSource } from './components/DataSource'
import { DEFAULT_VIEW, NAV_ITEMS, type ViewId } from './components/layout/registry'

function useNarrowViewport(breakpoint = 1024) {
  const [narrow, setNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  )
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return narrow
}

function Shell() {
  const { analysis } = useDataSource()
  const [activeId, setActiveId] = useState<ViewId>(DEFAULT_VIEW)
  const narrow = useNarrowViewport()
  const [manualCollapse, setManualCollapse] = useState(false)
  const collapsed = narrow || manualCollapse

  const activeItem = NAV_ITEMS.find((n) => n.id === activeId)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--color-ink)]">
      <Sidebar
        activeId={activeId}
        onSelect={setActiveId}
        collapsed={collapsed}
        onToggleCollapsed={() => setManualCollapse((v) => !v)}
        meta={analysis.meta}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--color-line)] px-6 py-4">
          <div className="flex items-center gap-3">
            {narrow && (
              <button
                type="button"
                onClick={() => setManualCollapse((v) => !v)}
                className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)]"
              >
                <Menu size={18} />
              </button>
            )}
            <div>
              <h1 className="text-base font-semibold tracking-tight text-[var(--color-text)]">
                {activeItem?.label ?? 'Tokenomics'}
              </h1>
            </div>
          </div>
          <DataSourceControl />
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-6xl">
            <AnimatePresence mode="wait">
              <ViewLoader key={activeId} id={activeId} data={analysis} />
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <DataSourceProvider>
      <Shell />
    </DataSourceProvider>
  )
}
