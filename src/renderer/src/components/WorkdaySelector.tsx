const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Props {
  value: number[]
  onChange: (value: number[]) => void
}

export function firstSelectedDay(days: number[]): number {
  return days.length > 0 ? [...days].sort((a, b) => a - b)[0] : 1
}

export default function WorkdaySelector({ value, onChange }: Props) {
  const selected = new Set(value)

  const toggle = (day: number) => {
    const next = selected.has(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b)
    onChange(next.length > 0 ? next : value)
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {DAYS.map((label, day) => (
        <button
          key={label}
          type="button"
          onClick={() => toggle(day)}
          className={`min-w-10 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
            selected.has(day)
              ? 'border-accent bg-accent text-on-accent'
              : 'border-rim bg-well text-muted hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
