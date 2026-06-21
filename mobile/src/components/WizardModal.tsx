/** Port of src/renderer/src/components/WizardModal.tsx — 5-step first-run setup. */
import { useState } from 'react'
import { Modal, View, Text, TextInput, Pressable } from 'react-native'
import type { AppSettings } from '@shared/types'
import { useTaskify } from '../providers/TaskifyProvider'
import TimeField from './TimeField'

interface Props {
  visible: boolean
  onComplete: () => void
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <View className="flex-row items-center gap-2 mb-4">
      {Array.from({ length: total }, (_, i) => (
        <View key={i} className={`w-2 h-2 rounded-full ${i <= step ? 'bg-accent' : 'bg-rim'}`} />
      ))}
    </View>
  )
}

function NavButtons({ onBack, onSkip, onNext, nextLabel = 'Next →' }: {
  onBack: () => void; onSkip: () => void; onNext: () => void; nextLabel?: string
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Pressable onPress={onBack}><Text className="text-xs text-ghost">← Back</Text></Pressable>
      <View className="flex-row gap-3 items-center">
        <Pressable onPress={onSkip}><Text className="text-xs text-ghost">Skip</Text></Pressable>
        <Pressable onPress={onNext} className="px-4 py-1.5 bg-accent rounded-pill">
          <Text className="text-xs font-medium text-on-accent">{nextLabel}</Text>
        </Pressable>
      </View>
    </View>
  )
}

