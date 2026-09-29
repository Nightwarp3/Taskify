import { test, expect, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'
import os from 'os'
import path from 'path'
import fs from 'fs'

let app: ElectronApplication
let page: Page
let dataDir: string

function localDate(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function weekStart(date: string): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() - ((d.getDay() - 1 + 7) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function offsetDate(date: string, offset: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function task(id: number, date: string, title: string) {
  return {
    id,
    date,
    title,
    completed: false,
    completedAt: null,
    notes: null,
    links: null,
    estimatedMinutes: null,
    scheduledTime: null,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    projectId: null,
    tags: null,
    templateId: null,
    backlog: false
  }
}

async function launchWithTasks(tasks: ReturnType<typeof task>[], startOfWeekDay = 1) {
  dataDir = path.join(os.tmpdir(), `taskify-e2e-history-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  const tasksByDate: Record<string, number[]> = {}
  for (const item of tasks) tasksByDate[item.date] = [...(tasksByDate[item.date] ?? []), item.id]

  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(path.join(dataDir, 'config.json'), JSON.stringify({
    tasks: Object.fromEntries(tasks.map((item) => [item.id, item])),
    tasksByDate,
    checkIns: {},
    projects: {},
    recurringTemplates: {},
    settings: {
      endOfDayTime: '17:00',
      startOfDayTime: '09:00',
      workDays: [1, 2, 3, 4, 5],
      startOfWeekDay,
      weeklyRecapDismissedDate: null,
      defaultCheckInInterval: 30,
      theme: 'dark',
      closeBehavior: 'exit',
      wizardCompleted: true,
      mcpPort: 57391,
      mcpEnabled: false
    },
    nextTaskId: tasks.length + 1,
    nextCheckInId: 1,
    nextProjectId: 1,
    nextTemplateId: 1
  }))

  app = await electron.launch({
    args: [path.resolve('out/main/index.js'), `--user-data-dir=${dataDir}`]
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
}

test.afterEach(async () => {
  await app?.close()
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true })
})

test('shows all prior-week incomplete tasks and moves them to Today in bulk', async () => {
  const oldDate = offsetDate(weekStart(localDate()), -14)
  await launchWithTasks([
    task(1, oldDate, 'Historical task one'),
    task(2, oldDate, 'Historical task two')
  ])

  await expect(page.getByText('Start of week recap')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Move all to today' })).toBeVisible()

  await page.getByRole('button', { name: 'Move all to today' }).click()

  await expect(page.getByText('Start of week recap')).not.toBeVisible()
  await expect(page.getByText('Historical task one')).toBeVisible()
  await expect(page.getByText('Historical task two')).toBeVisible()
})

test('does not show the recap when only current-week tasks exist', async () => {
  await launchWithTasks([task(1, localDate(), 'Current week task')])

  await expect(page.getByText('Start of week recap')).not.toBeVisible()
  await expect(page.getByText('Current week task')).toBeVisible()
})

test('shows the bulk action in Today’s This week section', async () => {
  const today = new Date()
  const startOfWeekDay = (today.getDay() + 6) % 7
  await launchWithTasks([task(1, localDate(-1), 'Current-week historical task')], startOfWeekDay)

  await expect(page.getByText('This week')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Move all to today' })).toBeVisible()

  await page.getByRole('button', { name: 'Move all to today' }).click()

  await expect(page.getByText('Current-week historical task')).toBeVisible()
  await expect(page.getByText('This week')).not.toBeVisible()
})

test('dismissal suppresses the recap for the current launch day', async () => {
  const oldDate = offsetDate(weekStart(localDate()), -14)
  await launchWithTasks([task(1, oldDate, 'Dismissible historical task')])

  await expect(page.getByText('Start of week recap')).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByText('Start of week recap')).not.toBeVisible()
})
