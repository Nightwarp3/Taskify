/**
 * Shared recurrence picker — the repeat options used by AddTaskModal and the
 * project AddTaskBar. RN has no <input type=radio>, so rows use a custom dot.
 */
import { useState } from 'react'
import { View, Text, TextInput, Pressable } from 'react-native'
import type { RecurrenceSchedule } from '@shared/types'
import { DOW_LABELS, localDateString } from '../lib/format'

export type RepeatType = 'none' | 'daily' | 'weekly' | 'every_n_days' | 'monthly'

export interface RecurrenceState {
  repeatType: RepeatType
  setRepeatType: (t: RepeatType) => void
  weekDay: 0 | 1 | 2 | 3 | 4 | 5 | 6
  setWeekDay: (d: 0 | 1 | 2 | 3 | 4 | 5 | 6) => void
  everyN: string
  setEveryN: (v: string) => void
  monthDay: string
  setMonthDay: (v: string) => void
  buildSchedule: () => RecurrenceSchedule | undefined
}

export function useRecurrence(recurringMode = false): RecurrenceState {
  const [repeatType, setRepeatType] = useState<RepeatType>(recurringMode ? 'daily' : 'none')
  const [weekDay, setWeekDay] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(1)
  const [everyN, setEveryN] = useState('14')
  const [monthDay, setMonthDay] = useState('1')

  const buildSchedule = (): RecurrenceSchedule | undefined => {
    if (repeatType === 'none') return undefined
    switch (repeatType) {
      case 'daily': return { type: 'daily' }
      case 'weekly': return { type: 'weekly', dayOfWeek: weekDay }
      case 'every_n_days': return { type: 'every_n_days', n: parseInt(everyN, 10) || 14, anchorDate: localDateString() }
      case 'monthly': return { type: 'monthly', dayOfMonth: parseInt(monthDay, 10) || 1 }
    }
  }

  return { repeatType, setRepeatType, weekDay, setWeekDay, everyN, setEveryN, monthDay, setMonthDay, buildSchedule }
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <View className={`w-4 h-4 rounded-full border-2 items-center justify-center ${selected ? 'border-accent' : 'border-rim'}`}>
      {selected && <View className="w-2 h-2 rounded-full bg-accent" />}
    </View>
  )
}

export function RepeatOptions({ state, recurringMode = false }: { state: RecurrenceState; recurringMode?: boolean }) {
  const { repeatType, setRepeatType, weekDay, setWeekDay, everyN, setEveryN, monthDay, setMonthDay } = state
  return (
    <View className="gap-2 px-3 pb-2.5 pt-2.5">
      <Pressable className="flex-row items-center gap-2" onPress={() => setRepeatType('daily')}>
        <Radio selected={repeatType === 'daily'} />
        <Text className="text-xs text-ink">Daily (weekdays)</Text>
      </Pressable>

      <View>
        <Pressable className="flex-row items-center gap-2" onPress={() => setRepeatType('weekly')}>
          <Radio selected={repeatType === 'weekly'} />
          <Text className="text-xs text-ink">Weekly</Text>
        </Pressable>
        {repeatType === 'weekly' && (
          <View className="flex-row flex-wrap gap-1 mt-1.5 ml-6">
            {DOW_LABELS.map((d, i) => (
              <Pressable
                key={d}
                onPress={() => setWeekDay(i as RecurrenceState['weekDay'])}
                className={`px-2 py-0.5 rounded border ${weekDay === i ? 'border-accent bg-accent/10' : 'border-rim'}`}
              >
                <Text className={`text-xs ${weekDay === i ? 'text-accent' : 'text-muted'}`}>{d}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Pressable className="flex-row items-center gap-2" onPress={() => setRepeatType('every_n_days')}>
        <Radio selected={repeatType === 'every_n_days'} />
        <Text className="text-xs text-ink">Every</Text>
        <TextInput
          value={everyN}
          onChangeText={setEveryN}
          onFocus={() => setRepeatType('every_n_days')}
          keyboardType="number-pad"
          className="w-14 bg-canvas border border-rim rounded px-1.5 py-0.5 text-xs text-ink"
        />
        <Text className="text-xs text-ink">days</Text>
      </Pressable>

      <Pressable className="flex-row items-center gap-2" onPress={() => setRepeatType('monthly')}>
        <Radio selected={repeatType === 'monthly'} />
        <Text className="text-xs text-ink">Monthly, day</Text>
        <TextInput
          value={monthDay}
          onChangeText={setMonthDay}
          onFocus={() => setRepeatType('monthly')}
          keyboardType="number-pad"
          className="w-14 bg-canvas border border-rim rounded px-1.5 py-0.5 text-xs text-ink"
        />
      </Pressable>

      {!recurringMode && (
        <Pressable className="flex-row items-center gap-2" onPress={() => setRepeatType('none')}>
          <Radio selected={repeatType === 'none'} />
          <Text className="text-xs text-muted">No repeat</Text>
        </Pressable>
      )}
    </View>
  )
}
