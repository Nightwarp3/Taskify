/**
 * Port of src/renderer/src/components/AddTaskBar.tsx — inline add bar for the
 * project backlog (title + estimate + repeat). No scheduled-time field, matching
 * the desktop version.
 */
import { useState } from 'react'
import { View, Text, TextInput, Pressable } from 'react-native'
import type { RecurrenceSchedule } from '@shared/types'
import { extractTags, scheduleLabel } from '../lib/format'
import { useRecurrence, RepeatOptions } from './RepeatPicker'

interface Props {
  onAdd: (
    title: string,
    opts?: { estimatedMinutes?: number; tags?: string[]; projectId?: number | null; schedule?: RecurrenceSchedule }
  ) => void
  projectId?: number | null
}

export default function AddTaskBar({ onAdd, projectId }: Props) {
  const [title, setTitle] = useState('')
  const [estimate, setEstimate] = useState('')
  const [repeatOpen, setRepeatOpen] = useState(false)
  const rec = useRecurrence(false)

  const submit = () => {
    const raw = title.trim()
    if (!raw) return
    const { title: cleanTitle, tags: inlineTags } = extractTags(raw)
    const mins = estimate ? parseInt(estimate, 10) : undefined
    onAdd(cleanTitle || raw, {
      estimatedMinutes: mins && !isNaN(mins) && mins > 0 ? mins : undefined,
      tags: inlineTags.length > 0 ? inlineTags : undefined,
      projectId,
      schedule: rec.buildSchedule()
    })
    setTitle(''); setEstimate(''); setRepeatOpen(false); rec.setRepeatType('none')
  }

  const currentSchedule = rec.buildSchedule() ?? null

  return (
    <View className="bg-raised rounded-lg border border-rim overflow-hidden">
      {/* Title row */}
      <View className="flex-row items-center gap-2 px-3 pt-2.5 pb-1.5">
        <Text className="text-accent text-lg">+</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={submit}
          placeholder="Add a task… (#tag to label)"
          placeholderTextColor="#9AA0A6"
          className="flex-1 text-sm text-ink"
        />
        {title.trim().length > 0 && (
          <Pressable onPress={submit} className="px-2.5 py-1 bg-accent rounded-pill">
            <Text className="text-xs font-medium text-on-accent">Add</Text>
          </Pressable>
        )}
      </View>

      {/* Estimate row */}
      <View className="flex-row items-center gap-2 px-3 pb-1.5 border-t border-rim">
        <Text className="text-xs text-ghost pt-1.5">⏱</Text>
        <TextInput
          value={estimate}
          onChangeText={setEstimate}
          onSubmitEditing={submit}
          keyboardType="number-pad"
          placeholder="Estimated minutes (optional)"
          placeholderTextColor="#9AA0A6"
          className="flex-1 text-xs text-muted pt-1.5"
        />
        {estimate.length > 0 && <Text className="text-xs text-ghost pt-1.5">min</Text>}
      </View>

      {/* Repeat row */}
      <View className="border-t border-rim">
        <Pressable onPress={() => setRepeatOpen((v) => !v)} className="flex-row items-center gap-2 px-3 py-1.5">
          <Text className="text-xs text-ghost">↺</Text>
          <Text className="text-xs text-muted flex-1">
            Repeat: <Text className={currentSchedule ? 'text-accent' : 'text-muted'}>{scheduleLabel(currentSchedule)}</Text>
          </Text>
          <Text className="text-xs text-ghost">{repeatOpen ? '▲' : '▼'}</Text>
        </Pressable>
        {repeatOpen && <RepeatOptions state={rec} />}
      </View>
    </View>
  )
}
