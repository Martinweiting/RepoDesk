import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron'
import { inspectProject } from '../shared/scanner'
import type {
  BootstrapPayload,
  GlobalBrowser,
  LogEntry,
  PersistedState,
  ProjectRecord,
  RuntimeState,
  UserSettings,
  ProjectVisualKind
} from '../shared/types'
import { consumeDevelopmentOutput } from '../shared/runtime'
import { RepoDeskStore } from './store'

interface RunningProject {
  child: ChildProcess
  runtime: RuntimeState
  browserOpened: boolean
  outputBuffer: string
  requestedStop: boolean
}

const runningProjects = new Map<string, RunningProject>()
const runtimeHistory = new Map<string, RuntimeState>()
const logs = new Map<string, LogEntry[]>()
let mainWindow: BrowserWindow | null = null
let store: RepoDeskStore
let isQuitting = false

function stoppedRuntime(projectId: string): RuntimeState {
  return {
    projectId,
    status: 'stopped',
    pid: null,
    url: '',
    error: '',
    startedAt: null
  }
}

function emitRuntime(runtime: RuntimeState): void {
  runtimeHistory.set(runtime.projectId, structuredClone(runtime))
  mainWindow?.webContents.send('runtime:changed', runtime)
}

function appendLog(projectId: string, stream: LogEntry['stream'], message: string): void {
  const cleaned = message
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\r/g, '')
    .trimEnd()
  if (!cleaned) return

  const entries = logs.get(projectId) ?? []
  for (const line of cleaned.split('\n')) {
    const entry: LogEntry = {
      projectId,
      stream,
      message: line,
      timestamp: new Date().toISOString()
    }
    entries.push(entry)
    mainWindow?.webContents.send('project:log', entry)
  }
  logs.set(projectId, entries.slice(-400))
}

function findBrowserExecutable(browser: GlobalBrowser): string | null {
  const programFiles = process.env.ProgramFiles
  const programFilesX86 = process.env['ProgramFiles(x86)']
  const localAppData = process.env.LOCALAPPDATA
  const candidates = browser === 'edge'
    ? [
        programFilesX86 && join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        programFiles && join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
      ]
    : [
        programFiles && join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        programFilesX86 && join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        localAppData && join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe')
      ]

  return candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate))) ?? null
}

async function openInBrowser(url: string, browser: GlobalBrowser): Promise<void> {
  if (!/^https?:\/\//i.test(url)) throw new Error('網址必須以 http:// 或 https:// 開頭。')
  const executable = findBrowserExecutable(browser)
  if (!executable) {
    await shell.openExternal(url)
    return
  }
  const child = spawn(executable, [url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false
  })
  child.unref()
}

function selectedBrowser(project: ProjectRecord): GlobalBrowser {
  return project.browser === 'inherit'
    ? store.getState().settings.defaultBrowser
    : project.browser
}

async function selectProjectVisual(kind: ProjectVisualKind): Promise<string | null> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: kind === 'preview' ? '選擇專案預覽圖' : '選擇專案圖示',
    properties: ['openFile'],
    filters: [
      { name: '圖片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'ico'] }
    ]
  })
  if (result.canceled || !result.filePaths[0]) return null

  const filePath = result.filePaths[0]
  const fileInfo = await stat(filePath)
  if (fileInfo.size > 20 * 1024 * 1024) {
    throw new Error('圖片檔案不可超過 20 MB。')
  }

  const source = nativeImage.createFromPath(filePath)
  if (source.isEmpty()) throw new Error('無法讀取這張圖片，請改用 PNG、JPG 或 WebP。')
  const { width, height } = source.getSize()
  if (!width || !height) throw new Error('圖片尺寸無效。')

  const targetRatio = kind === 'preview' ? 16 / 9 : 1
  const sourceRatio = width / height
  const cropWidth = sourceRatio > targetRatio ? Math.round(height * targetRatio) : width
  const cropHeight = sourceRatio > targetRatio ? height : Math.round(width / targetRatio)
  const cropped = source.crop({
    x: Math.max(0, Math.floor((width - cropWidth) / 2)),
    y: Math.max(0, Math.floor((height - cropHeight) / 2)),
    width: cropWidth,
    height: cropHeight
  })

  if (kind === 'preview') {
    const resized = cropped.resize({ width: 1280, height: 720, quality: 'best' })
    return `data:image/jpeg;base64,${resized.toJPEG(86).toString('base64')}`
  }

  const resized = cropped.resize({ width: 256, height: 256, quality: 'best' })
  return `data:image/png;base64,${resized.toPNG().toString('base64')}`
}

