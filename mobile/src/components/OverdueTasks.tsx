/** Port of src/renderer/src/components/OverdueTasks.tsx — collapsible carry-over groups. */
import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import type { OverdueDateGroup } from '@shared/types'
import TaskItem from './TaskItem'
import { overdueLabel } from '../lib/format'

interface Props {
  groups: OverdueDateGroup[]
  onToggle: (id: number, completed: boolean) => void
  onUpdate: (id: number, fields: { title?: string; notes?: string; links?: string[]; tags?: string[] }) => void
  onDelete: (id: number) => void
}

function OverdueGroup({ group, onToggle, onUpdate, onDelete }: {
  group: OverdueDateGroup
  onToggle: Props['onToggle']
  onUpdate: Props['onUpdate']
  onDelete: Props['onDelete']
}) {
  const [open, setOpen] = useState(false)
  return (
    <View className="rounded-lg border border-rim overflow-hidden mb-2 bg-raised">
      <Pressable onPress={() => setOpen((v) => !v)} className="flex-row items-center gap-2.5 px-3 py-2.5">
        <View className="w-2 h-2 rounded-full bg-accent" />
        <Text className="flex-1 text-sm font-medium text-ink">{overdueLabel(group.date)}</Text>
        <View className="bg-accent px-2 py-0.5 rounded-pill">
          <Text className="text-xs font-medium text-on-accent">{group.tasks.length}</Text>
        </View>
        <Text className="text-ghost text-xs">{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && (
        <View className="border-t border-rim bg-canvas">
          {group.tasks.map((task) => (
            <TaskItem key={task.id} task={task} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </View>
      )}
    </View>
  )
}

export default function OverdueTasks({ groups, onToggle, onUpdate, onDelete }: Props) {
  if (groups.length === 0) return null
  const totalCount = groups.reduce((sum, g) => sum + g.tasks.length, 0)
  return (
    <View className="px-4 pb-2">
      <View className="flex-row items-center gap-2 mb-2 mt-1">
        <Text className="text-xs font-semibold text-danger uppercase tracking-wider">Carry-over</Text>
        <View className="bg-danger/10 px-1.5 py-0.5 rounded-pill">
          <Text className="text-xs text-danger font-medium">{totalCount}</Text>
        </View>
      </View>
      {groups.map((g) => (
        <OverdueGroup key={g.date} group={g} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </View>
  )
}
