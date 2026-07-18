import { test, expect, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'
import os from 'os'
import path from 'path'
import fs from 'fs'

let app: ElectronApplication
let page: Page
const dataDir = path.join(os.tmpdir(), `taskify-e2e-projects-${Date.now()}`)

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
    closeBehavior: 'background',
    wizardCompleted: true,
    mcpPort: 57391,
    mcpEnabled: false
  },
  nextTaskId: 1,
  nextCheckInId: 1,
  nextProjectId: 1,
  nextTemplateId: 1
}

// Find the sidebar project list button (contains name + task count)
function projectButton(name: string) {
  return page.getByRole('button', { name: new RegExp(name) }).first()
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

  // Navigate to Projects tab
  await page.getByRole('button', { name: 'Projects' }).click()
  await expect(page.getByText('+ New Project')).toBeVisible()
})

test.afterAll(async () => {
  await app.close()
  fs.rmSync(dataDir, { recursive: true, force: true })
})

// Helper: open the new project form and fill it in
async function createProject(name: string) {
  await page.getByText('+ New Project').click()
  await expect(page.getByPlaceholder('Project name')).toBeVisible()
  await page.getByPlaceholder('Project name').fill(name)
  await page.getByRole('button', { name: 'Create' }).click()
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test('shows empty state when no projects exist', async () => {
  await expect(page.getByText('No projects yet')).toBeVisible()
})

test('creates a new project and shows it in the sidebar', async () => {
  await createProject('My Test Project')
  // The sidebar button contains the project name and task count
  await expect(projectButton('My Test Project')).toBeVisible()
})

test('newly created project is auto-selected and shows its AddTaskBar', async () => {
  // When a project is selected the project detail section appears with an AddTaskBar
  await expect(page.getByPlaceholder('Add a task… (#tag to label)')).toBeVisible()
})

test('adds a task to the project backlog', async () => {
  const input = page.getByPlaceholder('Add a task… (#tag to label)')
  await input.fill('Backlog task one')
  await input.press('Enter')
  await expect(page.getByText('Backlog task one')).toBeVisible()
})

test('project sidebar badge shows updated task count', async () => {
  // The sidebar button now shows "My Test Project" + "1 task"
  await expect(page.getByText('1 task')).toBeVisible()
})

test('backlog task shows pull-to-today button on hover', async () => {
  const row = page.locator('.group').filter({ hasText: 'Backlog task one' }).first()
  await row.hover()
  await expect(page.getByTitle('Pull to today')).toBeVisible()
})

test('pulls a backlog task to today and shows In progress label', async () => {
  const row = page.locator('.group').filter({ hasText: 'Backlog task one' }).first()
  await row.hover()
  await page.getByTitle('Pull to today').click()
  await expect(page.getByText('In progress')).toBeVisible()
})

test('creates a second project', async () => {
  await createProject('Second Project')
  await expect(projectButton('Second Project')).toBeVisible()
})

test('switching projects updates the detail panel', async () => {
  // Go back to first project — its task should be visible
  await projectButton('My Test Project').click()
  await expect(page.getByText('Backlog task one')).toBeVisible()

  // Switch to second project — no tasks
  await projectButton('Second Project').click()
  await expect(page.getByText('Backlog task one')).not.toBeVisible()
})

test('archives a project and removes it from the sidebar', async () => {
  // Second Project should be selected from previous test
  await page.getByRole('button', { name: 'Archive' }).click()
  await expect(projectButton('Second Project')).not.toBeVisible()
})

test('navigates to Today tab and sees pulled task', async () => {
  await page.getByRole('button', { name: 'Today' }).click()
  await expect(page.getByText('Backlog task one')).toBeVisible()
})
