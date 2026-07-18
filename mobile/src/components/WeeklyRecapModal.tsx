import { useEffect, useMemo, useState } from 'react'
import { Modal, View, Text, Pressable, ScrollView } from 'react-native'
import type { AppSettings } from '@shared/types'
import { useTaskifyApi } from '../providers/TaskifyProvider'
import { useHistoryRangeTasks } from '../hooks/useTasks'
import TaskDateGroups from './TaskDateGroups'

function localDateString(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function WeeklyRecapModal({ disabled }: { disabled?: boolean }) {
  const api = useTaskifyApi()
  const today = localDateString()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [visibleIds, setVisibleIds] = useState<Set<number> | null>(null)
  const { groups, loading, updateTask, pullToToday } = useHistoryRangeTasks(localDateString(-7), localDateString(-1))

  useEffect(() => {
    api.settings.get().then(setSettings)
  }, [api])

  const shouldShowToday = useMemo(() => {
    if (!settings || dismissed || disabled) return false
    const day = new Date(today + 'T00:00:00').getDay()
    return day === settings.startOfWeekDay && settings.weeklyRecapDismissedDate !== today
  }, [disabled, dismissed, settings, today])

  useEffect(() => {
    if (!shouldShowToday || loading || visibleIds) return
    const ids = groups
      .flatMap((group) => group.tasks)
      .filter((task) => !task.completed)
      .map((task) => task.id)
    setVisibleIds(new Set(ids))
  }, [groups, loading, shouldShowToday, visibleIds])

  const recapGroups = useMemo(() => {
    if (!visibleIds) return []
    return groups
      .map((group) => ({
        ...group,
        tasks: group.tasks.filter((task) => visibleIds.has(task.id))
      }))
      .filter((group) => group.tasks.length > 0)
  }, [groups, visibleIds])

  const dismiss = async () => {
    await api.settings.set('weeklyRecapDismissedDate', today)
    setDismissed(true)
  }

  const removeVisibleId = (id: number) => {
    setVisibleIds((prev) => {
      const next = new Set(prev ?? [])
      next.delete(id)
      return next
    })
  }

  const moveToToday = async (id: number) => {
    await pullToToday(id)
    removeVisibleId(id)
  }

  const toggleRecapTask = async (id: number, completed: boolean) => {
    await updateTask({ id, completed })
    if (completed) removeVisibleId(id)
  }

  const visible = shouldShowToday && !loading && !!visibleIds && recapGroups.length > 0

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-center bg-black/60 px-4">
        <View className="bg-raised border border-rim rounded-xl max-h-[82%]">
          <View className="px-4 py-3 border-b border-rim">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-ink">Start of week recap</Text>
                <Text className="text-xs text-ghost mt-0.5">Review unfinished tasks from the last 7 days.</Text>
              </View>
              <Pressable onPress={dismiss} className="px-3 py-1.5 bg-well border border-rim rounded-md">
                <Text className="text-xs font-medium text-ink">Dismiss</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView className="py-2" contentContainerStyle={{ paddingBottom: 12 }}>
            <TaskDateGroups
              groups={recapGroups}
              onToggle={toggleRecapTask}
              onUpdate={(id, fields) => updateTask({ id, ...fields })}
              onPullToToday={moveToToday}
              collapseWhenNoIncomplete={false}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
