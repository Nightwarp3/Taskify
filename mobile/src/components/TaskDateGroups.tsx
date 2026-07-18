import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import type { Task, TaskDateGroup } from '@shared/types'
import TaskItem from './TaskItem'

interface Props {
  title?: string
  groups: TaskDateGroup[]
  onToggle: (id: number, completed: boolean) => void
  onUpdate: (id: number, fields: { title?: string; notes?: string; links?: string[]; tags?: string[] }) => void
  onDelete?: (id: number) => void
  onPullToToday?: (id: number) => void
  readonly?: boolean
  emptyMessage?: string
  collapseWhenNoIncomplete?: boolean
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  })
}

function TaskSection({
  tasks,
  onToggle,
  onUpdate,
  onDelete,
  onPullToToday,
  readonly
}: {
  tasks: Task[]
  onToggle: Props['onToggle']
  onUpdate: Props['onUpdate']
  onDelete?: Props['onDelete']
  onPullToToday?: Props['onPullToToday']
  readonly?: boolean
}) {
  return (
    <View>
      {tasks.map((task) => (
        <View key={task.id}>
          <TaskItem
            task={task}
            onToggle={onToggle}
            onUpdate={onUpdate}
            onDelete={onDelete ?? (() => {})}
            readonly={readonly}
          />
          {!task.completed && onPullToToday && (
            <Pressable onPress={() => onPullToToday(task.id)} className="pl-10 pr-3 pb-2 -mt-1">
              <Text className="text-xs font-medium text-accent">Move to today</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  )
}

type TaskDatePanelProps = Omit<Props, 'groups' | 'title' | 'emptyMessage'> & {
  group: TaskDateGroup
}

function TaskDatePanel({
  group,
  onToggle,
  onUpdate,
  onDelete,
  onPullToToday,
  readonly,
  collapseWhenNoIncomplete = true
}: TaskDatePanelProps) {
  const incomplete = group.tasks.filter((t) => !t.completed)
  const complete = group.tasks.filter((t) => t.completed)
  const hasIncomplete = incomplete.length > 0
  const [dayOpen, setDayOpen] = useState(hasIncomplete)
  const [incompleteOpen, setIncompleteOpen] = useState(hasIncomplete)
  const [completeOpen, setCompleteOpen] = useState(false)

  useEffect(() => {
    if (collapseWhenNoIncomplete && incomplete.length === 0) {
      setIncompleteOpen(false)
      setDayOpen(false)
    }
  }, [collapseWhenNoIncomplete, incomplete.length])

  const resetDayOpen = () => {
    setDayOpen((v) => !v)
    setIncompleteOpen(hasIncomplete)
    setCompleteOpen(false)
  }

  return (
    <View className="rounded-lg border border-rim overflow-hidden mb-2 bg-raised">
      <Pressable
        onPress={resetDayOpen}
        className="flex-row items-center gap-2.5 px-3 py-2.5"
        accessibilityRole="button"
        accessibilityState={{ expanded: dayOpen }}
      >
        <View className={`w-2 h-2 rounded-full ${hasIncomplete ? 'bg-accent' : 'bg-ghost'}`} />
        <Text className="flex-1 text-sm font-medium text-ink">{formatDate(group.date)}</Text>
        <View className="bg-accent px-2 py-0.5 rounded-pill">
          <Text className="text-xs font-medium text-on-accent">{incomplete.length}</Text>
        </View>
        <View className="bg-well px-2 py-0.5 rounded-pill">
          <Text className="text-xs font-medium text-muted">{complete.length}</Text>
        </View>
        <Text className="text-ghost text-xs">{dayOpen ? '▲' : '▼'}</Text>
      </Pressable>

      {dayOpen && (
        <View className="border-t border-rim bg-canvas">
          {incomplete.length > 0 && (
            <View>
              <Pressable
                onPress={() => setIncompleteOpen((v) => !v)}
                className="flex-row items-center gap-2 px-3 py-2"
                accessibilityRole="button"
                accessibilityState={{ expanded: incompleteOpen }}
              >
                <Text className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted">Incomplete</Text>
                <Text className="text-xs font-semibold text-muted">{incomplete.length}</Text>
                <Text className="text-xs text-ghost">{incompleteOpen ? '▲' : '▼'}</Text>
              </Pressable>
              {incompleteOpen && (
                <TaskSection
                  tasks={incomplete}
                  onToggle={onToggle}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onPullToToday={onPullToToday}
                  readonly={readonly}
                />
              )}
            </View>
          )}

          {complete.length > 0 && (
            <View>
              <Pressable
                onPress={() => setCompleteOpen((v) => !v)}
                className="flex-row items-center gap-2 px-3 py-2"
                accessibilityRole="button"
                accessibilityState={{ expanded: completeOpen }}
              >
                <Text className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted">Done</Text>
                <Text className="text-xs font-semibold text-muted">{complete.length}</Text>
                <Text className="text-xs text-ghost">{completeOpen ? '▲' : '▼'}</Text>
              </Pressable>
              {completeOpen && (
                <TaskSection
                  tasks={complete}
                  onToggle={onToggle}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  readonly={readonly}
                />
              )}
            </View>
          )}
        </View>
      )}
    </View>
  )
}

export default function TaskDateGroups({ title, groups, emptyMessage, ...rest }: Props) {
  const incompleteTotal = useMemo(
    () => groups.reduce((sum, group) => sum + group.tasks.filter((task) => !task.completed).length, 0),
    [groups]
  )

  if (groups.length === 0) {
    return emptyMessage ? (
      <View className="items-center justify-center h-24">
        <Text className="text-ghost text-sm">{emptyMessage}</Text>
      </View>
    ) : null
  }

  return (
    <View className="px-4 pb-2">
      {title && (
        <View className="flex-row items-center gap-2 mb-2 mt-1">
          <Text className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</Text>
          <View className="bg-well px-1.5 py-0.5 rounded-pill">
            <Text className="text-xs text-muted font-medium">{incompleteTotal}</Text>
          </View>
        </View>
      )}
      {groups.map((group) => (
        <TaskDatePanel key={group.date} group={group} {...rest} />
      ))}
    </View>
  )
}
