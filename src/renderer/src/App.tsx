import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCheck,
  FolderPlus,
  FolderSearch2,
  LayoutGrid,
  ListChecks,
  ListFilter,
  LoaderCircle,
  Play,
  Search,
  Settings2,
  Trash2,
  X
} from 'lucide-react'
import { api } from './api'
import { LogPanel } from './components/LogPanel'
import { ProjectCard } from './components/ProjectCard'
import { ProjectDrawer } from './components/ProjectDrawer'
import { ScanHistoryPanel } from './components/ScanHistoryPanel'
import { SettingsModal } from './components/SettingsModal'
import { Sidebar, type FilterKey } from './components/Sidebar'
import type {
  LogEntry,
  PersistedState,
  ProjectRecord,
  ProjectVisualKind,
  RuntimeState,
  UserSettings
} from '../../shared/types'

interface ToastState {
  message: string
  tone: 'success' | 'error' | 'info'
}

type ScanPhase = 'idle' | 'choosing' | 'scanning'

function stopped(projectId: string): RuntimeState {
  return {
    projectId,
    status: 'stopped',
    pid: null,
    url: '',
    error: '',
    startedAt: null
  }
}

function relativeDate(value: string | null): string {
  if (!value) return '尚未開啟'
  const difference = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(difference / 60000)
  if (minutes < 1) return '剛剛開啟'
  if (minutes < 60) return `${minutes} 分鐘前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小時前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(value).toLocaleDateString('zh-TW')
}

export function App() {
  const [state, setState] = useState<PersistedState | null>(null)
  const [runtimes, setRuntimes] = useState<Record<string, RuntimeState>>({})
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({})
  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [logProjectId, setLogProjectId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [working, setWorking] = useState(false)
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle')
  const [scanPath, setScanPath] = useState('')
  const [fatalError, setFatalError] = useState('')
  const [toast, setToast] = useState<ToastState | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    void api.bootstrap()
      .then((payload) => {
        if (!active) return
        setState(payload.state)
        setRuntimes(Object.fromEntries(payload.runtimes.map((runtime) => [runtime.projectId, runtime])))
        setLogs(payload.logs)
      })
      .catch((error: unknown) => {
        const message = errorMessage(error)
        setFatalError(message)
        setToast({ message, tone: 'error' })
      })

    const removeRuntimeListener = api.onRuntimeChanged((runtime) => {
      setRuntimes((current) => ({ ...current, [runtime.projectId]: runtime }))
    })
    const removeLogListener = api.onLog((entry) => {
      setLogs((current) => ({
        ...current,
        [entry.projectId]: [...(current[entry.projectId] ?? []), entry].slice(-400)
      }))
    })

    return () => {
      active = false
      removeRuntimeListener()
      removeLogListener()
    }
  }, [])

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const visibleProjects = useMemo(() => {
    if (!state) return []
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-TW')
    const categoryOrder = new Map(
      state.settings.categories.map((category, index) => [category.id, index])
    )
    return state.projects
      .filter((project) => {
        if (filter.startsWith('category:')) {
          return project.categoryId === filter.slice('category:'.length)
        }
        if (filter === 'running') {
          return ['starting', 'running', 'stopping'].includes(runtimes[project.id]?.status)
        }
        if (filter === 'favorites') return project.favorite
        if (filter !== 'all') return project.status === filter
        return true
      })
      .filter((project) => {
        if (!normalizedQuery) return true
        return [
          project.name,
          project.description,
          project.path,
          ...project.tags
        ].some((value) => value.toLocaleLowerCase('zh-TW').includes(normalizedQuery))
      })
      .sort((first, second) => {
        if (first.favorite !== second.favorite) return first.favorite ? -1 : 1
        const categoryDifference = (categoryOrder.get(first.categoryId) ?? Number.MAX_SAFE_INTEGER)
          - (categoryOrder.get(second.categoryId) ?? Number.MAX_SAFE_INTEGER)
        if (categoryDifference) return categoryDifference
        return first.name.localeCompare(second.name, 'zh-Hant', {
          numeric: true,
          sensitivity: 'base'
        })
      })
  }, [filter, query, runtimes, state])

  const selectedProject = state?.projects.find((project) => project.id === selectedProjectId) ?? null
  const logProject = state?.projects.find((project) => project.id === logProjectId) ?? null
  const runningCount = state?.projects.filter((project) =>
    ['starting', 'running', 'stopping'].includes(runtimes[project.id]?.status)
  ).length ?? 0
  const recentProject = state?.projects
    .filter((project) => project.lastOpenedAt)
    .sort((a, b) => (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? ''))[0]
  const allVisibleSelected = visibleProjects.length > 0
    && visibleProjects.every((project) => selectedProjectIds.has(project.id))

  function showToast(message: string, tone: ToastState['tone'] = 'info'): void {
    setToast({ message, tone })
  }

  async function runAction(action: () => Promise<void>, successMessage?: string): Promise<void> {
    try {
      await action()
      if (successMessage) showToast(successMessage, 'success')
    } catch (error) {
      showToast(errorMessage(error), 'error')
    }
  }

  async function addProject(): Promise<void> {
    setWorking(true)
    try {
      const nextState = await api.selectAndAddProject()
      if (nextState) {
        setState(nextState)
        showToast('專案已加入 RepoDesk。', 'success')
      }
    } catch (error) {
      showToast(errorMessage(error), 'error')
    } finally {
      setWorking(false)
    }
  }

  async function scanRoot(): Promise<void> {
    setScanPath('')
    setScanPhase('choosing')
    try {
      const root = await api.selectScanDirectory()
      if (!root) {
        showToast('已取消選擇資料夾。')
        return
      }
      setScanPath(root)
      setScanPhase('scanning')
      const result = await api.scanDirectory(root)
      setState(result.state)
      showToast(
        `掃描完成：找到 ${result.discovered} 個專案，新增 ${result.added} 個，更新 ${result.updated} 個。`,
        'success'
      )
    } catch (error) {
      showToast(errorMessage(error), 'error')
    } finally {
      setScanPhase('idle')
    }
  }

  async function updateProject(project: ProjectRecord): Promise<void> {
    const nextState = await api.updateProject(project)
    setState(nextState)
    setSelectedProjectId(null)
    showToast('專案設定已儲存。', 'success')
  }

  async function toggleFavorite(project: ProjectRecord): Promise<void> {
    await runAction(async () => {
      const nextState = await api.updateProject({ ...project, favorite: !project.favorite })
      setState(nextState)
    })
  }

  async function removeProject(projectId: string): Promise<void> {
    if (!window.confirm('確定要從 RepoDesk 移除這個專案嗎？電腦中的專案檔案不會被刪除。')) return
    const nextState = await api.removeProject(projectId)
    setState(nextState)
    setRuntimes((current) => Object.fromEntries(
      Object.entries(current).filter(([id]) => id !== projectId)
    ))
    setLogs((current) => Object.fromEntries(
      Object.entries(current).filter(([id]) => id !== projectId)
    ))
    setSelectedProjectId(null)
    setSelectedProjectIds((current) => {
      const next = new Set(current)
      next.delete(projectId)
      return next
    })
    if (logProjectId === projectId) setLogProjectId(null)
    showToast('已從 RepoDesk 移除專案，原始檔案未受影響。', 'success')
  }

  function toggleProjectSelection(projectId: string): void {
    setSelectedProjectIds((current) => {
      const next = new Set(current)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  function exitSelectionMode(): void {
    setSelectionMode(false)
    setSelectedProjectIds(new Set())
  }

  function toggleVisibleSelection(): void {
    setSelectedProjectIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) visibleProjects.forEach((project) => next.delete(project.id))
      else visibleProjects.forEach((project) => next.add(project.id))
      return next
    })
  }

  async function removeSelectedProjects(): Promise<void> {
    if (!state) return
    const projectIds = [...selectedProjectIds]
      .filter((projectId) => state.projects.some((project) => project.id === projectId))
    if (!projectIds.length) return
    if (!window.confirm(
      `確定要從 RepoDesk 列表移除選取的 ${projectIds.length} 個專案嗎？\n\n`
      + '這個動作只會移除 RepoDesk 的列表紀錄，絕對不會刪除或修改任何原始專案檔案。'
    )) return

    setWorking(true)
    try {
      const nextState = await api.removeProjects(projectIds)
      const removed = new Set(projectIds)
      setState(nextState)
      setRuntimes((current) => Object.fromEntries(
        Object.entries(current).filter(([id]) => !removed.has(id))
      ))
      setLogs((current) => Object.fromEntries(
        Object.entries(current).filter(([id]) => !removed.has(id))
      ))
      if (selectedProjectId && removed.has(selectedProjectId)) setSelectedProjectId(null)
      if (logProjectId && removed.has(logProjectId)) setLogProjectId(null)
      exitSelectionMode()
      showToast(`已從列表移除 ${projectIds.length} 個專案，原始檔案未受影響。`, 'success')
    } catch (error) {
      showToast(errorMessage(error), 'error')
    } finally {
      setWorking(false)
    }
  }

  async function clearProjectList(): Promise<void> {
    if (!state?.projects.length) return
    if (!window.confirm(
      `確定要清除 RepoDesk 列表中的全部 ${state.projects.length} 個專案嗎？\n\n`
      + '這個動作只會清除 RepoDesk 的列表紀錄與執行狀態，絕對不會刪除、移動或修改任何原始專案檔案。'
    )) return

    setWorking(true)
    try {
      const nextState = await api.clearProjects()
      setState(nextState)
      setRuntimes({})
      setLogs({})
      setSelectedProjectId(null)
      setLogProjectId(null)
      exitSelectionMode()
      showToast('RepoDesk 專案列表已清空，所有原始專案檔案均未受影響。', 'success')
    } catch (error) {
      showToast(errorMessage(error), 'error')
    } finally {
      setWorking(false)
    }
  }

  async function updateSettings(settings: UserSettings): Promise<void> {
    const nextState = await api.updateSettings(settings)
    setState(nextState)
    if (
      filter.startsWith('category:')
      && !nextState.settings.categories.some((category) =>
        category.id === filter.slice('category:'.length)
      )
    ) {
      setFilter('all')
    }
    showToast('偏好設定已儲存。', 'success')
  }

  async function selectProjectVisual(kind: ProjectVisualKind): Promise<string | null> {
    try {
      return await api.selectProjectVisual(kind)
    } catch (error) {
      showToast(errorMessage(error), 'error')
      return null
    }
  }

  function runtimeFor(projectId: string): RuntimeState {
    return runtimes[projectId] ?? stopped(projectId)
  }

  function start(projectId: string): void {
    void runAction(async () => {
      const runtime = await api.startProject(projectId)
      setRuntimes((current) => ({ ...current, [projectId]: runtime }))
    }, '正在啟動專案，偵測到網址後會自動開啟瀏覽器。')
  }

  function stop(projectId: string): void {
    void runAction(async () => {
      const runtime = await api.stopProject(projectId)
      setRuntimes((current) => ({ ...current, [projectId]: runtime }))
    }, '專案已停止。')
  }

  function restart(projectId: string): void {
    void runAction(async () => {
      const runtime = await api.restartProject(projectId)
      setRuntimes((current) => ({ ...current, [projectId]: runtime }))
    }, '專案正在重新啟動。')
  }

  if (!state) {
    return (
      <main className="loading-screen">
        <div className="loading-mark"><LayoutGrid size={26} /></div>
        {fatalError ? <p className="loading-error">{fatalError}</p> : (
          <>
            <LoaderCircle className="spin" size={22} />
            <p>正在整理你的專案工作區</p>
          </>
        )}
      </main>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar
        projects={state.projects}
        categories={state.settings.categories}
        runtimes={runtimes}
        filter={filter}
        onFilterChange={setFilter}
        onSettings={() => setSettingsOpen(true)}
      />

      <main className="workspace">
        <header className="topbar">
          <div className="search-box">
            <Search size={18} />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋名稱、介紹、標籤或路徑"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="清除搜尋">
                <X size={15} />
              </button>
            )}
            <kbd>Ctrl K</kbd>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void scanRoot()}
              disabled={working || scanPhase !== 'idle'}
              data-testid="scan-directory"
            >
              {scanPhase !== 'idle'
                ? <LoaderCircle className="spin" size={17} />
                : <FolderSearch2 size={17} />}
              {scanPhase === 'choosing' ? '等待選擇…' : scanPhase === 'scanning' ? '正在掃描…' : '掃描資料夾'}
            </button>
            <button type="button" className="add-button" onClick={() => void addProject()} disabled={working}>
              {working ? <LoaderCircle className="spin" size={17} /> : <FolderPlus size={17} />}
              加入專案
            </button>
            <button type="button" className="icon-button top-settings" onClick={() => setSettingsOpen(true)} aria-label="偏好設定">
              <Settings2 size={18} />
            </button>
          </div>
        </header>

        {scanPhase !== 'idle' && (
          <div className="scan-progress" role="status" aria-live="polite">
            <LoaderCircle className="spin" size={17} />
            <div>
              <strong>{scanPhase === 'choosing' ? '請在 Windows 視窗選擇資料夾' : '正在尋找專案'}</strong>
              <span>{scanPhase === 'choosing'
                ? '選擇後會立即開始掃描，不會儲存這次選擇的根目錄。'
                : scanPath}</span>
            </div>
          </div>
        )}

        <div className="workspace-scroll">
          <section className="overview">
            <div>
              <span className="eyebrow">PROJECT LIBRARY</span>
              <h1>你的專案，都在這裡。</h1>
              <p>不用再找資料夾、開 PowerShell 或手動複製網址。</p>
            </div>
            <div className="overview-stats">
              <div>
                <strong>{state.projects.length}</strong>
                <span>所有專案</span>
              </div>
              <div className={runningCount ? 'active-stat' : ''}>
                <strong>{runningCount}</strong>
                <span>正在執行</span>
              </div>
              <div>
                <strong>{state.projects.filter((project) => project.favorite).length}</strong>
                <span>我的最愛</span>
              </div>
            </div>
          </section>

          <ScanHistoryPanel entries={state.scanHistory} />

          {recentProject && (
            <section className="continue-card" style={{ '--project-accent': recentProject.accent } as React.CSSProperties}>
              <div className="continue-glow" />
              <div className="continue-icon">{recentProject.name.slice(0, 2).toUpperCase()}</div>
              <div className="continue-copy">
                <span>繼續上次工作</span>
                <strong>{recentProject.name}</strong>
                <p>{relativeDate(recentProject.lastOpenedAt)} · {recentProject.command || '尚未設定命令'}</p>
              </div>
              <button
                type="button"
                className="continue-button"
                onClick={() => runtimeFor(recentProject.id).status === 'running'
                  ? void runAction(() => api.openProjectUrl(recentProject.id))
                  : start(recentProject.id)}
              >
                <Play size={15} fill="currentColor" />
                {runtimeFor(recentProject.id).status === 'running' ? '開啟網站' : '啟動專案'}
              </button>
            </section>
          )}

          <section className="projects-section">
            <div className="section-title-row">
              <div>
                <h2>{filterTitle(filter, state.settings.categories)}</h2>
                <span>{visibleProjects.length} 個結果</span>
              </div>
              <div className="project-list-actions">
                {selectionMode ? (
                  <>
                    <span className="selection-count">已選 {selectedProjectIds.size} 個</span>
                    <button type="button" className="refresh-button" onClick={toggleVisibleSelection}>
                      <CheckCheck size={16} />
                      {allVisibleSelected ? '取消全選' : '全選目前結果'}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => void removeSelectedProjects()}
                      disabled={working || selectedProjectIds.size === 0}
                    >
                      <Trash2 size={16} />
                      從列表移除
                    </button>
                    <button type="button" className="refresh-button" onClick={exitSelectionMode}>
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="refresh-button"
                      onClick={() => setSelectionMode(true)}
                      disabled={!state.projects.length || working}
                    >
                      <ListChecks size={16} />
                      批量管理
                    </button>
                    <button
                      type="button"
                      className="danger-ghost-button"
                      onClick={() => void clearProjectList()}
                      disabled={!state.projects.length || working}
                    >
                      <Trash2 size={16} />
                      清空列表
                    </button>
                    <button type="button" className="refresh-button" onClick={() => void scanRoot()} disabled={working || scanPhase !== 'idle'}>
                      <FolderSearch2 size={16} />
                      掃描資料夾
                    </button>
                  </>
                )}
              </div>
            </div>

            {visibleProjects.length ? (
              <div className="project-grid">
                {visibleProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    category={state.settings.categories.find((category) => category.id === project.categoryId)}
                    displayMode={state.settings.cardDisplayMode}
                    runtime={runtimeFor(project.id)}
                    onEdit={() => setSelectedProjectId(project.id)}
                    onStart={() => start(project.id)}
                    onStop={() => stop(project.id)}
                    onOpenUrl={() => void runAction(() => api.openProjectUrl(project.id))}
                    onOpenFolder={() => void runAction(() => api.openProjectFolder(project.id))}
                    onOpenTerminal={() => void runAction(() => api.openProjectTerminal(project.id))}
                    onShowLogs={() => setLogProjectId(project.id)}
                    onToggleFavorite={() => void toggleFavorite(project)}
                    onOpenGithub={() => void runAction(() => api.openProjectGithub(project.id))}
                    selectionMode={selectionMode}
                    selected={selectedProjectIds.has(project.id)}
                    onSelectionChange={() => toggleProjectSelection(project.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon"><ListFilter size={24} /></div>
                <h3>{state.projects.length ? '這個篩選條件下沒有專案' : '把第一個專案收進 RepoDesk'}</h3>
                <p>{state.projects.length ? '試著清除搜尋或切換左側分類。' : '你可以加入單一專案，或掃描整個專案資料夾。'}</p>
                {!state.projects.length && (
                  <div>
                    <button type="button" className="secondary-button" onClick={() => void scanRoot()} disabled={working || scanPhase !== 'idle'}>
                      <FolderSearch2 size={17} />掃描資料夾
                    </button>
                    <button type="button" className="add-button" onClick={() => void addProject()}>
                      <FolderPlus size={17} />加入專案
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {selectedProject && (
        <ProjectDrawer
          project={selectedProject}
          categories={state.settings.categories}
          runtime={runtimeFor(selectedProject.id)}
          onClose={() => setSelectedProjectId(null)}
          onSave={updateProject}
          onRemove={() => removeProject(selectedProject.id)}
          onSelectVisual={selectProjectVisual}
          onStart={() => start(selectedProject.id)}
          onStop={() => stop(selectedProject.id)}
          onRestart={() => restart(selectedProject.id)}
          onOpenUrl={() => void runAction(() => api.openProjectUrl(selectedProject.id))}
          onOpenFolder={() => void runAction(() => api.openProjectFolder(selectedProject.id))}
          onOpenTerminal={() => void runAction(() => api.openProjectTerminal(selectedProject.id))}
          onOpenEditor={() => void runAction(() => api.openProjectEditor(selectedProject.id))}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={state.settings}
          onClose={() => setSettingsOpen(false)}
          onSave={updateSettings}
        />
      )}

      {logProject && (
        <LogPanel
          project={logProject}
          runtime={runtimeFor(logProject.id)}
          logs={logs[logProject.id] ?? []}
          onClose={() => setLogProjectId(null)}
          onRestart={() => restart(logProject.id)}
        />
      )}

      {toast && (
        <div className={`toast ${toast.tone}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="關閉通知"><X size={15} /></button>
        </div>
      )}
    </div>
  )
}

function filterTitle(filter: FilterKey, categories: UserSettings['categories']): string {
  if (filter.startsWith('category:')) {
    return categories.find((category) => category.id === filter.slice('category:'.length))?.name ?? '專案類型'
  }
  const titles: Record<Exclude<FilterKey, `category:${string}`>, string> = {
    all: '所有專案',
    running: '正在執行',
    favorites: '我的最愛',
    active: '開發中',
    paused: '暫停的專案',
    complete: '已完成'
  }
  return titles[filter as Exclude<FilterKey, `category:${string}`>]
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
  }
  return String(error)
}