async function maybeOpenBrowser(project: ProjectRecord, runtime: RuntimeState): Promise<void> {
  const running = runningProjects.get(project.id)
  if (!running || running.browserOpened || !store.getState().settings.autoOpenBrowser) return
  const url = runtime.url || project.customUrl
  if (!url) return
  await openInBrowser(url, selectedBrowser(project))
  running.browserOpened = true
  appendLog(
    project.id,
    'system',
    `已使用 ${selectedBrowser(project) === 'edge' ? 'Microsoft Edge' : 'Google Chrome'} 開啟：${url}`
  )
  await store.touchProject(project.id)
}

async function startProject(projectId: string): Promise<RuntimeState> {
  const active = runningProjects.get(projectId)
  if (active && active.runtime.status !== 'error') {
    if (active.runtime.url) await maybeOpenBrowser(store.getProject(projectId)!, active.runtime)
    return structuredClone(active.runtime)
  }

  const project = store.getProject(projectId)
  if (!project) throw new Error('找不到這個專案。')
  if (project.missing) throw new Error('專案資料夾不存在，請重新確認路徑。')
  if (!project.command.trim()) throw new Error('請先為專案設定啟動命令。')

  const runtime: RuntimeState = {
    projectId,
    status: 'starting',
    pid: null,
    url: project.customUrl,
    error: '',
    startedAt: new Date().toISOString()
  }
  emitRuntime(runtime)
  appendLog(projectId, 'system', `執行：${project.command}`)
  appendLog(projectId, 'system', `位置：${project.path}`)

  const child = spawn(project.command, {
    cwd: project.path,
    shell: true,
    env: { ...process.env, FORCE_COLOR: '0' },
    windowsHide: true
  })
  const running: RunningProject = {
    child,
    runtime,
    browserOpened: false,
    outputBuffer: '',
    requestedStop: false
  }
  runningProjects.set(projectId, running)

  child.once('spawn', () => {
    runtime.status = 'running'
    runtime.pid = child.pid ?? null
    emitRuntime(runtime)
    if (project.customUrl) {
      setTimeout(() => {
        void maybeOpenBrowser(project, runtime).catch((error: unknown) => {
          appendLog(projectId, 'stderr', error instanceof Error ? error.message : String(error))
        })
      }, 900)
    }
  })

  const handleOutput = (stream: 'stdout' | 'stderr', data: Buffer): void => {
    const text = data.toString('utf8')
    appendLog(projectId, stream, text)
    const output = consumeDevelopmentOutput(running.outputBuffer, text)
    running.outputBuffer = output.remainder
    const detectedUrl = output.url
    if (detectedUrl && !runtime.url) {
      runtime.url = detectedUrl
      emitRuntime(runtime)
      void maybeOpenBrowser(project, runtime).catch((error: unknown) => {
        appendLog(projectId, 'stderr', error instanceof Error ? error.message : String(error))
      })
    }
  }

  child.stdout?.on('data', (data: Buffer) => handleOutput('stdout', data))
  child.stderr?.on('data', (data: Buffer) => handleOutput('stderr', data))

  child.once('error', (error) => {
    runtime.status = 'error'
    runtime.error = error.message
    runtime.pid = null
    emitRuntime(runtime)
    appendLog(projectId, 'stderr', error.message)
    runningProjects.delete(projectId)
  })

  child.once('close', (code) => {
    if (runningProjects.get(projectId)?.child !== child) return
    runtime.status = running.requestedStop || code === 0 ? 'stopped' : 'error'
    runtime.error = runtime.status === 'error' ? `程序結束，代碼 ${code ?? '未知'}。` : ''
    runtime.pid = null
    emitRuntime(runtime)
    appendLog(
      projectId,
      runtime.status === 'error' ? 'stderr' : 'system',
      runtime.status === 'error' ? runtime.error : '開發伺服器已停止。'
    )
    runningProjects.delete(projectId)
  })

  await store.touchProject(projectId)
  return structuredClone(runtime)
}

