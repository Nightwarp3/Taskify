/**
 * Port of src/renderer/src/components/TaskItem.tsx using RN primitives.
 * Drag is initiated by long-pressing the grip handle (wired by TaskList via the
 * optional `drag` prop). Title editing is via the ✎ action (replacing the
 * desktop double-click). Notes/tags/links live in the collapsible detail panel.
 */
import { useState } from 'react'
import { View, Text, TextInput, Pressable, Linking } from 'react-native'
import type { Task } from '@shared/types'
import { tagColor, parseJsonArray } from '../lib/format'

interface Props {
  task: Task
  onToggle: (id: number, completed: boolean) => void
  onUpdate: (id: number, fields: { title?: string; notes?: string; links?: string[]; tags?: string[] }) => void
  onDelete: (id: number) => void
  onNavigateToTemplate?: (templateId: number) => void
  readonly?: boolean
  drag?: () => void
  isActive?: boolean
}

export default function TaskItem({
  task, onToggle, onUpdate, onDelete, onNavigateToTemplate, readonly, drag, isActive
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [linkInput, setLinkInput] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)

  const links = parseJsonArray(task.links)
  const tags = parseJsonArray(task.tags)

  const saveNotes = () => {
    setEditingNotes(false)
    onUpdate(task.id, { notes })
  }

  const saveTitle = () => {
    setEditingTitle(false)
    const t = titleDraft.trim()
    if (t && t !== task.title) onUpdate(task.id, { title: t })
    else setTitleDraft(task.title)
  }

  const addLink = () => {
    const url = linkInput.trim()
    if (!url) return
    onUpdate(task.id, { links: [...links, url] })
    setLinkInput('')
  }

  const removeLink = (idx: number) => onUpdate(task.id, { links: links.filter((_, i) => i !== idx) })

  const addTag = (raw: string) => {
    const tag = raw.replace(/^#/, '').trim().toLowerCase()
    if (!tag || tags.includes(tag)) return
    onUpdate(task.id, { tags: [...tags, tag] })
    setTagInput('')
  }

  const removeTag = (tag: string) => onUpdate(task.id, { tags: tags.filter((t) => t !== tag) })

  return (
    <View className={isActive ? 'opacity-60' : ''}>
      <View className={`flex-row items-start gap-2.5 px-3 py-2.5 rounded-lg ${task.completed ? 'opacity-40' : ''}`}>
        {/* Drag handle */}
        {!readonly && drag && (
          <Pressable onLongPress={drag} delayLongPress={150} className="pt-1 shrink-0">
            <Text className="text-ghost text-base leading-none">⠿</Text>
          </Pressable>
        )}

        {/* Circular checkbox */}
        <Pressable
          onPress={() => !readonly && onToggle(task.id, !task.completed)}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 items-center justify-center ${
            task.completed ? 'bg-accent border-accent' : 'border-rim'
          }`}
        >
          {task.completed && <Text className="text-white text-xs leading-none">✓</Text>}
        </Pressable>

        {/* Content */}
        <View className="flex-1 min-w-0 pt-0.5">
          <View className="flex-row items-center gap-1.5">
            {task.templateId != null && (
              <Pressable onPress={() => onNavigateToTemplate?.(task.templateId!)}>
                <Text className="text-accent text-xs">↺</Text>
              </Pressable>
            )}
            {editingTitle && !readonly ? (
              <TextInput
                value={titleDraft}
                onChangeText={setTitleDraft}
                onBlur={saveTitle}
                onSubmitEditing={saveTitle}
                autoFocus
                className="flex-1 bg-well border border-accent rounded px-1.5 py-0.5 text-sm text-ink"
              />
            ) : (
              <Text className={`flex-1 text-sm leading-snug ${task.completed ? 'line-through text-ghost' : 'text-ink'}`}>
                {task.title}
              </Text>
            )}
          </View>

          {/* Tags */}
          {tags.length > 0 && (
            <View className="flex-row flex-wrap gap-1 mt-1">
              {tags.map((tag) => (
                <View key={tag} className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: tagColor(tag) }}>
                  <Text className="text-xs font-medium text-white">#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {task.estimatedMinutes != null && !task.completed && (
            <Text className="text-xs text-ghost mt-0.5">⏱ {task.estimatedMinutes} min</Text>
          )}
        </View>

        {/* Actions */}
        <View className="flex-row items-center gap-1 shrink-0 mt-0.5">
          {!readonly && !editingTitle && (
            <Pressable onPress={() => setEditingTitle(true)} className="w-7 h-7 items-center justify-center">
              <Text className="text-ghost text-xs">✎</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setExpanded((v) => !v)} className="w-7 h-7 items-center justify-center">
            <Text className="text-ghost text-xs">{expanded ? '▲' : '▼'}</Text>
          </Pressable>
          {!readonly && (
            <Pressable onPress={() => onDelete(task.id)} className="w-7 h-7 items-center justify-center">
              <Text className="text-ghost text-xs">✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Expanded detail panel */}
      {expanded && (
        <View className="mx-3 mb-2 bg-canvas rounded-lg border border-rim p-3 gap-3">
          {/* Notes */}
          <View>
            <Text className="text-xs font-medium text-muted mb-1">Notes</Text>
            {editingNotes && !readonly ? (
              <TextInput
                value={notes}
                onChangeText={setNotes}
                onBlur={saveNotes}
                multiline
                numberOfLines={3}
                placeholder="Add notes…"
                placeholderTextColor="#9AA0A6"
                autoFocus
                className="bg-raised border border-rim rounded-md px-2.5 py-2 text-xs text-ink"
              />
            ) : (
              <Pressable onPress={() => { if (!readonly) setEditingNotes(true) }}>
                <Text className={`text-xs rounded-md px-2.5 py-2 ${notes ? 'text-ink' : 'text-ghost italic'}`}>
                  {notes || 'Tap to add notes…'}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Tags */}
          <View>
            <Text className="text-xs font-medium text-muted mb-1">Tags</Text>
            <View className="flex-row flex-wrap gap-1 mb-1.5">
              {tags.map((tag) => (
                <View key={tag} className="flex-row items-center rounded-full px-1.5 py-0.5" style={{ backgroundColor: tagColor(tag) }}>
                  <Text className="text-xs font-medium text-white">#{tag}</Text>
                  {!readonly && (
                    <Pressable onPress={() => removeTag(tag)} className="ml-1">
                      <Text className="text-xs text-white opacity-80">✕</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
            {!readonly && (
              <View className="flex-row gap-1.5">
                <TextInput
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={() => addTag(tagInput)}
                  placeholder="#tag"
                  placeholderTextColor="#9AA0A6"
                  autoCapitalize="none"
                  className="flex-1 bg-raised border border-rim rounded px-2 py-1 text-xs text-ink"
                />
                <Pressable onPress={() => addTag(tagInput)} className="px-3 py-1 bg-well rounded justify-center">
                  <Text className="text-xs text-muted font-medium">Add</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Links */}
          <View>
            <Text className="text-xs font-medium text-muted mb-1">Links</Text>
            <View className="gap-1">
              {links.map((link, i) => (
                <View key={i} className="flex-row items-center gap-1.5">
                  <Pressable className="flex-1" onPress={() => Linking.openURL(link).catch(() => {})}>
                    <Text className="text-xs text-accent" numberOfLines={1}>{link}</Text>
                  </Pressable>
                  {!readonly && (
                    <Pressable onPress={() => removeLink(i)}>
                      <Text className="text-ghost text-xs">✕</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
            {!readonly && (
              <View className="flex-row gap-1.5 mt-2">
                <TextInput
                  value={linkInput}
                  onChangeText={setLinkInput}
                  onSubmitEditing={addLink}
                  placeholder="https://…"
                  placeholderTextColor="#9AA0A6"
                  autoCapitalize="none"
                  keyboardType="url"
                  className="flex-1 bg-raised border border-rim rounded px-2 py-1 text-xs text-ink"
                />
                <Pressable onPress={addLink} className="px-3 py-1 bg-well rounded justify-center">
                  <Text className="text-xs text-muted font-medium">Add</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
