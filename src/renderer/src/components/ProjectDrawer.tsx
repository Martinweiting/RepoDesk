import { useEffect, useState } from 'react'
import {
  Code2,
  Copy,
  ExternalLink,
  FolderOpen,
  ImagePlus,
  Play,
  RefreshCcw,
  Save,
  Square,
  TerminalSquare,
  Trash2,
  Upload,
  X
} from 'lucide-react'
import type {
  GlobalBrowser,
  ProjectCategory,
  ProjectRecord,
  ProjectVisualKind,
  RuntimeState
} from '../../../shared/types'
import { PROJECT_ICON_IDS } from '../../../shared/visuals'
import { PROJECT_ICON_LABELS, ProjectIcon } from './ProjectIcon'
import { normalizeProjectUrl } from '../../../shared/runtime'

interface ProjectDrawerProps {
  project: ProjectRecord
  categories: ProjectCategory[]
  defaultBrowser: GlobalBrowser
  runtime: RuntimeState
  onClose: () => void
  onSave: (project: ProjectRecord) => Promise<void>
  onRemove: () => Promise<void>
  onSelectVisual: (kind: ProjectVisualKind) => Promise<string | null>
  onStart: () => void
  onStop: () => void
  onRestart: () => void
  onOpenUrl: () => void
  onOpenFolder: () => void
  onOpenTerminal: () => void
  onOpenEditor: () => void
}

