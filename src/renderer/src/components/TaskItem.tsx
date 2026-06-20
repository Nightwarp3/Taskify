import { useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../../../shared/types'

interface Props {
  task: Task
  onToggle: (id: number, completed: boolean) => void
  onUpdate: (id: number, fields: { title?: string; notes?: string; links?: string[]; tags?: string[] }) => void
  onDelete: (id: number) => void
  onNavigateToTemplate?: (templateId: number) => void
  readonly?: boolean
}

const TAG_PALETTE = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
  '#F44336', '#00BCD4', '#FF5722', '#607D8B'
]

function tagColor(tag: string): string {
  let hash = 0
  for (const c of tag) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length]
}

export default function TaskItem({ task, onToggle, onUpdate, onDelete, onNavigateToTemplate, readonly }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [linkInput, setLinkInput] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)
  const titleRef = useRef<HTMLInputElement>(null)

  const links: string[] = (() => {
    try { return task.links ? JSON.parse(task.links) : [] }
    catch { return [] }
  })()

  const tags: string[] = (() => {
    try { return task.tags ? JSON.parse(task.tags) : [] }
    catch { return [] }
  })()

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: readonly
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  }

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

  const removeLink = (idx: number) => {
    onUpdate(task.id, { links: links.filter((_, i) => i !== idx) })
  }

  const addTag = (raw: string) => {
    const tag = raw.replace(/^#/, '').trim().toLowerCase()
    if (!tag || tags.includes(tag)) return
    onUpdate(task.id, { tags: [...tags, tag] })
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    onUpdate(task.id, { tags: tags.filter((t) => t !== tag) })
  }

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div
        className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${
          task.completed ? 'opacity-40' : 'hover:bg-hover'
        }`}
      >
        {/* Drag handle */}
        {!readonly && (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 text-ghost cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-sm leading-none pt-0.5"
            tabIndex={-1}
          >
            ⠿
          </button>
        )}

        {/* Circular checkbox */}
        <button
          onClick={() => !readonly && onToggle(task.id, !task.completed)}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
            task.completed
              ? 'bg-accent border-accent'
              : 'border-rim hover:border-accent'
          }`}
        >
          {task.completed && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <polyline points="1,4 3.5,6.5 9,1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {task.templateId != null && (
              <button
                onClick={() => onNavigateToTemplate?.(task.templateId!)}
                title="Recurring task — click to view template"
                className="text-accent text-xs shrink-0 hover:opacity-70 transition-opacity leading-none"
                tabIndex={-1}
              >
                ↺
              </button>
            )}
            {editingTitle && !readonly ? (
              <input
                ref={titleRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle()
                  if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(task.title) }
                }}
                className="flex-1 bg-well border border-accent rounded px-1.5 py-0.5 text-sm text-ink outline-none min-w-0"
                autoFocus
              />
            ) : (
              <span
                onDoubleClick={() => {
                  if (!readonly) { setEditingTitle(true); setTimeout(() => titleRef.current?.select(), 0) }
                }}
                className={`text-sm block leading-snug truncate ${task.completed ? 'line-through text-ghost' : 'text-ink'}`}
              >
                {task.title}
              </span>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium text-white"
                  style={{ backgroundColor: tagColor(tag) }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {task.estimatedMinutes && !task.completed && (
            <span className="text-xs text-ghost mt-0.5 block">
              ⏱ {task.estimatedMinutes} min
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-6 h-6 flex items-center justify-center rounded text-ghost hover:text-muted hover:bg-well transition-colors text-xs"
            title="Notes, tags & links"
          >
            {expanded ? '▲' : '▼'}
          </button>
          {!readonly && (
            <button
              onClick={() => onDelete(task.id)}
              className="w-6 h-6 flex items-center justify-center rounded text-ghost hover:text-danger hover:bg-well transition-colors text-xs"
              title="Delete"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="mx-3 mb-2 bg-canvas rounded-lg border border-rim p-3 space-y-3">
          {/* Notes */}
          <div>
            <div className="text-xs font-medium text-muted mb-1">Notes</div>
            {editingNotes && !readonly ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveNotes}
                rows={3}
                placeholder="Add notes…"
                className="w-full bg-raised border border-rim rounded-md px-2.5 py-2 text-xs text-ink placeholder-ghost outline-none focus:border-accent resize-none transition-colors"
                autoFocus
              />
            ) : (
              <p
                onClick={() => { if (!readonly) setEditingNotes(true) }}
                className={`text-xs rounded-md px-2.5 py-2 min-h-[2rem] ${
                  notes ? 'text-ink' : 'text-ghost italic'
                } ${!readonly ? 'cursor-text hover:bg-raised transition-colors' : ''}`}
              >
                {notes || 'Click to add notes…'}
              </p>
            )}
          </div>

          {/* Tags */}
          <div>
            <div className="text-xs font-medium text-muted mb-1">Tags</div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium text-white"
                  style={{ backgroundColor: tagColor(tag) }}
                >
                  #{tag}
                  {!readonly && (
                    <button onClick={() => removeTag(tag)} className="ml-0.5 opacity-70 hover:opacity-100">
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>
            {!readonly && (
              <div className="flex gap-1.5">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addTag(tagInput) }
                  }}
                  placeholder="#tag"
                  className="flex-1 bg-raised border border-rim rounded px-2 py-1 text-xs text-ink placeholder-ghost outline-none focus:border-accent transition-colors"
                />
                <button
                  onClick={() => addTag(tagInput)}
                  className="text-xs px-3 py-1 bg-well hover:bg-hover rounded text-muted font-medium transition-colors"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Links */}
          <div>
            <div className="text-xs font-medium text-muted mb-1">Links</div>
            <ul className="space-y-1">
              {links.map((link, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-accent hover:underline truncate flex-1"
                  >
                    {link}
                  </a>
                  {!readonly && (
                    <button
                      onClick={() => removeLink(i)}
                      className="text-ghost hover:text-danger text-xs shrink-0 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!readonly && (
              <div className="flex gap-1.5 mt-2">
                <input
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addLink()}
                  placeholder="https://…"
                  className="flex-1 bg-raised border border-rim rounded px-2 py-1 text-xs text-ink placeholder-ghost outline-none focus:border-accent transition-colors"
                />
                <button
                  onClick={addLink}
                  className="text-xs px-3 py-1 bg-well hover:bg-hover rounded text-muted font-medium transition-colors"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
