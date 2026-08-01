import { contextBridge, ipcRenderer } from 'electron'
import type {
  LogEntry,
  ProjectRecord,
  RepoDeskApi,
  RuntimeState,
  UserSettings,
  ProjectVisualKind
} from '../shared/types'

const api: RepoDeskApi = {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  selectAndAddProject: () => ipcRenderer.invoke('project:select-add'),
  addShortcut: (shortcutPath: string) => ipcRenderer.invoke('project:add-shortcut', shortcutPath),
  selectScanDirectory: () => ipcRenderer.invoke('scan:select-directory'),
  scanDirectory: (root: string) => ipcRenderer.invoke('scan:run', root),
  updateProject: (project: ProjectRecord) => ipcRenderer.invoke('project:update', project),
  removeProject: (projectId: string) => ipcRenderer.invoke('project:remove', projectId),
  removeProjects: (projectIds: string[]) => ipcRenderer.invoke('project:remove-many', projectIds),
  clearProjects: () => ipcRenderer.invoke('project:clear'),
  updateSettings: (settings: UserSettings) => ipcRenderer.invoke('settings:update', settings),
  selectProjectVisual: (kind: ProjectVisualKind) => ipcRenderer.invoke('visual:select', kind),
  startProject: (projectId: string) => ipcRenderer.invoke('project:start', projectId),
  stopProject: (projectId: string) => ipcRenderer.invoke('project:stop', projectId),
  restartProject: (projectId: string) => ipcRenderer.invoke('project:restart', projectId),
  openProjectUrl: (projectId: string) => ipcRenderer.invoke('project:open-url', projectId),
  openProjectFolder: (projectId: string) => ipcRenderer.invoke('project:open-folder', projectId),
  openProjectTerminal: (projectId: string) => ipcRenderer.invoke('project:open-terminal', projectId),
  openProjectEditor: (projectId: string) => ipcRenderer.invoke('project:open-editor', projectId),
  openProjectGithub: (projectId: string) => ipcRenderer.invoke('project:open-github', projectId),
  checkForUpdates: () => ipcRenderer.invoke('app:check-updates'),
  openUpdatePage: () => ipcRenderer.invoke('app:open-update-page'),
  onRuntimeChanged: (callback: (runtime: RuntimeState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, runtime: RuntimeState): void => callback(runtime)
    ipcRenderer.on('runtime:changed', listener)
    return () => ipcRenderer.removeListener('runtime:changed', listener)
  },
  onLog: (callback: (entry: LogEntry) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, entry: LogEntry): void => callback(entry)
    ipcRenderer.on('project:log', listener)
    return () => ipcRenderer.removeListener('project:log', listener)
  }
}

contextBridge.exposeInMainWorld('repodesk', api)