export function ProjectDrawer({
  project,
  categories,
  defaultBrowser,
  runtime,
  onClose,
  onSave,
  onRemove,
  onSelectVisual,
  onStart,
  onStop,
  onRestart,
  onOpenUrl,
  onOpenFolder,
  onOpenTerminal,
  onOpenEditor
}: ProjectDrawerProps) {
  const [draft, setDraft] = useState(project)
  const [saving, setSaving] = useState(false)
  const [importingVisual, setImportingVisual] = useState<ProjectVisualKind | null>(null)
  const [urlError, setUrlError] = useState('')
  const [copiedValue, setCopiedValue] = useState('')
  const isRunning = runtime.status === 'running'

  useEffect(() => setDraft(project), [project])

  async function save(): Promise<void> {
    const normalizedUrl = draft.customUrl.trim() ? normalizeProjectUrl(draft.customUrl) : ''
    if (draft.customUrl.trim() && !normalizedUrl) {
      setUrlError('網址格式不正確，請輸入 localhost:3000 或完整的 http://、https:// 網址。')
      return
    }
    setUrlError('')
    setSaving(true)
    try {
      await onSave({
        ...draft,
        customUrl: normalizedUrl,
        tags: draft.tags.map((tag) => tag.trim()).filter(Boolean)
      })
    } finally {
      setSaving(false)
    }
  }

  async function importVisual(kind: ProjectVisualKind): Promise<void> {
    setImportingVisual(kind)
    try {
      const dataUrl = await onSelectVisual(kind)
      if (!dataUrl) return
      setDraft((current) => kind === 'preview'
        ? { ...current, previewImageDataUrl: dataUrl }
        : { ...current, customIconDataUrl: dataUrl })
    } finally {
      setImportingVisual(null)
    }
  }

  function promoteCommand(command: string): void {
    setDraft((current) => ({
      ...current,
      command,
      availableCommands: [command, ...current.availableCommands.filter((candidate) => candidate !== command)],
      secondaryCommands: current.secondaryCommands.filter((candidate) => candidate !== command)
    }))
  }

  async function copyValue(value: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedValue(key)
      window.setTimeout(() => setCopiedValue((current) => current === key ? '' : current), 1600)
    } catch {
      setCopiedValue('')
    }
  }

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside
        className="project-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-header" style={{ '--project-accent': draft.accent } as React.CSSProperties}>
          <div className="drawer-project-mark">
            <ProjectIcon
              iconId={draft.iconId}
              customIconDataUrl={draft.customIconDataUrl}
              size={21}
            />
          </div>
          <div>
            <span className="eyebrow">專案設定</span>
            <h2 id="project-drawer-title">{draft.name}</h2>
            <span className="drawer-folder-name">資料夾：{draft.folderName}</span>
          </div>
          <button type="button" className="icon-button close-button" onClick={onClose} aria-label="關閉">
            <X size={20} />
          </button>
        </div>

        <div className="drawer-runtime">
          <div>
            <span className={`runtime-dot ${runtime.status}`} />
            <div>
              <strong>{isRunning ? '開發伺服器執行中' : runtime.status === 'error' ? '上次啟動失敗' : '目前未執行'}</strong>
                <span>{draft.customUrl || runtime.url || runtime.error || draft.command || '尚未設定啟動命令'}</span>
            </div>
          </div>
          <div className="runtime-actions">
            {isRunning || runtime.url || project.customUrl ? (
              <>
                <button type="button" className="small-button" onClick={onOpenUrl}><ExternalLink size={14} />網站</button>
                <button type="button" className="small-button" onClick={onRestart}><RefreshCcw size={14} />重啟</button>
                <button type="button" className="small-button danger" onClick={onStop}><Square size={13} fill="currentColor" />停止</button>
              </>
            ) : (
              <button type="button" className="small-button primary" onClick={onStart} disabled={!draft.command}>
                <Play size={14} fill="currentColor" />啟動
              </button>
            )}
          </div>
        </div>

        <div className="drawer-scroll">
          <section className="form-section visual-section">
            <h3>卡片外觀</h3>
            <p className="section-description">圖示會用於所有模式；預覽圖建議使用 1280×720，匯入時會自動裁切成 16:9。</p>

            <div className="preview-editor">
              {draft.previewImageDataUrl ? (
                <img src={draft.previewImageDataUrl} alt={`${draft.name} 預覽圖`} />
              ) : (
                <div className="preview-editor-empty">
                  <ImagePlus size={24} />
                  <span>尚未加入預覽圖</span>
                </div>
              )}
              <div className="preview-editor-actions">
                <button
                  type="button"
                  className="small-button"
                  onClick={() => void importVisual('preview')}
                  disabled={importingVisual !== null}
                >
                  <Upload size={14} />
                  {importingVisual === 'preview' ? '匯入中' : draft.previewImageDataUrl ? '更換預覽圖' : '匯入預覽圖'}
                </button>
                {draft.previewImageDataUrl && (
                  <button
                    type="button"
                    className="small-button danger"
                    onClick={() => setDraft({ ...draft, previewImageDataUrl: '' })}
                  >
                    移除
                  </button>
                )}
              </div>
            </div>

            <div className="icon-picker-heading">
              <span>選擇內建圖示</span>
              <small>新掃描的專案會從以下圖示隨機挑選</small>
            </div>
            <div className="icon-picker" aria-label="內建專案圖示">
              {PROJECT_ICON_IDS.map((iconId) => (
                <button
                  type="button"
                  className={!draft.customIconDataUrl && draft.iconId === iconId ? 'selected' : ''}
                  onClick={() => setDraft({ ...draft, iconId, customIconDataUrl: '' })}
                  aria-label={PROJECT_ICON_LABELS[iconId]}
                  title={PROJECT_ICON_LABELS[iconId]}
                  key={iconId}
                >
                  <ProjectIcon iconId={iconId} size={19} />
                </button>
              ))}
              {draft.customIconDataUrl && (
                <span className="custom-icon-choice selected" title="目前的自訂圖示">
                  <ProjectIcon iconId={draft.iconId} customIconDataUrl={draft.customIconDataUrl} size={22} />
                </span>
              )}
            </div>
            <div className="custom-icon-actions">
              <button
                type="button"
                className="small-button"
                onClick={() => void importVisual('icon')}
                disabled={importingVisual !== null}
              >
                <Upload size={14} />
                {importingVisual === 'icon' ? '匯入中' : '匯入自訂圖示'}
              </button>
              {draft.customIconDataUrl && (
                <button
                  type="button"
                  className="small-button danger"
                  onClick={() => setDraft({ ...draft, customIconDataUrl: '' })}
                >
                  改回內建圖示
                </button>
              )}
            </div>
          </section>

          <section className="form-section">
            <h3>基本資料</h3>
            <label>
                <span>顯示名稱</span>
                <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
                <small>原始資料夾名稱：{draft.folderName}</small>
            </label>
            <label>
              <span>專案介紹</span>
              <textarea
                rows={4}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </label>
            <div className="field-pair">
              <label>
                <span>專案狀態</span>
                <select
                  value={draft.status}
                  onChange={(event) => setDraft({
                    ...draft,
                    status: event.target.value as ProjectRecord['status']
                  })}
                >
                  <option value="active">開發中</option>
                  <option value="paused">暫停</option>
                  <option value="complete">已完成</option>
                </select>
              </label>
              <label>
                <span>卡片顏色</span>
                <div className="color-field">
                  <input
                    type="color"
                    value={draft.accent}
                    onChange={(event) => setDraft({ ...draft, accent: event.target.value })}
                  />
                  <code>{draft.accent}</code>
                </div>
              </label>
            </div>
            <label>
              <span>專案類型</span>
              <select
                value={draft.categoryId}
                onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
              >
                {categories.map((category) => (
                  <option value={category.id} key={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>標籤，以逗號分隔</span>
              <input
                value={draft.tags.join(', ')}
                onChange={(event) => setDraft({
                  ...draft,
                  tags: event.target.value.split(',')
                })}
                placeholder="React, Vite, Game"
              />
            </label>
          </section>

          <section className="form-section">
            <h3>啟動方式</h3>
            <label>
              <span>啟動命令</span>
              <input
                list={`commands-${draft.id}`}
                value={draft.command}
                onChange={(event) => setDraft({ ...draft, command: event.target.value })}
                placeholder="npm run dev"
              />
              <datalist id={`commands-${draft.id}`}>
                {draft.availableCommands.map((command) => <option value={command} key={command} />)}
              </datalist>
            </label>
            {draft.secondaryCommands.length > 0 && (
              <details className="secondary-command-group">
                <summary>其他腳本（次要） · {draft.secondaryCommands.length}</summary>
                <div className="secondary-command-list">
                  {draft.secondaryCommands.map((command) => (
                    <div className="secondary-command-item" key={command}>
                      <code>{command}</code>
                      <button type="button" className="small-button" onClick={() => promoteCommand(command)}>
                        設為主要
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
            <label>
              <span>瀏覽器</span>
              <select
                value={draft.browser}
                onChange={(event) => setDraft({
                  ...draft,
                  browser: event.target.value as ProjectRecord['browser']
                })}
              >
                <option value="inherit">
                  跟隨 RepoDesk 預設（{defaultBrowser === 'edge' ? 'Microsoft Edge' : 'Google Chrome'}）
                </option>
                <option value="edge">Microsoft Edge</option>
                <option value="chrome">Google Chrome</option>
              </select>
              <small>只影響這個專案；選擇跟隨預設時會使用偏好設定中的瀏覽器。</small>
            </label>
            <label>
              <span>開啟網址（可自訂）</span>
              <input
                value={draft.customUrl}
                onChange={(event) => {
                  setUrlError('')
                  setDraft({ ...draft, customUrl: event.target.value })
                }}
                placeholder="localhost:3000 或 https://example.com"
              />
              <small>{urlError || '留白時會從終端輸出自動偵測；儲存後可從卡片直接開啟。'}</small>
            </label>
          </section>

          <section className="form-section">
            <h3>快速開啟</h3>
            <div className="tool-grid">
              <button type="button" onClick={onOpenFolder}><FolderOpen size={17} />檔案總管</button>
              <button type="button" onClick={onOpenTerminal}><TerminalSquare size={17} />PowerShell</button>
              <button type="button" onClick={onOpenEditor}><Code2 size={17} />Visual Studio Code</button>
              <button type="button" onClick={() => void copyValue(draft.path, 'path')}>
                <Copy size={17} />{copiedValue === 'path' ? '已複製路徑' : '複製路徑'}
              </button>
            </div>
            <div className="path-box" title={draft.path}>{draft.path}</div>
          </section>

          <section className="form-section danger-zone">
            <h3>從 RepoDesk 移除</h3>
            <p>只會移除這筆紀錄，不會刪除電腦中的專案資料夾。</p>
            <button type="button" className="danger-button" onClick={() => void onRemove()}>
              <Trash2 size={16} />
              移除專案
            </button>
          </section>
        </div>

        <div className="drawer-footer">
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          <button type="button" className="save-button" onClick={() => void save()} disabled={saving || !draft.name.trim()}>
            <Save size={16} />
            {saving ? '儲存中' : '儲存變更'}
          </button>
        </div>
      </aside>
    </div>
  )
}
