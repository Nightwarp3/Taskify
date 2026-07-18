import type { OverdueDateGroup } from '../../../shared/types'
import TaskDateGroups from './TaskDateGroups'

interface Props {
  groups: OverdueDateGroup[]
  onToggle: (id: number, completed: boolean) => void
  onUpdate: (id: number, fields: { title?: string; notes?: string; links?: string[]; tags?: string[] }) => void
  onDelete: (id: number) => void
  onPullToToday?: (id: number) => void
}

export default function OverdueTasks({ groups, onToggle, onUpdate, onDelete, onPullToToday }: Props) {
  return (
    <TaskDateGroups
      title="This week"
      groups={groups}
      onToggle={onToggle}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onPullToToday={onPullToToday}
    />
  )
}
