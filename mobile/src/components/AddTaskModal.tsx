/** Port of src/renderer/src/components/AddTaskModal.tsx as a bottom-sheet Modal. */
import { useState } from 'react'
import { Modal, View, Text, TextInput, Pressable, Platform } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import type { RecurrenceSchedule } from '@shared/types'
import { extractTags, scheduleLabel } from '../lib/format'
import { useRecurrence, RepeatOptions } from './RepeatPicker'

interface Props {
  visible: boolean
  onAdd: (
    title: string,
    opts?: {
      estimatedMinutes?: number
      scheduledTime?: string
      tags?: string[]
      projectId?: number | null
      schedule?: RecurrenceSchedule
    }
  ) => void
  onClose: () => void
  projectId?: number | null
  recurringMode?: boolean
}

function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function AddTaskModal({ visible, onAdd, onClose, projectId, recurringMode = false }: Props) {
  const [title, setTitle] = useState('')
  const [estimate, setEstimate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [repeatOpen, setRepeatOpen] = useState(recurringMode)
  const rec = useRecurrence(recurringMode)

  const reset = () => {
    setTitle(''); setEstimate(''); setScheduledTime(''); setRepeatOpen(recurringMode)
    rec.setRepeatType(recurringMode ? 'daily' : 'none')
  }

  const submit = () => {
    const raw = title.trim()
    if (!raw) return
    const { title: cleanTitle, tags: inlineTags } = extractTags(raw)
    const mins = estimate ? parseInt(estimate, 10) : undefined
    onAdd(cleanTitle || raw, {
      estimatedMinutes: mins && !isNaN(mins) && mins > 0 ? mins : undefined,
      scheduledTime: scheduledTime || undefined,
      tags: inlineTags.length > 0 ? inlineTags : undefined,
      projectId,
      schedule: rec.buildSchedule()
    })
    reset()
    onClose()
  }

  const currentSchedule = rec.buildSchedule() ?? null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        <Pressable className="w-full bg-raised border border-rim rounded-t-xl" onPress={() => {}}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2 border-b border-rim">
            <Text className="text-sm font-semibold text-ink">
              {recurringMode ? 'Add Recurring Task' : 'Add Task'}
            </Text>
            <Pressable onPress={onClose}>
              <Text className="text-ghost text-lg">✕</Text>
            </Pressable>
          </View>

          <View className="px-4 pt-3 pb-5 gap-3">
            <TextInput
              value={title}
              onChangeText={setTitle}
              onSubmitEditing={submit}
              autoFocus
              placeholder={recurringMode ? 'Task name… (#tag to label)' : 'What needs doing? (#tag to label)'}
              placeholderTextColor="#9AA0A6"
              className="bg-well border border-rim rounded-lg px-3 py-2 text-sm text-ink"
            />

            <View className="flex-row gap-3">
              {!recurringMode && (
                <View className="flex-1">
                  <Text className="text-xs text-ghost mb-1">Time (optional)</Text>
                  <Pressable
                    onPress={() => setShowTimePicker(true)}
                    className="bg-well border border-rim rounded-lg px-2.5 py-2"
                  >
                    <Text className={`text-sm ${scheduledTime ? 'text-ink' : 'text-ghost'}`}>
                      {scheduledTime || 'Set time'}
                    </Text>
                  </Pressable>
                </View>
              )}
              <View className="flex-1">
                <Text className="text-xs text-ghost mb-1">Estimate (min)</Text>
                <TextInput
                  value={estimate}
                  onChangeText={setEstimate}
                  keyboardType="number-pad"
                  placeholder="Optional"
                  placeholderTextColor="#9AA0A6"
                  className="bg-well border border-rim rounded-lg px-2.5 py-2 text-sm text-ink"
                />
              </View>
            </View>

            {showTimePicker && (
              <DateTimePicker
                value={(() => {
                  if (!scheduledTime) return new Date()
                  const [h, m] = scheduledTime.split(':').map(Number)
                  const d = new Date(); d.setHours(h, m, 0, 0); return d
                })()}
                mode="time"
                onChange={(event, date) => {
                  setShowTimePicker(Platform.OS === 'ios')
                  if (event.type === 'set' && date) setScheduledTime(fmtTime(date))
                }}
              />
            )}

            {/* Repeat section */}
            <View className="bg-well border border-rim rounded-lg overflow-hidden">
              {!recurringMode && (
                <Pressable onPress={() => setRepeatOpen((v) => !v)} className="flex-row items-center gap-2 px-3 py-2">
                  <Text className="text-xs text-ghost">↺</Text>
                  <Text className="text-xs text-muted flex-1">
                    Repeat: <Text className={currentSchedule ? 'text-accent' : 'text-muted'}>{scheduleLabel(currentSchedule)}</Text>
                  </Text>
                  <Text className="text-xs text-ghost">{repeatOpen ? '▲' : '▼'}</Text>
                </Pressable>
              )}
              {(repeatOpen || recurringMode) && (
                <View className={!recurringMode ? 'border-t border-rim' : ''}>
                  <RepeatOptions state={rec} recurringMode={recurringMode} />
                </View>
              )}
            </View>

            <Pressable
              onPress={submit}
              disabled={!title.trim()}
              className={`py-2.5 rounded-lg items-center ${title.trim() ? 'bg-accent' : 'bg-accent/40'}`}
            >
              <Text className="text-sm font-medium text-on-accent">
                {recurringMode ? 'Create Recurring Task' : 'Add Task'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
