/**
 * Non-reorderable task list (incomplete, then a "Done" divider + completed).
 * Used for the History screen and anywhere drag-reorder isn't needed. The
 * Today screen uses a DraggableFlatList directly for native reordering.
 */
import { View, Text } from 'react-native'
import type { Task } from '@shared/types'
import TaskItem from './TaskItem'

interface Props {
  tasks: Task[]
  onToggle: (id: number, completed: boolean) => void
  onUpdate: (id: number, fields: { title?: string; notes?: string; links?: string[]; tags?: string[] }) => void
  onDelete: (id: number) => void
  onNavigateToTemplate?: (templateId: number) => void
  readonly?: boolean
  emptyMessage?: string
}

export function DoneDivider({ count }: { count: number }) {
  return (
    <View className="px-3 pt-3 pb-1 flex-row items-center gap-2">
      <View className="flex-1 h-px bg-rim" />
      <Text className="text-xs text-ghost font-medium uppercase tracking-wider">Done ({count})</Text>
      <View className="flex-1 h-px bg-rim" />
    </View>
  )
}

export default function TaskList({
  tasks, onToggle, onUpdate, onDelete, onNavigateToTemplate, readonly,
  emptyMessage = 'No tasks yet — add one above'
}: Props) {
  const incomplete = tasks.filter((t) => !t.completed)
  const complete = tasks.filter((t) => t.completed)

  if (tasks.length === 0) {
    return (
      <View className="items-center justify-center h-24">
        <Text className="text-ghost text-sm">{emptyMessage}</Text>
      </View>
    )
  }

  return (
    <View>
      {incomplete.map((task) => (
        <TaskItem key={task.id} task={task} onToggle={onToggle} onUpdate={onUpdate}
          onDelete={onDelete} onNavigateToTemplate={onNavigateToTemplate} readonly={readonly} />
      ))}
      {complete.length > 0 && (
        <>
          <DoneDivider count={complete.length} />
          {complete.map((task) => (
            <TaskItem key={task.id} task={task} onToggle={onToggle} onUpdate={onUpdate}
              onDelete={onDelete} onNavigateToTemplate={onNavigateToTemplate} readonly={readonly} />
          ))}
        </>
      )}
    </View>
  )
}
