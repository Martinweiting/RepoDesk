export type GlobalBrowser = 'edge' | 'chrome'
export type ProjectBrowser = 'inherit' | GlobalBrowser
export type ProjectStatus = 'active' | 'paused' | 'complete'
export type RuntimeStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'
export type CardDisplayMode = 'icon' | 'preview'
export type ProjectVisualKind = 'icon' | 'preview'

export interface ProjectCategory {
  id: string
  name: string
  color: string
  locked?: boolean
}

export interface ProjectRecord {
  id: string
  path: string
  name: string
  description: string
  tags: string[]
  status: ProjectStatus
  favorite: boolean
  accent: string
  iconId: string
  customIconDataUrl: string
  previewImageDataUrl: string
  categoryId: string
  command: string
  browser: ProjectBrowser
  customUrl: string
  githubUrl: string
  availableCommands: string[]
  createdAt: string
  updatedAt: string
  lastOpenedAt: string | null
  missing: boolean
}

export interface ScanHistoryEntry {
  path: string
  scannedAt: string
  discovered: number
}

export interface UserSettings {
  defaultBrowser: GlobalBrowser
  autoOpenBrowser: boolean
  launchAtLogin: boolean
  scanDepth: number
  cardDisplayMode: CardDisplayMode
  categories: ProjectCategory[]
}

export interface PersistedState {
  version: 3
  projects: ProjectRecord[]
  settings: UserSettings
  scanHistory: ScanHistoryEntry[]
}

export interface RuntimeState {
  projectId: string
  status: RuntimeStatus
  pid: number | null
  url: string
  error: string
  startedAt: string | null
}

export interface LogEntry {
  projectId: string
  stream: 'system' | 'stdout' | 'stderr'
  message: string
  timestamp: string
}

export interface BootstrapPayload {
  state: PersistedState
  runtimes: RuntimeState[]
  logs: Record<string, LogEntry[]>
  appVersion: string
}

export interface VersionCheckResult {
  currentVersion: string
  latestVersion: string
  status: 'up-to-date' | 'update-available'
  source: 'github-release' | 'repository'
}

export interface ScanResult {
  root: string
  discovered: number
  added: number
  updated: number
  state: PersistedState
}

export interface RepoDeskApi {
  bootstrap(): Promise<BootstrapPayload>
  selectAndAddProject(): Promise<PersistedState | null>
  selectScanDirectory(): Promise<string | null>
  scanDirectory(root: string): Promise<ScanResult>
  updateProject(project: ProjectRecord): Promise<PersistedState>
  removeProject(projectId: string): Promise<PersistedState>
  removeProjects(projectIds: string[]): Promise<PersistedState>
  clearProjects(): Promise<PersistedState>
  updateSettings(settings: UserSettings): Promise<PersistedState>
  selectProjectVisual(kind: ProjectVisualKind): Promise<string | null>
  startProject(projectId: string): Promise<RuntimeState>
  stopProject(projectId: string): Promise<RuntimeState>
  restartProject(projectId: string): Promise<RuntimeState>
  openProjectUrl(projectId: string): Promise<void>
  openProjectFolder(projectId: string): Promise<void>
  openProjectTerminal(projectId: string): Promise<void>
  openProjectEditor(projectId: string): Promise<void>
  openProjectGithub(projectId: string): Promise<void>
  checkForUpdates(): Promise<VersionCheckResult>
  openUpdatePage(): Promise<void>
  onRuntimeChanged(callback: (runtime: RuntimeState) => void): () => void
  onLog(callback: (entry: LogEntry) => void): () => void
}
