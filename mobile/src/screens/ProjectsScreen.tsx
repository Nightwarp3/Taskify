/** Port of src/renderer/src/views/ProjectsView.tsx. */
import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import type { Project, Task } from '@shared/types'
import { useTaskifyApi } from '../providers/TaskifyProvider'
import { localDateString } from '../lib/format'
import TaskItem from '../components/TaskItem'
import AddTaskBar from '../components/AddTaskBar'

const today = localDateString()

const PROJECT_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
  '#00BCD4', '#FF5722', '#607D8B', '#E91E63', '#3F51B5'
]

export default function ProjectsScreen() {
  const api = useTaskifyApi()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [showNewProject, setShowNewProject] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0])
  const [newDesc, setNewDesc] = useState('')

  const loadProjects = useCallback(async () => {
    const list = await api.projects.list()
    setProjects(list)
    setSelectedId((cur) => (cur === null && list.length > 0 ? list[0].id : cur))
  }, [api])

  const loadTasks = useCallback(async () => {
    if (selectedId === null) { setTasks([]); return }
    setTasks(await api.tasks.listByProject(selectedId))
  }, [api, selectedId])

  useEffect(() => { loadProjects() }, [loadProjects])
  useEffect(() => { loadTasks() }, [loadTasks])

  const createProject = async () => {
    if (!newName.trim()) return
    await api.projects.add({ name: newName.trim(), color: newColor, description: newDesc || undefined })
    setNewName(''); setNewDesc(''); setNewColor(PROJECT_COLORS[0]); setShowNewProject(false)
    await loadProjects()
  }

  const archiveProject = async (id: number) => {
    await api.projects.archive(id)
    setSelectedId(null)
    await loadProjects()
  }

  const addBacklogTask = async (title: string, opts?: { estimatedMinutes?: number; tags?: string[] }) => {
    if (selectedId === null) return
    await api.tasks.add({ title, date: today, estimatedMinutes: opts?.estimatedMinutes, tags: opts?.tags, projectId: selectedId, backlog: true })
    await loadTasks()
  }

  const pullToToday = async (taskId: number) => { await api.tasks.pullToToday(taskId); await loadTasks() }
  const updateTask = async (id: number, fields: { title?: string; notes?: string; links?: string[]; tags?: string[] }) => { await api.tasks.update({ id, ...fields }); await loadTasks() }
  const deleteTask = async (id: number) => { await api.tasks.delete(id); await loadTasks() }
  const toggleTask = async (id: number, completed: boolean) => { await api.tasks.update({ id, completed }); await loadTasks() }

  const selectedProject = projects.find((p) => p.id === selectedId)

  return (
    <ScrollView className="flex-1 bg-canvas" keyboardShouldPersistTaps="handled">
      {/* Project list */}
      <View className="px-4 pt-3 pb-2 gap-1.5">
        {projects.map((p) => {
          const taskCount = tasks.filter((t) => t.projectId === p.id).length
          return (
            <Pressable
              key={p.id}
              onPress={() => setSelectedId(p.id)}
              className={`flex-row items-center gap-2.5 px-3 py-2 rounded-lg border ${
                selectedId === p.id ? 'bg-accent/10 border-accent/30' : 'border-transparent'
              }`}
            >
              <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              <Text className="flex-1 text-sm font-medium text-ink">{p.name}</Text>
              <Text className="text-xs text-ghost">{taskCount} task{taskCount !== 1 ? 's' : ''}</Text>
            </Pressable>
          )
        })}

        <Pressable onPress={() => setShowNewProject((v) => !v)} className="py-1 items-end">
          <Text className="text-xs text-accent">+ New Project</Text>
        </Pressable>

        {showNewProject && (
          <View className="bg-raised border border-rim rounded-lg p-3 gap-2">
            <TextInput
              value={newName} onChangeText={setNewName} onSubmitEditing={createProject}
              placeholder="Project name" placeholderTextColor="#9AA0A6" autoFocus
              className="bg-well border border-rim rounded px-2.5 py-1.5 text-sm text-ink"
            />
            <TextInput
              value={newDesc} onChangeText={setNewDesc}
              placeholder="Description (optional)" placeholderTextColor="#9AA0A6"
              className="bg-well border border-rim rounded px-2.5 py-1.5 text-xs text-ink"
            />
            <View className="flex-row flex-wrap gap-1.5">
              {PROJECT_COLORS.map((c) => (
                <Pressable
                  key={c} onPress={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full ${newColor === c ? 'border-2 border-accent' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </View>
            <View className="flex-row gap-3 justify-end items-center">
              <Pressable onPress={() => setShowNewProject(false)}><Text className="text-xs text-ghost">Cancel</Text></Pressable>
              <Pressable onPress={createProject} className="px-3 py-1 bg-accent rounded-pill">
                <Text className="text-xs font-medium text-on-accent">Create</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Project backlog */}
      {selectedProject && (
        <View className="border-t border-rim">
          <View className="flex-row items-center justify-between px-4 py-2">
            <View className="flex-row items-center gap-2">
              <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedProject.color }} />
              <Text className="text-sm font-semibold text-ink">{selectedProject.name}</Text>
            </View>
            <Pressable onPress={() => archiveProject(selectedProject.id)}>
              <Text className="text-xs text-ghost">Archive</Text>
            </Pressable>
          </View>

          <View>
            {tasks.filter((t) => t.projectId === selectedId).map((task) => (
              <View key={task.id} className="flex-row items-start">
                <View className="flex-1">
                  <TaskItem task={task} onToggle={toggleTask} onUpdate={updateTask} onDelete={deleteTask} />
                </View>
                <View className="pr-3 pt-3">
                  {task.backlog ? (
                    <Pressable onPress={() => pullToToday(task.id)}>
                      <Text className="text-xs text-accent font-medium">↑ Today</Text>
                    </Pressable>
                  ) : task.completed ? (
                    <Text className="text-xs text-ghost">Done</Text>
                  ) : (
                    <Text className="text-xs text-muted">In progress</Text>
                  )}
                </View>
              </View>
            ))}

            <View className="px-4 py-3">
              <AddTaskBar onAdd={addBacklogTask} projectId={selectedId} />
            </View>
          </View>
        </View>
      )}

      {projects.length === 0 && !showNewProject && (
        <View className="items-center justify-center py-20">
          <Text className="text-ghost text-sm">No projects yet</Text>
        </View>
      )}
    </ScrollView>
  )
}
