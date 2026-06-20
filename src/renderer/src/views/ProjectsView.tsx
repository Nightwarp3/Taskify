import { useState, useEffect, useCallback } from 'react'
import type { Project, Task } from '../../../shared/types'
import TaskItem from '../components/TaskItem'
import AddTaskBar from '../components/AddTaskBar'

function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const today = localDateString()

const PROJECT_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
  '#F44336', '#00BCD4', '#FF5722', '#607D8B',
  '#E91E63', '#3F51B5'
]

export default function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [showNewProject, setShowNewProject] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0])
  const [newDesc, setNewDesc] = useState('')

  const loadProjects = useCallback(async () => {
    const list = await window.taskify.projects.list()
    setProjects(list)
    if (list.length > 0 && selectedId === null) setSelectedId(list[0].id)
  }, [selectedId])

  const loadTasks = useCallback(async () => {
    if (selectedId === null) { setTasks([]); return }
    const list = await window.taskify.tasks.listByProject(selectedId)
    setTasks(list)
  }, [selectedId])

  useEffect(() => { loadProjects() }, [])
  useEffect(() => { loadTasks() }, [selectedId])

  const createProject = async () => {
    if (!newName.trim()) return
    await window.taskify.projects.add({ name: newName.trim(), color: newColor, description: newDesc || undefined })
    setNewName('')
    setNewDesc('')
    setNewColor(PROJECT_COLORS[0])
    setShowNewProject(false)
    await loadProjects()
  }

  const archiveProject = async (id: number) => {
    await window.taskify.projects.archive(id)
    setSelectedId(null)
    await loadProjects()
  }

  const addBacklogTask = async (
    title: string,
    opts?: { estimatedMinutes?: number; tags?: string[] }
  ) => {
    if (selectedId === null) return
    await window.taskify.tasks.add({
      title,
      date: today,
      estimatedMinutes: opts?.estimatedMinutes,
      tags: opts?.tags,
      projectId: selectedId,
      backlog: true
    })
    await loadTasks()
  }

  const pullToToday = async (taskId: number) => {
    await window.taskify.tasks.pullToToday(taskId)
    await loadTasks()
  }

  const updateTask = async (
    id: number,
    fields: { title?: string; notes?: string; links?: string[]; tags?: string[] }
  ) => {
    await window.taskify.tasks.update({ id, ...fields })
    await loadTasks()
  }

  const deleteTask = async (id: number) => {
    await window.taskify.tasks.delete(id)
    await loadTasks()
  }

  const toggleTask = async (id: number, completed: boolean) => {
    await window.taskify.tasks.update({ id, completed })
    await loadTasks()
  }

  const selectedProject = projects.find((p) => p.id === selectedId)

  return (
    <div className="flex flex-col h-full">
      {/* Project list */}
      <div className="px-4 pt-3 pb-2 shrink-0 space-y-1.5">
        {projects.map((p) => {
          const projectTasks = tasks.filter((t) => t.projectId === p.id)
          const taskCount = projectTasks.length
          return (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                selectedId === p.id ? 'bg-accent/10 border border-accent/30' : 'hover:bg-hover border border-transparent'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              <span className="flex-1 text-sm font-medium text-ink truncate">{p.name}</span>
              <span className="text-xs text-ghost">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
            </button>
          )
        })}

        <button
          onClick={() => setShowNewProject((v) => !v)}
          className="w-full text-xs text-accent hover:opacity-70 transition-opacity text-right py-1"
        >
          + New Project
        </button>

        {showNewProject && (
          <div className="bg-raised border border-rim rounded-lg p-3 space-y-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createProject()}
              placeholder="Project name"
              className="w-full bg-well border border-rim rounded px-2.5 py-1.5 text-sm text-ink placeholder-ghost outline-none focus:border-accent"
              autoFocus
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full bg-well border border-rim rounded px-2.5 py-1.5 text-xs text-ink placeholder-ghost outline-none focus:border-accent"
            />
            <div className="flex gap-1.5 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${newColor === c ? 'scale-125 ring-2 ring-accent ring-offset-1' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNewProject(false)} className="text-xs text-ghost hover:text-muted">Cancel</button>
              <button onClick={createProject} className="text-xs px-3 py-1 bg-accent text-on-accent rounded-pill font-medium hover:opacity-90">
                Create
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Project backlog */}
      {selectedProject && (
        <div className="flex-1 flex flex-col min-h-0 border-t border-rim">
          <div className="flex items-center justify-between px-4 py-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedProject.color }} />
              <span className="text-sm font-semibold text-ink">{selectedProject.name}</span>
            </div>
            <button
              onClick={() => archiveProject(selectedProject.id)}
              className="text-xs text-ghost hover:text-muted transition-colors"
            >
              Archive
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tasks.filter((t) => t.projectId === selectedId).map((task) => {
              const isPulled = !task.backlog
              return (
                <div key={task.id} className="relative group">
                  <TaskItem
                    task={task}
                    onToggle={toggleTask}
                    onUpdate={updateTask}
                    onDelete={deleteTask}
                    readonly={false}
                  />
                  {!isPulled && (
                    <button
                      onClick={() => pullToToday(task.id)}
                      title="Pull to today"
                      className="absolute right-10 top-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-accent hover:opacity-70 font-medium"
                    >
                      ↑ Today
                    </button>
                  )}
                  {isPulled && !task.completed && (
                    <span className="absolute right-10 top-3 text-xs text-muted">In progress</span>
                  )}
                  {isPulled && task.completed && (
                    <span className="absolute right-10 top-3 text-xs text-ghost">Done</span>
                  )}
                </div>
              )
            })}

            <div className="px-4 pb-3">
              <AddTaskBar onAdd={addBacklogTask} projectId={selectedId} />
            </div>
          </div>
        </div>
      )}

      {projects.length === 0 && !showNewProject && (
        <div className="flex-1 flex items-center justify-center text-ghost text-sm">
          No projects yet
        </div>
      )}
    </div>
  )
}
