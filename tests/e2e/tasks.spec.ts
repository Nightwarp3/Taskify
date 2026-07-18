import { test, expect, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'
import os from 'os'
import path from 'path'
import fs from 'fs'

let app: ElectronApplication
let page: Page
const dataDir = path.join(os.tmpdir(), `taskify-e2e-tasks-${Date.now()}`)

const SEED_STORE = {
  tasks: {},
  tasksByDate: {},
  checkIns: {},
  projects: {},
  recurringTemplates: {},
  settings: {
    endOfDayTime: '17:00',
    startOfDayTime: '09:00',
    workDays: [1, 2, 3, 4, 5],
    startOfWeekDay: 1,
    weeklyRecapDismissedDate: null,
    defaultCheckInInterval: 30,
    theme: 'dark',
    wizardCompleted: true,
    mcpPort: 57391,
    mcpEnabled: false
  },
  nextTaskId: 1,
  nextCheckInId: 1,
  nextProjectId: 1,
  nextTemplateId: 1
}

test.beforeAll(async () => {
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(path.join(dataDir, 'config.json'), JSON.stringify(SEED_STORE))

  app = await electron.launch({
    args: [path.resolve('out/main/index.js'), `--user-data-dir=${dataDir}`]
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible()
})

test.afterAll(async () => {
  await app.close()
  fs.rmSync(dataDir, { recursive: true, force: true })
})

// Type into the task input and submit with Enter
async function addTask(title: string) {
  const input = page.getByPlaceholder('Add a task… (#tag to label)')
  await input.fill(title)
  await input.press('Enter')
}

// Locate the .group div that contains the given task title
function taskRow(title: string) {
  return page.locator('.group').filter({ hasText: title }).first()
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test('app launches and shows Today tab by default', async () => {
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible()
  await expect(page.getByPlaceholder('Add a task… (#tag to label)')).toBeVisible()
})

test('creates a task via keyboard Enter', async () => {
  await addTask('E2E test task')
  await expect(page.getByText('E2E test task')).toBeVisible()
})

test('creates a task by clicking the Add button', async () => {
  const input = page.getByPlaceholder('Add a task… (#tag to label)')
  await input.fill('Click-add task')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText('Click-add task')).toBeVisible()
})

test('shows remaining count once tasks exist', async () => {
  // At least one incomplete task exists at this point; the counter should be visible.
  await expect(page.getByText(/remaining/)).toBeVisible()
})

test('completes a task by clicking its checkbox', async () => {
  await addTask('Complete me')
  const row = taskRow('Complete me')
  await expect(row).toBeVisible()

  // The checkbox is the rounded-full button in the task row
  const checkbox = row.locator('button.rounded-full').first()
  await checkbox.click()

  await expect(row.locator('span.line-through')).toBeVisible()
})

test('un-completes a task by clicking its checkbox again', async () => {
  await addTask('Toggle me')
  const row = taskRow('Toggle me')
  const checkbox = row.locator('button.rounded-full').first()

  await checkbox.click()
  await expect(row.locator('span.line-through')).toBeVisible()

  await checkbox.click()
  await expect(row.locator('span.line-through')).not.toBeVisible()
})

test('collapses and expands the Done section on Today', async () => {
  await addTask('Collapse me')
  const row = taskRow('Collapse me')
  await row.locator('button.rounded-full').first().click()

  const doneToggle = page.getByRole('button', { name: /Done \(1\)/ })
  await expect(doneToggle).toBeVisible()
  await expect(page.getByText('Collapse me')).not.toBeVisible()

  await doneToggle.click()
  await expect(page.getByText('Collapse me')).toBeVisible()
})

test('deletes a task via the delete button', async () => {
  await addTask('Delete me please')
  const row = taskRow('Delete me please')
  await row.hover()
  await row.locator('button[title="Delete"]').click()
  await expect(page.getByText('Delete me please')).not.toBeVisible()
})

test('extracts inline #tag and shows tag badge on the task', async () => {
  await addTask('Focus session #deep')
  // Title is stored without the tag
  await expect(page.getByText('Focus session')).toBeVisible()
  // Tag badge appears inside the task row (not the filter button)
  const row = taskRow('Focus session')
  await expect(row.getByText('#deep')).toBeVisible()
})

test('edits a task title by double-clicking', async () => {
  await addTask('Original title')
  const row = taskRow('Original title')

  // The title span is the only span.text-sm.truncate in the task row.
  // Use page.mouse.dblclick with explicit coordinates so the event goes through
  // the browser's native input queue (isTrusted: true) and triggers React's onDoubleClick.
  const titleSpan = row.locator('span.text-sm.truncate').first()
  const box = await titleSpan.boundingBox()
  await page.mouse.dblclick(box!.x + box!.width / 2, box!.y + box!.height / 2)

  // When edit mode activates, the span is replaced by an <input>.
  // The row locator's hasText filter breaks at this point (input values aren't
  // text nodes), so find the edit input globally by its unique bg-well class.
  const editInput = page.locator('input[class*="bg-well"]')
  await expect(editInput).toBeVisible()
  await editInput.fill('Edited title')
  await editInput.press('Enter')

  await expect(page.getByText('Edited title')).toBeVisible()
  await expect(page.getByText('Original title')).not.toBeVisible()
})

test('expands task detail panel and adds a note', async () => {
  await addTask('Task with notes')
  const row = taskRow('Task with notes')
  await row.hover()

  // Click the expand toggle button (▼ / Notes, tags & links)
  await row.locator('button[title="Notes, tags & links"]').click()

  // The detail panel is now expanded — click the notes area to enter edit mode
  await expect(page.getByText('Click to add notes…')).toBeVisible()
  await page.getByText('Click to add notes…').click()

  const notesArea = page.locator('textarea[placeholder="Add notes…"]')
  await expect(notesArea).toBeVisible()
  await notesArea.fill('My important note')
  await notesArea.blur()

  await expect(page.getByText('My important note')).toBeVisible()
})