async function stopProject(projectId: string): Promise<RuntimeState> {
  const running = runningProjects.get(projectId)
  if (!running?.child.pid) {
    const runtime = stoppedRuntime(projectId)
    emitRuntime(runtime)
    return runtime
  }

  running.requestedStop = true
  running.runtime.status = 'stopping'
  emitRuntime(running.runtime)

  await new Promise<void>((resolve) => {
    const killer = spawn('taskkill.exe', [
      '/PID',
      String(running.child.pid),
      '/T',
      '/F'
    ], { windowsHide: true })
    killer.once('close', () => resolve())
    killer.once('error', () => {
      running.child.kill()
      resolve()
    })
  })

  if (runningProjects.get(projectId)?.child === running.child) {
    runningProjects.delete(projectId)
  }
  const runtime = stoppedRuntime(projectId)
  emitRuntime(runtime)
  appendLog(projectId, 'system', '開發伺服器已停止。')
  return runtime
}

async function restartProject(projectId: string): Promise<RuntimeState> {
  await stopProject(projectId)
  return startProject(projectId)
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    backgroundColor: '#0b0d14',
    title: 'RepoDesk',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[preload] 無法載入 ${preloadPath}`, error)
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function focusMainWindow(): BrowserWindow {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('RepoDesk 主視窗尚未就緒。')
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  return mainWindow
}

function registerIpc(): void {
  ipcMain.handle('app:bootstrap', (): BootstrapPayload => ({
    state: store.getState(),
    runtimes: store.getState().projects.map((project) =>
      runtimeHistory.get(project.id) ?? stoppedRuntime(project.id)
    ),
    logs: Object.fromEntries(logs)
  }))

  ipcMain.handle('project:select-add', async () => {
    const result = await dialog.showOpenDialog(focusMainWindow(), {
      title: '選擇要加入的專案',
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    const project = await inspectProject(result.filePaths[0])
    return store.addProject(project)
  })

  ipcMain.handle('scan:select-directory', async () => {
    console.info('[scan] 已收到選擇資料夾要求。')
    const result = await dialog.showOpenDialog(focusMainWindow(), {
      title: '選擇要掃描的專案根目錄',
      buttonLabel: '掃描此資料夾',
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) {
      console.info('[scan] 使用者取消選擇資料夾。')
      return null
    }
    console.info(`[scan] 已選擇資料夾：${result.filePaths[0]}`)
    return result.filePaths[0]
  })

  ipcMain.handle('scan:run', async (_event, root: string) => {
    if (typeof root !== 'string' || !root.trim()) {
      throw new Error('沒有收到可掃描的資料夾路徑。')
    }

    const normalizedRoot = root.trim()
    try {
      const rootInfo = await stat(normalizedRoot)
      if (!rootInfo.isDirectory()) throw new Error('選擇的路徑不是資料夾。')
      console.info(`[scan] 開始掃描：${normalizedRoot}`)
      const result = await store.scanRoot(normalizedRoot)
      console.info(
        `[scan] 掃描完成：找到 ${result.discovered}，新增 ${result.added}，更新 ${result.updated}。`
      )
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[scan] 掃描失敗：${normalizedRoot}`, error)
      throw new Error(`無法掃描「${normalizedRoot}」：${message}`)
    }
  })

  async function removeProjectsFromList(projectIds: string[]): Promise<PersistedState> {
    const validIds = [...new Set(projectIds)]
      .filter((projectId) => typeof projectId === 'string' && store.getProject(projectId))
    await Promise.all(validIds
      .filter((projectId) => runningProjects.has(projectId))
      .map((projectId) => stopProject(projectId)))
    validIds.forEach((projectId) => {
      runtimeHistory.delete(projectId)
      logs.delete(projectId)
    })
    return store.removeProjects(validIds)
  }

  ipcMain.handle('project:update', (_event, project: ProjectRecord) => store.updateProject(project))
  ipcMain.handle('project:remove', (_event, projectId: string) =>
    removeProjectsFromList([projectId]))
  ipcMain.handle('project:remove-many', (_event, projectIds: string[]) =>
    removeProjectsFromList(Array.isArray(projectIds) ? projectIds : []))
  ipcMain.handle('project:clear', async () =>
    removeProjectsFromList(store.getState().projects.map((project) => project.id)))
  ipcMain.handle('settings:update', (_event, settings: UserSettings) => store.updateSettings(settings))
  ipcMain.handle('visual:select', (_event, kind: ProjectVisualKind) => selectProjectVisual(kind))
  ipcMain.handle('project:start', (_event, projectId: string) => startProject(projectId))
  ipcMain.handle('project:stop', (_event, projectId: string) => stopProject(projectId))
  ipcMain.handle('project:restart', (_event, projectId: string) => restartProject(projectId))

  ipcMain.handle('project:open-url', async (_event, projectId: string) => {
    const project = store.getProject(projectId)
    if (!project) throw new Error('找不到這個專案。')
    const runtime = runtimeHistory.get(projectId)
    const url = runtime?.url || project.customUrl
    if (!url) throw new Error('尚未偵測到可開啟的網址。')
    await openInBrowser(url, selectedBrowser(project))
    await store.touchProject(projectId)
  })

  ipcMain.handle('project:open-github', async (_event, projectId: string) => {
    const project = store.getProject(projectId)
    if (!project?.githubUrl || !/^https:\/\/github\.com\/[^/]+\/[^/]+$/i.test(project.githubUrl)) {
      throw new Error('這個專案沒有可開啟的 GitHub 連結。')
    }
    await openInBrowser(project.githubUrl, selectedBrowser(project))
  })

  ipcMain.handle('project:open-folder', async (_event, projectId: string) => {
    const project = store.getProject(projectId)
    if (!project) throw new Error('找不到這個專案。')
    const error = await shell.openPath(project.path)
    if (error) throw new Error(error)
  })

  ipcMain.handle('project:open-terminal', (_event, projectId: string) => {
    const project = store.getProject(projectId)
    if (!project) throw new Error('找不到這個專案。')
    const child = spawn('powershell.exe', ['-NoExit'], {
      cwd: project.path,
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    })
    child.unref()
  })

  ipcMain.handle('project:open-editor', (_event, projectId: string) => {
    const project = store.getProject(projectId)
    if (!project) throw new Error('找不到這個專案。')
    const child = spawn('code.cmd', ['.'], {
      cwd: project.path,
      detached: true,
      stdio: 'ignore',
      shell: true,
      windowsHide: false
    })
    child.unref()
  })
}

app.whenReady().then(async () => {
  store = new RepoDeskStore(join(app.getPath('userData'), 'repodesk-data.json'))
  await store.initialize()
  registerIpc()
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('before-quit', (event) => {
  if (isQuitting || runningProjects.size === 0) return
  event.preventDefault()
  isQuitting = true
  void Promise.all([...runningProjects.keys()].map((projectId) => stopProject(projectId)))
    .finally(() => app.quit())
})

app.on('window-all-closed', () => {
  app.quit()
})
