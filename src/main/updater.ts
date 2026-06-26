import { app, BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import type { ProgressInfo, UpdateInfo } from 'electron-updater'
import type { UpdateState } from '../shared/types'

let getWindow: () => BrowserWindow | null = () => null
let initialized = false

let state: UpdateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  availableVersion: null,
  message: null,
  progress: null
}

function updatesDisabled(): boolean {
  return is.dev || !app.isPackaged
}

function setState(next: Partial<UpdateState>): UpdateState {
  state = {
    ...state,
    ...next,
    currentVersion: app.getVersion()
  }
  getWindow()?.webContents.send('updates:state', state)
  return state
}

function versionFrom(info: UpdateInfo | null | undefined): string | null {
  return info?.version ?? null
}

export function setupUpdates(windowGetter: () => BrowserWindow | null): void {
  getWindow = windowGetter
  if (initialized) return
  initialized = true

  if (updatesDisabled()) {
    setState({
      status: 'disabled',
      message: 'Updates are available in the packaged desktop app.',
      progress: null
    })
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    setState({ status: 'checking', message: 'Checking for updates...', progress: null })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    setState({
      status: 'available',
      availableVersion: versionFrom(info),
      message: `Downloading Taskify ${info.version}...`,
      progress: 0
    })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    setState({
      status: 'downloading',
      message: `Downloading update (${Math.round(progress.percent)}%)...`,
      progress: progress.percent
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    setState({
      status: 'downloaded',
      availableVersion: versionFrom(info),
      message: `Taskify ${info.version} is ready to install.`,
      progress: 100
    })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    setState({
      status: 'not-available',
      availableVersion: versionFrom(info),
      message: 'Taskify is up to date.',
      progress: null
    })
  })

  autoUpdater.on('error', (error: Error) => {
    setState({
      status: 'error',
      message: error.message || 'Update check failed.',
      progress: null
    })
  })
}

export function getUpdateState(): UpdateState {
  if (updatesDisabled()) {
    return {
      ...state,
      status: 'disabled',
      currentVersion: app.getVersion(),
      message: 'Updates are available in the packaged desktop app.',
      progress: null
    }
  }
  return { ...state, currentVersion: app.getVersion() }
}

export async function checkForUpdates(): Promise<UpdateState> {
  if (updatesDisabled()) return getUpdateState()
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    setState({
      status: 'error',
      message: error instanceof Error ? error.message : 'Update check failed.',
      progress: null
    })
  }
  return getUpdateState()
}

export function installUpdate(): UpdateState {
  if (state.status === 'downloaded') {
    autoUpdater.quitAndInstall(false, true)
  }
  return getUpdateState()
}
