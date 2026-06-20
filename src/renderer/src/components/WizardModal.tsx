import { useState } from 'react'
import type { AppSettings } from '../../../shared/types'

interface Props {
  onComplete: () => void
  onThemeChange: (theme: 'light' | 'dark') => void
  currentTheme: 'light' | 'dark'
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const inputCls =
  'bg-well border border-rim rounded-md px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent transition-colors w-24'

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${
            i < step ? 'bg-accent' : i === step ? 'bg-accent' : 'bg-rim'
          }`}
        />
      ))}
    </div>
  )
}

export default function WizardModal({ onComplete, onThemeChange, currentTheme }: Props) {
  const [step, setStep] = useState(0)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [interval, setInterval] = useState('30')
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(currentTheme)

  const total = 5

  const persist = async (key: keyof AppSettings, value: unknown) => {
    await window.taskify.settings.set(key, value)
  }

  const finish = async () => {
    await persist('wizardCompleted', true)
    onComplete()
  }

  const skip = async () => {
    await persist('wizardCompleted', true)
    onComplete()
  }

  const next = async () => {
    // Persist current step data before advancing
    if (step === 1) {
      await persist('startOfDayTime', startTime)
      await persist('endOfDayTime', endTime)
    } else if (step === 2) {
      const mins = parseInt(interval, 10)
      if (!isNaN(mins) && mins >= 5) await persist('defaultCheckInInterval', mins)
    } else if (step === 4) {
      await finish()
      return
    }
    setStep((s) => s + 1)
  }

  const back = () => setStep((s) => s - 1)

  const requestNotification = async () => {
    const { granted } = await window.taskify.wizard.requestNotificationPermission()
    setNotifGranted(granted)
  }

  const selectTheme = async (t: 'light' | 'dark') => {
    setTheme(t)
    onThemeChange(t)
    await persist('theme', t)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-raised border border-rim rounded-xl shadow-elev-1 w-80 p-5">
        {/* Step 0 — Welcome */}
        {step === 0 && (
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #4191FF, #195FDC)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <polyline points="5.5,12.5 10,17 18.5,8" stroke="white" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-ink mb-2">Welcome to Taskify</h2>
            <p className="text-xs text-muted mb-5">
              A simple daily task manager that keeps you focused and checks in while you work.
              Let's set it up in a few quick steps.
            </p>
            <div className="flex justify-between items-center">
              <button onClick={skip} className="text-xs text-ghost hover:text-muted transition-colors">
                Skip setup
              </button>
              <button onClick={next}
                className="text-xs px-4 py-1.5 bg-accent text-on-accent rounded-pill font-medium hover:opacity-90 transition-opacity">
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — Working Hours */}
        {step === 1 && (
          <div>
            <ProgressDots step={step} total={total} />
            <p className="text-xs text-muted mb-1">Step 2 of 5</p>
            <h2 className="text-sm font-semibold text-ink mb-1">When do you work?</h2>
            <p className="text-xs text-ghost mb-4">
              You'll get a reminder near the end of the day if tasks are still open.
            </p>
            <div className="space-y-3 mb-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink">Start time</span>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  className={inputCls} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink">End time</span>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                  className={inputCls} />
              </div>
            </div>
            <NavButtons onBack={back} onSkip={skip} onNext={next} />
          </div>
        )}

        {/* Step 2 — Check-in interval */}
        {step === 2 && (
          <div>
            <ProgressDots step={step} total={total} />
            <p className="text-xs text-muted mb-1">Step 3 of 5</p>
            <h2 className="text-sm font-semibold text-ink mb-1">Check-in interval</h2>
            <p className="text-xs text-ghost mb-4">
              When you add an estimated time to a task, Taskify notifies you at this interval
              with quick actions: mark done or +15 min.
            </p>
            <div className="flex items-center gap-2 mb-5">
              <span className="text-sm text-ink">Every</span>
              <input type="number" min={5} max={120} value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className={inputCls} />
              <span className="text-sm text-ink">minutes</span>
            </div>
            <NavButtons onBack={back} onSkip={skip} onNext={next} />
          </div>
        )}

        {/* Step 3 — Notifications */}
        {step === 3 && (
          <div>
            <ProgressDots step={step} total={total} />
            <p className="text-xs text-muted mb-1">Step 4 of 5</p>
            <h2 className="text-sm font-semibold text-ink mb-1">Enable notifications</h2>
            <p className="text-xs text-ghost mb-3">
              Taskify uses system notifications for check-ins and end-of-day reminders.
            </p>
            <div className="bg-canvas border border-rim rounded-lg p-2.5 mb-4 text-xs">
              <div className="font-medium text-ink mb-0.5">● Taskify Check-in</div>
              <div className="text-muted mb-2">How's "Review PRs" going?</div>
              <div className="flex gap-1.5">
                {['Mark Complete', '+15 min', 'Dismiss'].map((l) => (
                  <span key={l} className="px-2 py-0.5 bg-well rounded text-ghost border border-rim">{l}</span>
                ))}
              </div>
            </div>
            {notifGranted === null ? (
              <button onClick={requestNotification}
                className="w-full py-1.5 bg-accent text-on-accent rounded-pill text-xs font-medium hover:opacity-90 transition-opacity mb-4">
                Enable Notifications
              </button>
            ) : (
              <div className="text-xs text-accent font-medium text-center mb-4">
                Notifications are enabled ✓
              </div>
            )}
            <NavButtons onBack={back} onSkip={skip} onNext={next} />
          </div>
        )}

        {/* Step 4 — Theme & Finish */}
        {step === 4 && (
          <div>
            <ProgressDots step={step} total={total} />
            <p className="text-xs text-muted mb-1">Step 5 of 5</p>
            <h2 className="text-sm font-semibold text-ink mb-3">Choose your theme</h2>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(['light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => selectTheme(t)}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    theme === t ? 'border-accent' : 'border-rim hover:border-muted'
                  }`}
                >
                  <div className="text-sm mb-1">{t === 'light' ? '☀' : '☾'}</div>
                  <div className="text-xs font-medium text-ink capitalize">{t}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-ghost mb-4">You're all set!</p>
            <div className="flex justify-between">
              <button onClick={back} className="text-xs text-ghost hover:text-muted transition-colors">
                ← Back
              </button>
              <button onClick={finish}
                className="text-xs px-4 py-1.5 bg-accent text-on-accent rounded-pill font-medium hover:opacity-90 transition-opacity">
                Finish ✓
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NavButtons({
  onBack,
  onSkip,
  onNext
}: {
  onBack: () => void
  onSkip: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <button onClick={onBack} className="text-xs text-ghost hover:text-muted transition-colors">
        ← Back
      </button>
      <div className="flex gap-2">
        <button onClick={onSkip} className="text-xs text-ghost hover:text-muted transition-colors">
          Skip
        </button>
        <button onClick={onNext}
          className="text-xs px-4 py-1.5 bg-accent text-on-accent rounded-pill font-medium hover:opacity-90 transition-opacity">
          Next →
        </button>
      </div>
    </div>
  )
}
