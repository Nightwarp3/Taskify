import { useState, useRef } from 'react'
import type { RecurrenceSchedule } from '../../../shared/types'

interface Props {
  onAdd: (
    title: string,
    opts?: {
      estimatedMinutes?: number
      tags?: string[]
      projectId?: number | null
      schedule?: RecurrenceSchedule
    }
  ) => void
  projectId?: number | null
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function extractTags(raw: string): { title: string; tags: string[] } {
  const tags: string[] = []
  const title = raw
    .replace(/#(\w+)/g, (_, tag) => {
      tags.push(tag)
      return ''
    })
    .trim()
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

export default function AddTaskBar({ onAdd, projectId }: Props) {
  const [title, setTitle] = useState('')
  const [estimate, setEstimate] = useState('')
  const [repeatOpen, setRepeatOpen] = useState(false)
  const [repeatType, setRepeatType] = useState<'none' | 'daily' | 'weekly' | 'every_n_days' | 'monthly'>('none')
  const [weekDay, setWeekDay] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(1)
  const [everyN, setEveryN] = useState('14')
  const [monthDay, setMonthDay] = useState('1')
  const inputRef = useRef<HTMLInputElement>(null)

  const buildSchedule = (): RecurrenceSchedule | undefined => {
    if (repeatType === 'none') return undefined
    const today = new Date().toISOString().slice(0, 10)
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
      tags: inlineTags.length > 0 ? inlineTags : undefined,
      projectId,
      schedule
    })

    setTitle('')
    setEstimate('')
    setRepeatType('none')
    setRepeatOpen(false)
    inputRef.current?.focus()
  }

  const currentSchedule = buildSchedule() ?? null

  return (
    <div className="px-4 pb-3 shrink-0">
      <div className="bg-raised rounded-lg border border-rim shadow-elev-1 overflow-hidden focus-within:border-accent transition-colors">
        {/* Task title row */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          <span className="text-accent text-lg font-light select-none leading-none">+</span>
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Add a task… (#tag to label)"
            className="flex-1 bg-transparent text-sm text-ink placeholder-ghost outline-none"
          />
          {title.trim() && (
            <button
              onClick={submit}
              className="text-xs px-2.5 py-1 bg-accent text-on-accent rounded-pill font-medium hover:opacity-90 transition-opacity"
            >
              Add
            </button>
          )}
        </div>

        {/* Estimate row */}
        <div className="flex items-center gap-2 px-3 pb-1.5 border-t border-rim">
          <span className="text-xs text-ghost select-none pt-1.5">⏱</span>
          <input
            type="number"
            min={1}
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Estimated minutes (optional)"
            className="flex-1 bg-transparent text-xs text-muted placeholder-ghost outline-none pt-1.5"
          />
          {estimate && <span className="text-xs text-ghost pt-1.5">min</span>}
        </div>

        {/* Repeat row */}
        <div className="border-t border-rim">
          <button
            onClick={() => setRepeatOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 w-full text-left hover:bg-hover transition-colors"
          >
            <span className="text-xs text-ghost">↺</span>
            <span className="text-xs text-muted flex-1">
              Repeat: <span className={currentSchedule ? 'text-accent' : ''}>{scheduleLabel(currentSchedule)}</span>
            </span>
            <span className="text-xs text-ghost">{repeatOpen ? '▲' : '▼'}</span>
          </button>

          {repeatOpen && (
            <div className="px-3 pb-2.5 space-y-2">
              {/* Daily */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="repeat" checked={repeatType === 'daily'}
                  onChange={() => setRepeatType('daily')} className="accent-accent" />
                <span className="text-xs text-ink">Daily (weekdays)</span>
              </label>

              {/* Weekly */}
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

              {/* Every N days */}
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
                    className="w-14 bg-well border border-rim rounded px-1.5 py-0.5 text-xs text-ink outline-none focus:border-accent"
                  />
                  <span className="text-xs text-ink">days</span>
                </label>
              </div>

              {/* Monthly */}
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
                    className="w-14 bg-well border border-rim rounded px-1.5 py-0.5 text-xs text-ink outline-none focus:border-accent"
                  />
                </label>
              </div>

              {/* Off */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="repeat" checked={repeatType === 'none'}
                  onChange={() => setRepeatType('none')} className="accent-accent" />
                <span className="text-xs text-muted">No repeat</span>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
