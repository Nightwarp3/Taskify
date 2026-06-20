import { useState, useRef, useEffect } from 'react'
import type { RecurrenceSchedule } from '../../../shared/types'

function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function extractTags(raw: string): { title: string; tags: string[] } {
  const tags: string[] = []
  const title = raw.replace(/#(\w+)/g, (_, tag) => { tags.push(tag); return '' }).trim()
  return { title, tags }
}

function scheduleLabel(schedule: RecurrenceSchedule | null): string {
  if (!schedule) return 'Off'
  switch (schedule.type) {
    case 'daily': return 'Daily'
    case 'weekly': return `Weekly (${DOW_LABELS[schedule.dayOfWeek]})`
    case 'every_n_days': return `Every ${schedule.n} days`
    case 'monthly': return `Monthly (day ${schedule.dayOfMonth})`
  }
}

interface Props {
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
  /** When true: repeat is always shown, "No repeat" is hidden, default type is 'daily' */
  recurringMode?: boolean
}

export default function AddTaskModal({ onAdd, onClose, projectId, recurringMode = false }: Props) {
  const [title, setTitle] = useState('')
  const [estimate, setEstimate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [repeatType, setRepeatType] = useState<'none' | 'daily' | 'weekly' | 'every_n_days' | 'monthly'>(
    recurringMode ? 'daily' : 'none'
  )
  const [weekDay, setWeekDay] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(1)
  const [everyN, setEveryN] = useState('14')
  const [monthDay, setMonthDay] = useState('1')
  const [repeatOpen, setRepeatOpen] = useState(recurringMode)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const buildSchedule = (): RecurrenceSchedule | undefined => {
    if (repeatType === 'none') return undefined
    const today = localDateString()
    switch (repeatType) {
      case 'daily': return { type: 'daily' }
      case 'weekly': return { type: 'weekly', dayOfWeek: weekDay }
      case 'every_n_days': return { type: 'every_n_days', n: parseInt(everyN, 10) || 14, anchorDate: today }
      case 'monthly': return { type: 'monthly', dayOfMonth: parseInt(monthDay, 10) || 1 }
    }
  }

  const submit = () => {
    const raw = title.trim()
    if (!raw) return
    const { title: cleanTitle, tags: inlineTags } = extractTags(raw)
    const mins = estimate ? parseInt(estimate, 10) : undefined
    const schedule = buildSchedule()

    onAdd(cleanTitle || raw, {
      estimatedMinutes: mins && !isNaN(mins) && mins > 0 ? mins : undefined,
      scheduledTime: scheduledTime || undefined,
      tags: inlineTags.length > 0 ? inlineTags : undefined,
      projectId,
      schedule
    })
    onClose()
  }

  const currentSchedule = buildSchedule() ?? null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg bg-raised border border-rim rounded-t-xl shadow-elev-1 pb-safe">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-rim">
          <h2 className="text-sm font-semibold text-ink">
            {recurringMode ? 'Add Recurring Task' : 'Add Task'}
          </h2>
          <button
            onClick={onClose}
            className="text-ghost hover:text-muted transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-4 pt-3 pb-4 space-y-3">
          {/* Title */}
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={recurringMode ? 'Task name… (#tag to label)' : 'What needs doing? (#tag to label)'}
            className="w-full bg-well border border-rim rounded-lg px-3 py-2 text-sm text-ink placeholder-ghost outline-none focus:border-accent transition-colors"
          />

          <div className="grid grid-cols-2 gap-3">
            {/* Scheduled time */}
            {!recurringMode && (
              <div>
                <label className="block text-xs text-ghost mb-1">Time (optional)</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full bg-well border border-rim rounded-lg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent transition-colors"
                />
              </div>
            )}

            {/* Estimate */}
            <div className={recurringMode ? 'col-span-2' : ''}>
              <label className="block text-xs text-ghost mb-1">Estimate (min)</label>
              <input
                type="number"
                min={1}
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Optional"
                className="w-full bg-well border border-rim rounded-lg px-2.5 py-1.5 text-sm text-ink placeholder-ghost outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          {/* Repeat section */}
          <div className="bg-well border border-rim rounded-lg overflow-hidden">
            {!recurringMode && (
              <button
                onClick={() => setRepeatOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-hover transition-colors"
              >
                <span className="text-xs text-ghost">↺</span>
                <span className="text-xs text-muted flex-1">
                  Repeat: <span className={currentSchedule ? 'text-accent' : ''}>{scheduleLabel(currentSchedule)}</span>
                </span>
                <span className="text-xs text-ghost">{repeatOpen ? '▲' : '▼'}</span>
              </button>
            )}

            {(repeatOpen || recurringMode) && (
              <div className={`px-3 pb-2.5 space-y-2 ${!recurringMode ? 'pt-0 border-t border-rim' : 'pt-2.5'}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="repeat" checked={repeatType === 'daily'}
                    onChange={() => setRepeatType('daily')} className="accent-accent" />
                  <span className="text-xs text-ink">Daily (weekdays)</span>
                </label>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="repeat" checked={repeatType === 'weekly'}
                      onChange={() => setRepeatType('weekly')} className="accent-accent" />
                    <span className="text-xs text-ink">Weekly</span>
                  </label>
                  {repeatType === 'weekly' && (
                    <div className="flex gap-1 mt-1.5 ml-5 flex-wrap">
                      {DOW_LABELS.map((d, i) => (
                        <button
                          key={d}
                          onClick={() => setWeekDay(i as typeof weekDay)}
                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                            weekDay === i
                              ? 'border-accent text-accent bg-accent/10'
                              : 'border-rim text-muted hover:border-muted'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="repeat" checked={repeatType === 'every_n_days'}
                      onChange={() => setRepeatType('every_n_days')} className="accent-accent" />
                    <span className="text-xs text-ink">Every</span>
                    <input
                      type="number"
                      min={1}
                      value={everyN}
                      onChange={(e) => setEveryN(e.target.value)}
                      onClick={() => setRepeatType('every_n_days')}
                      className="w-14 bg-canvas border border-rim rounded px-1.5 py-0.5 text-xs text-ink outline-none focus:border-accent"
                    />
                    <span className="text-xs text-ink">days</span>
                  </label>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="repeat" checked={repeatType === 'monthly'}
                      onChange={() => setRepeatType('monthly')} className="accent-accent" />
                    <span className="text-xs text-ink">Monthly, day</span>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={monthDay}
                      onChange={(e) => setMonthDay(e.target.value)}
                      onClick={() => setRepeatType('monthly')}
                      className="w-14 bg-canvas border border-rim rounded px-1.5 py-0.5 text-xs text-ink outline-none focus:border-accent"
                    />
                  </label>
                </div>

                {!recurringMode && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="repeat" checked={repeatType === 'none'}
                      onChange={() => setRepeatType('none')} className="accent-accent" />
                    <span className="text-xs text-muted">No repeat</span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="w-full py-2 bg-accent text-on-accent rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {recurringMode ? 'Create Recurring Task' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
