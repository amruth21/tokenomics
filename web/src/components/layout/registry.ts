// View registry contract — frozen interface between the shell agent and the views agent.
// Each view lives at src/views/<file>.tsx and default-exports (props: ViewProps) => JSX.Element.
// Views are loaded lazily via import.meta.glob in ViewLoader.tsx, so a view file that does not
// exist yet (the other agent is still building it) renders a graceful placeholder instead of
// breaking the build.

import type { ComponentType } from 'react'
import {
  Receipt,
  GitBranch,
  Repeat,
  Wrench,
  PieChart,
  Users,
  CalendarDays,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import type { Analysis } from '../../types/analysis'

export type ViewProps = { data: Analysis }

export type ViewId =
  | 'statement'
  | 'flow'
  | 'recurring'
  | 'tools'
  | 'models'
  | 'subagents'
  | 'habits'
  | 'rework'
  | 'advisor'

export type IconType = ComponentType<{ className?: string; size?: number; strokeWidth?: number }>

export type NavItem = {
  id: ViewId
  label: string
  icon: IconType
  /** basename under src/views/, without extension */
  file: string
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'statement', label: 'Statement', icon: Receipt, file: 'StatementView' },
  { id: 'flow', label: 'Where It Goes', icon: GitBranch, file: 'FlowView' },
  { id: 'recurring', label: 'Recurring Charges', icon: Repeat, file: 'RecurringView' },
  { id: 'tools', label: 'Tool Vendors', icon: Wrench, file: 'ToolsView' },
  { id: 'models', label: 'Model Portfolio', icon: PieChart, file: 'ModelsView' },
  { id: 'subagents', label: 'Subagents', icon: Users, file: 'SubagentsView' },
  { id: 'habits', label: 'Habits', icon: CalendarDays, file: 'HabitsView' },
  { id: 'rework', label: 'Rework', icon: RotateCcw, file: 'ReworkView' },
  { id: 'advisor', label: 'Advisor', icon: Sparkles, file: 'AdvisorView' },
]

export const DEFAULT_VIEW: ViewId = 'statement'
