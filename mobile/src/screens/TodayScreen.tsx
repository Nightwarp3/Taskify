/** Port of src/renderer/src/views/TodayView.tsx. */
import { useState, useMemo } from 'react'
import { View, Text, Pressable } from 'react-native'
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist'
import type { Task } from '@shared/types'
import { useTasks, useWeekHistoryTasks } from '../hooks/useTasks'
import { localDateString, formatLongDate, parseJsonArray } from '../lib/format'
import TaskItem from '../components/TaskItem'
import { DoneDivider } from '../components/TaskList'
import OverdueTasks from '../components/OverdueTasks'
import AddTaskModal from '../components/AddTaskModal'

const today = localDateString()

export default function TodayScreen({ onNavigateToTemplate }: { onNavigateToTemplate?: (id: number) => void }) {
  const { tasks, loading, addTask, updateTask, deleteTask, reorderTasks, reload } = useTasks(today)
  const {
    groups: historyGroups,
    updateTask: updateHistory,
    deleteTask: deleteHistory,
    pullToToday
  } = useWeekHistoryTasks(today)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const t of tasks) parseJsonArray(t.tags).forEach((tag) => set.add(tag))
    return Array.from(set).sort()
  }, [tasks])

  const filteredTasks = useMemo(() => {
    if (!activeFilter) return tasks
    return tasks.filter((t) => parseJsonArray(t.tags).includes(activeFilter))
  }, [tasks, activeFilter])

  const incomplete = filteredTasks.filter((t) => !t.completed)
  const complete = filteredTasks.filter((t) => t.completed)
  const draggable = !activeFilter

  const handleToggle = (id: number, completed: boolean) => updateTask({ id, completed })
  const handleUpdate = (id: number, fields: { title?: string; notes?: string; links?: string[]; tags?: string[] }) =>
    updateTask({ id, ...fields })
  const handlePullToToday = async (id: number) => {
    await pullToToday(id)
    await reload()
  }

  const onDragEnd = ({ data }: { data: Task[] }) => {
    reorderTasks([...data.map((t) => t.id), ...complete.map((t) => t.id)])
  }

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Task>) => (
    <TaskItem
      task={item}
      onToggle={handleToggle}
      onUpdate={handleUpdate}
      onDelete={deleteTask}
      onNavigateToTemplate={onNavigateToTemplate}
      drag={draggable ? drag : undefined}
      isActive={isActive}
    />
  )

  const Header = (
    <View>
      <View className="px-4 pt-3 pb-2">
        <Text className="text-xs font-medium text-muted">{formatLongDate(today)}</Text>
        {!loading && tasks.length > 0 && (
          <Text className="text-xs text-ghost mt-0.5">
            {incomplete.length} remaining · {tasks.filter((t) => t.completed).length} done
          </Text>
        )}
      </View>
      {allTags.length > 0 && (
        <View className="px-4 pb-2 flex-row items-center gap-1.5 flex-wrap">
          <Pressable
            onPress={() => setActiveFilter(null)}
            className={`px-2.5 py-1 rounded-pill border ${!activeFilter ? 'border-accent bg-accent/10' : 'border-rim'}`}
          >
            <Text className={`text-xs ${!activeFilter ? 'text-accent' : 'text-muted'}`}>All</Text>
          </Pressable>
          {allTags.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => setActiveFilter(activeFilter === tag ? null : tag)}
              className={`px-2.5 py-1 rounded-pill border ${activeFilter === tag ? 'border-accent bg-accent/10' : 'border-rim'}`}
            >
              <Text className={`text-xs ${activeFilter === tag ? 'text-accent' : 'text-muted'}`}>#{tag}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )

  const Footer = (
    <View className="pb-24">
      {complete.length > 0 && (
        <View>
          <DoneDivider count={complete.length} />
          {complete.map((task) => (
            <TaskItem key={task.id} task={task} onToggle={handleToggle} onUpdate={handleUpdate}
              onDelete={deleteTask} onNavigateToTemplate={onNavigateToTemplate} />
          ))}
        </View>
      )}
      {tasks.length === 0 && historyGroups.length === 0 && !loading && (
        <View className="items-center justify-center h-32 gap-2">
          <Text className="text-ghost text-sm">No tasks today</Text>
          <Text className="text-ghost/60 text-xs">Tap + to add one</Text>
        </View>
      )}
      {historyGroups.length > 0 && (
        <View className="mt-2">
          <OverdueTasks
            groups={historyGroups}
            onToggle={(id, completed) => updateHistory({ id, completed })}
            onUpdate={(id, fields) => updateHistory({ id, ...fields })}
            onDelete={deleteHistory}
            onPullToToday={handlePullToToday}
          />
        </View>
      )}
    </View>
  )

  return (
    <View className="flex-1 bg-canvas">
      <DraggableFlatList
        data={incomplete}
        keyExtractor={(t) => String(t.id)}
        renderItem={renderItem}
        onDragEnd={onDragEnd}
        ListHeaderComponent={Header}
        ListFooterComponent={Footer}
        contentContainerStyle={{ paddingHorizontal: 4 }}
        activationDistance={12}
      />

      <Pressable
        onPress={() => setShowModal(true)}
        className="absolute bottom-5 right-5 w-14 h-14 rounded-full bg-accent items-center justify-center shadow-lg"
        style={{ elevation: 4 }}
      >
        <Text className="text-on-accent text-3xl" style={{ marginTop: -2 }}>+</Text>
      </Pressable>

      <AddTaskModal
        visible={showModal}
        onAdd={(title, opts) => addTask(title, opts)}
        onClose={() => setShowModal(false)}
      />
    </View>
  )
}
