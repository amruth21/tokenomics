import { Component, Suspense, lazy, type ComponentType, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { FileWarning } from 'lucide-react'
import Card from '../ui/Card'
import { SkeletonCard } from '../ui/Skeleton'
import { NAV_ITEMS, type ViewId, type ViewProps } from './registry'

// Views live at src/views/<file>.tsx and may not exist yet — the views agent works in
// parallel. import.meta.glob only picks up files that are actually present on disk, so a
// missing view never breaks the build; it just falls through to the placeholder below.
const modules = import.meta.glob<{ default: ComponentType<ViewProps> }>('../../views/*View.tsx')

const LAZY_VIEWS: Partial<Record<ViewId, ReturnType<typeof lazy<ComponentType<ViewProps>>>>> = {}
for (const item of NAV_ITEMS) {
  const path = `../../views/${item.file}.tsx`
  const loader = modules[path]
  if (loader) {
    LAZY_VIEWS[item.id] = lazy(loader as () => Promise<{ default: ComponentType<ViewProps> }>)
  }
}

function ComingOnline({ label }: { label: string }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 px-10 py-24 text-center">
      <FileWarning size={28} className="text-[var(--color-muted)]" strokeWidth={1.5} />
      <div>
        <p className="text-sm font-medium text-[var(--color-text)]">{label} is coming online</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          This view is still being built. Check back shortly.
        </p>
      </div>
    </Card>
  )
}

class ViewErrorBoundary extends Component<{ children: ReactNode; label: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error(`[ViewLoader] ${this.props.label} failed to render`, error)
  }
  render() {
    if (this.state.failed) return <ComingOnline label={this.props.label} />
    return this.props.children
  }
}

function ViewSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard className="md:col-span-3 h-64" />
    </div>
  )
}

export default function ViewLoader({ id, data }: ViewProps & { id: ViewId }) {
  const item = NAV_ITEMS.find((n) => n.id === id)
  const Comp = LAZY_VIEWS[id]

  if (!item) return null
  if (!Comp) return <ComingOnline label={item.label} />

  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      <ViewErrorBoundary label={item.label}>
        <Suspense fallback={<ViewSkeleton />}>
          <Comp data={data} />
        </Suspense>
      </ViewErrorBoundary>
    </motion.div>
  )
}
