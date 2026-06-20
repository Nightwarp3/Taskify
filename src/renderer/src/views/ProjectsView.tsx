import { useState, useEffect, useCallback } from 'react'
import type { Project, Task, RecurringTemplate, RecurrenceSchedule } from '../../../shared/types'
import TaskItem from '../components/TaskItem'
import AddTaskBar from '../components/AddTaskBar'

const today = new Date().toISOString().slice(0, 10)

const PROJECT_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
  '#F44336', '#00BCD4', '#FF5722', '#607D8B',
  '#E91E63', '#3F51B5'
]

function scheduleLabel(s: RecurrenceSchedule): string {
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  switch (s.type) {
    case 'daily': return 'Daily'
    case 'weekly': return `Weekly (${DOW[s.dayOfWeek]})`
    case 'every_n_days': return `Every ${s.n} days`
    case 'monthly': return `Monthly (day ${s.dayOfMonth})`
  }
}

// ── Projects sub-tab ──────────────────────────────────────────────────────
function ProjectsTab() {
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
              <AddTaskBar
                onAdd={addBacklogTask}
                projectId={selectedId}
              />
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

// ── Recurring sub-tab ─────────────────────────────────────────────────────
function RecurringTab() {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)

  const load = async () => {
    const list = await window.taskify.templates.list()
    setTemplates(list)
  }

  useEffect(() => { load() }, [])

  const toggleActive = async (id: number, active: boolean) => {
    await window.taskify.templates.setActive(id, active)
    await load()
  }

  const deleteTemplate = async (id: number) => {
    await window.taskify.templates.delete(id)
    if (editingId === id) setEditingId(null)
    await load()
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 pt-3 pb-2 shrink-0">
        <p className="text-xs text-ghost">
          Recurring tasks are created automatically each day their schedule fires.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-ghost text-sm">
          No recurring tasks yet — add one with the ↺ repeat picker in Today view
        </div>
      ) : (
        <div className="px-4 space-y-2 pb-4">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="bg-raised border border-rim rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-accent text-sm mt-0.5 shrink-0">↺</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{tmpl.title}</div>
                  <div className="text-xs text-muted mt-0.5">{scheduleLabel(tmpl.schedule)}</div>
                  {tmpl.estimatedMinutes && (
                    <div className="text-xs text-ghost">⏱ {tmpl.estimatedMinutes} min</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Active toggle */}
                  <button
                    onClick={() => toggleActive(tmpl.id, !tmpl.active)}
                    className={`text-xs px-2 py-0.5 rounded-pill font-medium transition-colors ${
                      tmpl.active
                        ? 'bg-accent/10 text-accent border border-accent/30'
                        : 'bg-well text-ghost border border-rim'
                    }`}
                  >
                    {tmpl.active ? 'Active' : 'Paused'}
                  </button>
                  <button
                    onClick={() => deleteTemplate(tmpl.id)}
                    className="text-ghost hover:text-danger text-xs transition-colors"
                    title="Delete template"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {editingId === tmpl.id && (
                <TemplateEditPanel
                  template={tmpl}
                  onSave={async (fields) => {
                    await window.taskify.templates.update({ id: tmpl.id, ...fields })
                    setEditingId(null)
                    await load()
                  }}
                  onCancel={() => setEditingId(null)}
                />
              )}

              {editingId !== tmpl.id && (
                <button
                  onClick={() => setEditingId(tmpl.id)}
                  className="mt-1.5 text-xs text-ghost hover:text-muted transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TemplateEditPanel({
  template,
  onSave,
  onCancel
}: {
  template: RecurringTemplate
  onSave: (fields: { title?: string; estimatedMinutes?: number | null }) => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState(template.title)
  const [estimate, setEstimate] = useState(String(template.estimatedMinutes ?? ''))

  const save = async () => {
    const mins = estimate ? parseInt(estimate, 10) : null
    await onSave({
      title: title.trim() || undefined,
      estimatedMinutes: mins && !isNaN(mins) ? mins : null
    })
  }

  return (
    <div className="mt-2 pt-2 border-t border-rim space-y-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-well border border-rim rounded px-2 py-1 text-sm text-ink outline-none focus:border-accent"
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-ghost">⏱</span>
        <input
          type="number"
          value={estimate}
          onChange={(e) => setEstimate(e.target.value)}
          placeholder="Est. minutes"
          className="w-20 bg-well border border-rim rounded px-2 py-1 text-xs text-ink outline-none focus:border-accent"
        />
        <span className="text-xs text-ghost">min</span>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-ghost hover:text-muted">Cancel</button>
        <button onClick={save} className="text-xs px-3 py-1 bg-accent text-on-accent rounded-pill font-medium hover:opacity-90">
          Save
        </button>
      </div>
    </div>
  )
}

// ── Main ProjectsView ─────────────────────────────────────────────────────
type SubTab = 'projects' | 'recurring'

export default function ProjectsView() {
  const [subTab, setSubTab] = useState<SubTab>('projects')

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab nav */}
      <div className="px-4 pt-3 shrink-0 flex gap-1 border-b border-rim pb-2">
        {(['projects', 'recurring'] as SubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`text-xs px-3 py-1 rounded-pill font-medium transition-colors capitalize ${
              subTab === t
                ? 'bg-accent text-on-accent'
                : 'text-muted hover:text-ink hover:bg-well'
            }`}
          >
            {t === 'recurring' ? '↺ Recurring' : 'Projects'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {subTab === 'projects' && <ProjectsTab />}
        {subTab === 'recurring' && <RecurringTab />}
      </div>
    </div>
  )
}

export { RecurringTab }
