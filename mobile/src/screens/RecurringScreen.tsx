/** Port of src/renderer/src/views/RecurringView.tsx. */
import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import type { RecurringTemplate, RecurrenceSchedule } from '@shared/types'
import { useTaskifyApi } from '../providers/TaskifyProvider'
import { scheduleLabel } from '../lib/format'
import AddTaskModal from '../components/AddTaskModal'

function TemplateEditPanel({ template, onSave, onCancel }: {
  template: RecurringTemplate
  onSave: (fields: { title?: string; estimatedMinutes?: number | null }) => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState(template.title)
  const [estimate, setEstimate] = useState(String(template.estimatedMinutes ?? ''))

  const save = async () => {
    const mins = estimate ? parseInt(estimate, 10) : null
    await onSave({ title: title.trim() || undefined, estimatedMinutes: mins && !isNaN(mins) ? mins : null })
  }

  return (
    <View className="mt-2 pt-2 border-t border-rim gap-2">
      <TextInput value={title} onChangeText={setTitle}
        className="bg-well border border-rim rounded px-2 py-1 text-sm text-ink" />
      <View className="flex-row items-center gap-2">
        <Text className="text-xs text-ghost">⏱</Text>
        <TextInput value={estimate} onChangeText={setEstimate} keyboardType="number-pad" placeholder="Est. minutes"
          placeholderTextColor="#9AA0A6" className="w-24 bg-well border border-rim rounded px-2 py-1 text-xs text-ink" />
        <Text className="text-xs text-ghost">min</Text>
      </View>
      <View className="flex-row gap-3 justify-end items-center">
        <Pressable onPress={onCancel}><Text className="text-xs text-ghost">Cancel</Text></Pressable>
        <Pressable onPress={save} className="px-3 py-1 bg-accent rounded-pill">
          <Text className="text-xs font-medium text-on-accent">Save</Text>
        </Pressable>
      </View>
    </View>
  )
}

export default function RecurringScreen() {
  const api = useTaskifyApi()
  const [templates, setTemplates] = useState<RecurringTemplate[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async () => setTemplates(await api.templates.list()), [api])
  useEffect(() => { load() }, [load])

  const toggleActive = async (id: number, active: boolean) => { await api.templates.setActive(id, active); await load() }
  const deleteTemplate = async (id: number) => {
    await api.templates.delete(id)
    if (editingId === id) setEditingId(null)
    await load()
  }

  const handleAdd = async (title: string, opts?: { estimatedMinutes?: number; tags?: string[]; schedule?: RecurrenceSchedule }) => {
    if (!opts?.schedule) return
    await api.templates.add({ title, schedule: opts.schedule, estimatedMinutes: opts.estimatedMinutes, tags: opts.tags })
    await load()
  }

  return (
    <View className="flex-1 bg-canvas">
      <View className="px-4 pt-3 pb-2">
        <Text className="text-xs text-ghost">
          Recurring tasks are created automatically each day their schedule fires.
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 96 }}>
        {templates.length === 0 ? (
          <View className="items-center justify-center h-32 gap-2">
            <Text className="text-ghost text-sm">No recurring tasks yet</Text>
            <Text className="text-ghost/60 text-xs">Tap + to create one</Text>
          </View>
        ) : (
          <View className="px-4 gap-2">
            {templates.map((tmpl) => (
              <View key={tmpl.id} className="bg-raised border border-rim rounded-lg p-3">
                <View className="flex-row items-start gap-2">
                  <Text className="text-accent text-sm mt-0.5">↺</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-ink">{tmpl.title}</Text>
                    <Text className="text-xs text-muted mt-0.5">{scheduleLabel(tmpl.schedule)}</Text>
                    {tmpl.estimatedMinutes != null && (
                      <Text className="text-xs text-ghost">⏱ {tmpl.estimatedMinutes} min</Text>
                    )}
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => toggleActive(tmpl.id, !tmpl.active)}
                      className={`px-2 py-0.5 rounded-pill border ${tmpl.active ? 'bg-accent/10 border-accent/30' : 'bg-well border-rim'}`}
                    >
                      <Text className={`text-xs font-medium ${tmpl.active ? 'text-accent' : 'text-ghost'}`}>
                        {tmpl.active ? 'Active' : 'Paused'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => deleteTemplate(tmpl.id)}>
                      <Text className="text-ghost text-xs">✕</Text>
                    </Pressable>
                  </View>
                </View>

                {editingId === tmpl.id ? (
                  <TemplateEditPanel
                    template={tmpl}
                    onSave={async (fields) => { await api.templates.update({ id: tmpl.id, ...fields }); setEditingId(null); await load() }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <Pressable onPress={() => setEditingId(tmpl.id)} className="mt-1.5">
                    <Text className="text-xs text-ghost">Edit</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => setShowModal(true)}
        className="absolute bottom-5 right-5 w-14 h-14 rounded-full bg-accent items-center justify-center"
        style={{ elevation: 4 }}
      >
        <Text className="text-on-accent text-3xl" style={{ marginTop: -2 }}>+</Text>
      </Pressable>

      <AddTaskModal visible={showModal} onAdd={handleAdd} onClose={() => setShowModal(false)} recurringMode />
    </View>
  )
}
