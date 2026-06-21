/** Tappable HH:MM field backed by the native time picker. Replaces web <input type=time>. */
import { useState } from 'react'
import { Pressable, Text, Platform } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'

export default function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  const [h, m] = value.split(':').map(Number)
  const date = new Date(); date.setHours(h || 0, m || 0, 0, 0)

  return (
    <>
      <Pressable onPress={() => setShow(true)} className="bg-well border border-rim rounded-md px-2.5 py-1.5">
        <Text className="text-sm text-ink">{value}</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={date}
          mode="time"
          onChange={(event, d) => {
            setShow(Platform.OS === 'ios')
            if (event.type === 'set' && d) {
              onChange(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
            }
          }}
        />
      )}
    </>
  )
}
