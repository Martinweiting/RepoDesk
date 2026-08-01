import type {
  BootstrapPayload,
  LogEntry,
  ProjectRecord,
  RepoDeskApi,
  RuntimeState,
  UserSettings
} from '../../shared/types'

const runtimeListeners = new Set<(runtime: RuntimeState) => void>()
const logListeners = new Set<(entry: LogEntry) => void>()

function unavailable(): Promise<never> {
  return Promise.reject(new Error(
    'RepoDesk 核心服務未載入。請完全關閉程式後重新開啟；若仍出現此訊息，請重新安裝最新版。'
  ))
}

const unavailableApi: RepoDeskApi = {
  async bootstrap(): Promise<BootstrapPayload> {
    return unavailable()
  },
  async selectAndAddProject() {
    return unavailable()
  },
  async addShortcut(_shortcutPath: string) {
    return unavailable()
  },
  async selectScanDirectory() {
    return unavailable()
  },
  async scanDirectory() {
    return unavailable()
  },
  async updateProject(_project: ProjectRecord) {
    return unavailable()
  },
  async removeProject(_projectId: string) {
    return unavailable()
  },
  async removeProjects(_projectIds: string[]) {
    return unavailable()
  },
  async clearProjects() {
    return unavailable()
  },
  async updateSettings(_settings: UserSettings) {
    return unavailable()
  },
  async selectProjectVisual() {
    return unavailable()
  },
  async startProject(_projectId: string) {
    return unavailable()
  },
  async stopProject(_projectId: string) {
    return unavailable()
  },
  async restartProject(_projectId: string) {
    return unavailable()
  },
  async openProjectUrl() { return unavailable() },
  async openProjectFolder() { return unavailable() },
  async openProjectTerminal() { return unavailable() },
  async openProjectEditor() { return unavailable() },
  async openProjectGithub() { return unavailable() },
  async checkForUpdates() { return unavailable() },
  async openUpdatePage() { return unavailable() },
  onRuntimeChanged(callback) {
    runtimeListeners.add(callback)
    return () => runtimeListeners.delete(callback)
  },
  onLog(callback) {
    logListeners.add(callback)
    return () => logListeners.delete(callback)
  }
}

export const api: RepoDeskApi = window.repodesk ?? unavailableApi
