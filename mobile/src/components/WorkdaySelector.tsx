import { View, Text, Pressable } from 'react-native'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function firstSelectedDay(days: number[]): number {
  return days.length > 0 ? [...days].sort((a, b) => a - b)[0] : 1
}

export function dayLabel(day: number): string {
  return DAYS[day] ?? 'Mon'
}

export default function WorkdaySelector({ value, onChange }: {
  value: number[]
  onChange: (value: number[]) => void
}) {
  const selected = new Set(value)
  const toggle = (day: number) => {
    const next = selected.has(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b)
    onChange(next.length > 0 ? next : value)
  }

  return (
    <View className="flex-row flex-wrap gap-1.5 justify-end">
      {DAYS.map((label, day) => (
        <Pressable
          key={label}
          onPress={() => toggle(day)}
          className={`px-2.5 py-1.5 rounded-md border ${selected.has(day) ? 'border-accent bg-accent' : 'border-rim bg-well'}`}
        >
          <Text className={`text-xs font-medium ${selected.has(day) ? 'text-on-accent' : 'text-muted'}`}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
