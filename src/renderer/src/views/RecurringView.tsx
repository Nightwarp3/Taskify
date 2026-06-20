import { useState, useEffect } from 'react'
import type { RecurringTemplate, RecurrenceSchedule } from '../../../shared/types'
import AddTaskModal from '../components/AddTaskModal'

function scheduleLabel(s: RecurrenceSchedule): string {
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  switch (s.type) {
    case 'daily': return 'Daily (weekdays)'
    case 'weekly': return `Weekly (${DOW[s.dayOfWeek]})`
    case 'every_n_days': return `Every ${s.n} days`
    case 'monthly': return `Monthly (day ${s.dayOfMonth})`
  }
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

export default function RecurringView() {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)

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

  const handleAdd = async (
    title: string,
    opts?: {
      estimatedMinutes?: number
      tags?: string[]
      schedule?: RecurrenceSchedule
    }
  ) => {
    if (!opts?.schedule) return // should always have a schedule in recurring mode
    await window.taskify.templates.add({
      title,
      schedule: opts.schedule,
      estimatedMinutes: opts.estimatedMinutes,
      tags: opts.tags
    })
    await load()
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="px-4 pt-3 pb-2 shrink-0">
        <p className="text-xs text-ghost">
          Recurring tasks are created automatically each day their schedule fires.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pb-16">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-ghost text-sm gap-2">
            <span>No recurring tasks yet</span>
            <span className="text-xs text-ghost/60">Tap + to create one</span>
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
                      title="Delete"
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

      {/* Floating add button */}
      <button
        onClick={() => setShowModal(true)}
        title="Add recurring task"
        className="fixed bottom-5 right-5 w-12 h-12 rounded-full bg-accent text-on-accent shadow-elev-1 flex items-center justify-center text-2xl font-light hover:opacity-90 active:scale-95 transition-all z-40"
      >
        +
      </button>

      {showModal && (
        <AddTaskModal
          onAdd={handleAdd}
          onClose={() => setShowModal(false)}
          recurringMode={true}
        />
      )}
    </div>
  )
}
