/** Port of src/renderer/src/views/HistoryView.tsx. */
import { useState } from 'react'
import { View, Text, Pressable, ScrollView, Platform } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useTasks } from '../hooks/useTasks'
import { offsetDateString, formatLongDate } from '../lib/format'
import TaskList from '../components/TaskList'

const yesterday = offsetDateString(-1)

export default function HistoryScreen() {
  const [date, setDate] = useState(yesterday)
  const [showPicker, setShowPicker] = useState(false)
  const { tasks, loading } = useTasks(date)
  const completed = tasks.filter((t) => t.completed).length

  return (
    <View className="flex-1 bg-canvas">
      <View className="px-4 pt-3 pb-3 bg-raised border-b border-rim">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => setShowPicker(true)} className="bg-well border border-rim rounded-md px-2.5 py-1.5">
            <Text className="text-sm text-ink">{date}</Text>
          </Pressable>
          <View>
            <Text className="text-sm font-medium text-ink">{formatLongDate(date, true)}</Text>
            {!loading && tasks.length > 0 && (
              <Text className="text-xs text-ghost mt-0.5">{completed}/{tasks.length} completed</Text>
            )}
          </View>
        </View>
        {showPicker && (
          <DateTimePicker
            value={new Date(date + 'T00:00:00')}
            mode="date"
            maximumDate={new Date(yesterday + 'T00:00:00')}
            onChange={(event, d) => {
              setShowPicker(Platform.OS === 'ios')
              if (event.type === 'set' && d) {
                setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
              }
            }}
          />
        )}
      </View>

      <ScrollView className="flex-1 px-3 pt-2" contentContainerStyle={{ paddingBottom: 24 }}>
        {loading ? (
          <View className="items-center justify-center h-24"><Text className="text-ghost text-sm">Loading…</Text></View>
        ) : (
          <TaskList
            tasks={tasks}
            onToggle={() => {}}
            onUpdate={() => {}}
            onDelete={() => {}}
            readonly
            emptyMessage="No tasks recorded for this day"
          />
        )}
      </ScrollView>
    </View>
  )
}