export default function WizardModal({ visible, onComplete }: Props) {
  const { api, theme, setTheme } = useTaskify()
  const [step, setStep] = useState(0)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [interval, setIntervalValue] = useState('30')
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null)

  const total = 5
  const persist = (key: keyof AppSettings, value: unknown) => api.settings.set(key, value)

  const finish = async () => {
    await persist('wizardCompleted', true)
    onComplete()
  }

  const next = async () => {
    if (step === 1) {
      await persist('startOfDayTime', startTime)
      await persist('endOfDayTime', endTime)
    } else if (step === 2) {
      const mins = parseInt(interval, 10)
      if (!isNaN(mins) && mins >= 5) await persist('defaultCheckInInterval', mins)
    } else if (step === 4) {
      await finish(); return
    }
    setStep((s) => s + 1)
  }

  const back = () => setStep((s) => s - 1)

  const requestNotification = async () => {
    const { granted } = await api.wizard.requestNotificationPermission()
    setNotifGranted(granted)
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <View className="bg-raised border border-rim rounded-xl w-full max-w-sm p-5">
          {/* Step 0 — Welcome */}
          {step === 0 && (
            <View className="items-center">
              <Text className="text-3xl mb-3">✓</Text>
              <Text className="text-base font-semibold text-ink mb-2">Welcome to Taskify</Text>
              <Text className="text-xs text-muted mb-5 text-center">
                A simple daily task manager that keeps you focused and checks in while you work.
                Let's set it up in a few quick steps.
              </Text>
              <View className="flex-row justify-between items-center w-full">
                <Pressable onPress={finish}><Text className="text-xs text-ghost">Skip setup</Text></Pressable>
                <Pressable onPress={next} className="px-4 py-1.5 bg-accent rounded-pill">
                  <Text className="text-xs font-medium text-on-accent">Next →</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Step 1 — Working hours */}
          {step === 1 && (
            <View>
              <ProgressDots step={step} total={total} />
              <Text className="text-xs text-muted mb-1">Step 2 of 5</Text>
              <Text className="text-sm font-semibold text-ink mb-1">When do you work?</Text>
              <Text className="text-xs text-ghost mb-4">
                You'll get a reminder near the end of the day if tasks are still open.
              </Text>
              <View className="gap-3 mb-5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-ink">Start time</Text>
                  <TimeField value={startTime} onChange={setStartTime} />
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-ink">End time</Text>
                  <TimeField value={endTime} onChange={setEndTime} />
                </View>
              </View>
              <NavButtons onBack={back} onSkip={finish} onNext={next} />
            </View>
          )}

          {/* Step 2 — Check-in interval */}
          {step === 2 && (
            <View>
              <ProgressDots step={step} total={total} />
              <Text className="text-xs text-muted mb-1">Step 3 of 5</Text>
              <Text className="text-sm font-semibold text-ink mb-1">Check-in interval</Text>
              <Text className="text-xs text-ghost mb-4">
                When you add an estimated time to a task, Taskify notifies you at this interval
                with quick actions: mark done or +15 min.
              </Text>
              <View className="flex-row items-center gap-2 mb-5">
                <Text className="text-sm text-ink">Every</Text>
                <TextInput
                  value={interval}
                  onChangeText={setIntervalValue}
                  keyboardType="number-pad"
                  className="bg-well border border-rim rounded-md px-2.5 py-1.5 text-sm text-ink w-20"
                />
                <Text className="text-sm text-ink">minutes</Text>
              </View>
              <NavButtons onBack={back} onSkip={finish} onNext={next} />
            </View>
          )}

          {/* Step 3 — Notifications */}
          {step === 3 && (
            <View>
              <ProgressDots step={step} total={total} />
              <Text className="text-xs text-muted mb-1">Step 4 of 5</Text>
              <Text className="text-sm font-semibold text-ink mb-1">Enable notifications</Text>
              <Text className="text-xs text-ghost mb-3">
                Taskify uses system notifications for check-ins and end-of-day reminders.
              </Text>
              <View className="bg-canvas border border-rim rounded-lg p-2.5 mb-4">
                <Text className="text-xs font-medium text-ink mb-0.5">● Taskify Check-in</Text>
                <Text className="text-xs text-muted mb-2">How's "Review PRs" going?</Text>
                <View className="flex-row gap-1.5">
                  {['Mark Complete', '+15 min', 'Dismiss'].map((l) => (
                    <View key={l} className="px-2 py-0.5 bg-well rounded border border-rim">
                      <Text className="text-xs text-ghost">{l}</Text>
                    </View>
                  ))}
                </View>
              </View>
              {notifGranted === null ? (
                <Pressable onPress={requestNotification} className="py-1.5 bg-accent rounded-pill items-center mb-4">
                  <Text className="text-xs font-medium text-on-accent">Enable Notifications</Text>
                </Pressable>
              ) : (
                <Text className="text-xs text-accent font-medium text-center mb-4">
                  {notifGranted ? 'Notifications are enabled ✓' : 'Notifications were not granted'}
                </Text>
              )}
              <NavButtons onBack={back} onSkip={finish} onNext={next} />
            </View>
          )}

          {/* Step 4 — Theme & finish */}
          {step === 4 && (
            <View>
              <ProgressDots step={step} total={total} />
              <Text className="text-xs text-muted mb-1">Step 5 of 5</Text>
              <Text className="text-sm font-semibold text-ink mb-3">Choose your theme</Text>
              <View className="flex-row gap-2 mb-4">
                {(['light', 'dark'] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setTheme(t)}
                    className={`flex-1 p-3 rounded-lg border-2 ${theme === t ? 'border-accent' : 'border-rim'}`}
                  >
                    <Text className="text-sm mb-1 text-ink">{t === 'light' ? '☀' : '☾'}</Text>
                    <Text className="text-xs font-medium text-ink capitalize">{t}</Text>
                  </Pressable>
                ))}
              </View>
              <Text className="text-xs text-ghost mb-4">You're all set!</Text>
              <View className="flex-row justify-between">
                <Pressable onPress={back}><Text className="text-xs text-ghost">← Back</Text></Pressable>
                <Pressable onPress={finish} className="px-4 py-1.5 bg-accent rounded-pill">
                  <Text className="text-xs font-medium text-on-accent">Finish ✓</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}
