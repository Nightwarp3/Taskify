import { useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, Platform, TextInput } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import type { Task } from '@shared/types'
import { useHistoryRangeTasks } from '../hooks/useTasks'
import { offsetDateString } from '../lib/format'
import TaskDateGroups from '../components/TaskDateGroups'

const yesterday = offsetDateString(-1)

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function taskSearchText(task: Task): string {
  return [task.title, task.notes ?? '', task.links ?? '', task.tags ?? ''].join(' ').toLowerCase()
}

export default function HistoryScreen() {
  const [startDate, setStartDate] = useState(offsetDateString(-30))
  const [endDate, setEndDate] = useState(yesterday)
  const [picker, setPicker] = useState<'start' | 'end' | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [status, setStatus] = useState<'all' | 'incomplete' | 'complete'>('all')
  const [query, setQuery] = useState('')
  const { groups, loading, updateTask, deleteTask, pullToToday } = useHistoryRangeTasks(startDate, endDate)

  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return groups
      .map((group) => ({
        ...group,
        tasks: group.tasks.filter((task) => {
          if (status === 'incomplete' && task.completed) return false
          if (status === 'complete' && !task.completed) return false
          if (needle && !taskSearchText(task).includes(needle)) return false
          return true
        })
      }))
      .filter((group) => group.tasks.length > 0)
  }, [groups, query, status])

  const total = filteredGroups.reduce((sum, group) => sum + group.tasks.length, 0)
  const completed = filteredGroups.reduce((sum, group) => sum + group.tasks.filter((task) => task.completed).length, 0)

  return (
    <View className="flex-1 bg-canvas">
      <View className="px-4 pt-3 pb-3 bg-raised border-b border-rim">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setShowFilters((v) => !v)}
            className={`w-9 h-9 rounded-md border items-center justify-center ${showFilters ? 'border-accent bg-accent/10' : 'border-rim bg-well'}`}
          >
            <Text className={showFilters ? 'text-accent' : 'text-muted'}>⚲</Text>
          </Pressable>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search history"
            placeholderTextColor="#9AA0A6"
            autoCapitalize="none"
            className="flex-1 bg-well border border-rim rounded-md px-2.5 py-1.5 text-sm text-ink"
          />
          <View>
            <Text className="text-sm font-medium text-ink text-right">History</Text>
            {!loading && total > 0 && (
              <Text className="text-xs text-ghost mt-0.5 text-right">{completed}/{total} completed</Text>
            )}
          </View>
        </View>

        {showFilters && (
          <View className="mt-3 gap-2">
            <View className="flex-row items-center gap-2">
              <Pressable onPress={() => setPicker('start')} className="flex-1 bg-well border border-rim rounded-md px-2.5 py-1.5">
                <Text className="text-xs text-ghost">Start</Text>
                <Text className="text-sm text-ink">{startDate}</Text>
              </Pressable>
              <Pressable onPress={() => setPicker('end')} className="flex-1 bg-well border border-rim rounded-md px-2.5 py-1.5">
                <Text className="text-xs text-ghost">End</Text>
                <Text className="text-sm text-ink">{endDate}</Text>
              </Pressable>
            </View>
            <View className="flex-row rounded-pill border border-rim overflow-hidden self-start">
              {(['all', 'incomplete', 'complete'] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setStatus(option)}
                  className={`px-3 py-1.5 ${status === option ? 'bg-accent' : 'bg-well'}`}
                >
                  <Text className={`text-xs font-medium capitalize ${status === option ? 'text-on-accent' : 'text-muted'}`}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {picker && (
          <DateTimePicker
            value={new Date((picker === 'start' ? startDate : endDate) + 'T00:00:00')}
            mode="date"
            maximumDate={new Date(yesterday + 'T00:00:00')}
            onChange={(event, d) => {
              setPicker(Platform.OS === 'ios' ? picker : null)
              if (event.type === 'set' && d) {
                const next = toIsoDate(d)
                if (picker === 'start') {
                  setStartDate(next)
                  if (next > endDate) setEndDate(next)
                } else {
                  setEndDate(next)
                  if (next < startDate) setStartDate(next)
                }
              }
            }}
          />
        )}
      </View>

      <ScrollView className="flex-1 pt-2" contentContainerStyle={{ paddingBottom: 24 }}>
        {loading ? (
          <View className="items-center justify-center h-24"><Text className="text-ghost text-sm">Loading…</Text></View>
        ) : (
          <TaskDateGroups
            groups={filteredGroups}
            onToggle={(id, completed) => updateTask({ id, completed })}
            onUpdate={(id, fields) => updateTask({ id, ...fields })}
            onDelete={deleteTask}
            onPullToToday={pullToToday}
            emptyMessage="No tasks found in this range"
          />
        )}
      </ScrollView>
    </View>
  )
}
