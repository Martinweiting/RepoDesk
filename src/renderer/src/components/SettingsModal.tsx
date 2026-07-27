import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Chrome,
  Download,
  Image,
  LayoutGrid,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Sun,
  Trash2,
  X
} from 'lucide-react'
import type {
  ProjectCategory,
  UserSettings,
  VersionCheckResult
} from '../../../shared/types'

interface SettingsModalProps {
  settings: UserSettings
  appVersion: string
  onClose: () => void
  onPreviewTheme: (theme: UserSettings['theme']) => void
  onSave: (settings: UserSettings) => Promise<void>
  onCheckVersion: () => Promise<VersionCheckResult>
  onOpenUpdatePage: () => Promise<void>
}

export function SettingsModal({
  settings,
  appVersion,
  onClose,
  onPreviewTheme,
  onSave,
  onCheckVersion,
  onOpenUpdatePage
}: SettingsModalProps) {
  const [draft, setDraft] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#7c6cff')
  const [checkingVersion, setCheckingVersion] = useState(false)
  const [versionResult, setVersionResult] = useState<VersionCheckResult | null>(null)
  const [versionError, setVersionError] = useState('')

  useEffect(() => setDraft(settings), [settings])

  function closeWithoutSaving(): void {
    onPreviewTheme(settings.theme)
    onClose()
  }

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await onSave(draft)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function updateCategory(categoryId: string, updates: Partial<ProjectCategory>): void {
    setDraft({
      ...draft,
      categories: draft.categories.map((category) =>
        category.id === categoryId ? { ...category, ...updates } : category
      )
    })
  }

  function addCategory(): void {
    const name = newCategoryName.trim()
    if (!name) return
    setDraft({
      ...draft,
      categories: [
        ...draft.categories,
        {
          id: `custom-${crypto.randomUUID()}`,
          name,
          color: newCategoryColor
        }
      ]
    })
    setNewCategoryName('')
  }

  function removeCategory(categoryId: string): void {
    setDraft({
      ...draft,
      categories: draft.categories.filter((category) => category.id !== categoryId)
    })
  }

  async function checkVersion(): Promise<void> {
    setCheckingVersion(true)
    setVersionError('')
    try {
      setVersionResult(await onCheckVersion())
    } catch (error) {
      setVersionResult(null)
      setVersionError(error instanceof Error ? error.message : String(error))
    } finally {
      setCheckingVersion(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={closeWithoutSaving}>
      <section
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-icon"><Settings2 size={20} /></div>
          <div>
            <span className="eyebrow">RepoDesk</span>
            <h2 id="settings-modal-title">偏好設定</h2>
          </div>
          <button type="button" className="icon-button close-button" onClick={closeWithoutSaving} aria-label="關閉">
            <X size={20} />
          </button>
        </div>

        <div className="settings-body">
          <section className="settings-section version-section">
            <div className="version-heading">
              <div>
                <h3>版本檢查</h3>
                <p>目前版本 v{appVersion || '—'}；檢查 GitHub 上的最新公開版本。</p>
              </div>
              <button
                type="button"
                className="small-button"
                onClick={() => void checkVersion()}
                disabled={checkingVersion}
              >
                <RefreshCw className={checkingVersion ? 'spin' : ''} size={16} />
                {checkingVersion ? '檢查中' : '檢查版本'}
              </button>
            </div>
            {versionResult && (
              <div className={`version-result ${versionResult.status}`}>
                <CheckCircle2 size={18} />
                <div>
                  <strong>{versionResult.status === 'update-available'
                    ? `發現新版本 v${versionResult.latestVersion}`
                    : `目前已是最新版 v${versionResult.currentVersion}`}</strong>
                  <span>{versionResult.source === 'github-release'
                    ? '資料來源：GitHub Releases'
                    : '目前尚無 Release，改由專案版本資訊確認'}</span>
                </div>
                {versionResult.status === 'update-available' && (
                  <button type="button" className="small-button" onClick={() => void onOpenUpdatePage()}>
                    <Download size={15} />
                    前往下載
                  </button>
                )}
              </div>
            )}
            {versionError && <p className="version-error" role="alert">{versionError}</p>}
          </section>

          <section className="settings-section">
            <h3>介面主題</h3>
            <p>預設使用深色模式；亮色模式會同步套用到首頁、卡片、抽屜與設定面板。</p>
            <div className="theme-options">
              <button
                type="button"
                className={draft.theme === 'dark' ? 'theme-option selected' : 'theme-option'}
                onClick={() => {
                  onPreviewTheme('dark')
                  setDraft({ ...draft, theme: 'dark' })
                }}
              >
                <Moon size={18} />
                <span><strong>深色模式</strong><small>適合長時間開發</small></span>
              </button>
              <button
                type="button"
                className={draft.theme === 'light' ? 'theme-option selected' : 'theme-option'}
                onClick={() => {
                  onPreviewTheme('light')
                  setDraft({ ...draft, theme: 'light' })
                }}
              >
                <Sun size={18} />
                <span><strong>亮色模式</strong><small>明亮清晰的工作區</small></span>
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>專案卡片顯示方式</h3>
            <p>這項設定會套用到整個工作區，專案的圖示與預覽圖資料都會保留。</p>
            <div className="display-mode-options">
              <button
                type="button"
                className={draft.cardDisplayMode === 'icon' ? 'display-mode-option selected' : 'display-mode-option'}
                onClick={() => setDraft({ ...draft, cardDisplayMode: 'icon' })}
              >
                <span className="display-mode-demo icon-demo">
                  <i /><i /><i />
                </span>
                <span>
                  <LayoutGrid size={16} />
                  <strong>圖示模式</strong>
                  <small>緊湊顯示更多專案</small>
                </span>
              </button>
              <button
                type="button"
                className={draft.cardDisplayMode === 'preview' ? 'display-mode-option selected' : 'display-mode-option'}
                onClick={() => setDraft({ ...draft, cardDisplayMode: 'preview' })}
              >
                <span className="display-mode-demo preview-demo">
                  <i /><i />
                </span>
                <span>
                  <Image size={16} />
                  <strong>預覽圖模式</strong>
                  <small>使用 16:9 專案封面</small>
                </span>
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>專案開啟方式</h3>
            <p>這是所有專案的預設值；每個專案仍可在自己的設定中覆寫。</p>
            <div className="browser-options">
              <button
                type="button"
                className={draft.defaultBrowser === 'edge' ? 'browser-option selected' : 'browser-option'}
                onClick={() => setDraft({ ...draft, defaultBrowser: 'edge' })}
              >
                <span className="edge-logo">e</span>
                <div><strong>Microsoft Edge</strong><small>Windows 預設推薦</small></div>
                <i />
              </button>
              <button
                type="button"
                className={draft.defaultBrowser === 'chrome' ? 'browser-option selected' : 'browser-option'}
                onClick={() => setDraft({ ...draft, defaultBrowser: 'chrome' })}
              >
                <span className="chrome-logo"><Chrome size={21} /></span>
                <div><strong>Google Chrome</strong><small>需要已安裝 Chrome</small></div>
                <i />
              </button>
            </div>
            <label className="switch-row">
              <div>
                <strong>啟動後自動開啟瀏覽器</strong>
                <span>偵測到 localhost 網址時直接開啟</span>
              </div>
              <input
                type="checkbox"
                checked={draft.autoOpenBrowser}
                onChange={(event) => setDraft({ ...draft, autoOpenBrowser: event.target.checked })}
              />
            </label>
            <label className="switch-row">
              <div>
                <strong>Windows 登入後自動啟動</strong>
                <span>開機登入 Windows 時自動開啟 RepoDesk，預設為關閉</span>
              </div>
              <input
                type="checkbox"
                checked={draft.launchAtLogin}
                onChange={(event) => setDraft({
                  ...draft,
                  launchAtLogin: event.target.checked
                })}
              />
            </label>
          </section>

          <section className="settings-section">
            <div className="section-heading-row">
              <div>
                <h3>專案類型</h3>
                <p>專案可以依類型篩選；刪除類型後，其中的專案會移到「未分類」。</p>
              </div>
            </div>
            <div className="category-editor-list">
              {draft.categories.map((category) => (
                <div className="category-editor-item" key={category.id}>
                  <input
                    type="color"
                    value={category.color}
                    onChange={(event) => updateCategory(category.id, { color: event.target.value })}
                    aria-label={`${category.name} 顏色`}
                  />
                  <input
                    value={category.name}
                    onChange={(event) => updateCategory(category.id, { name: event.target.value })}
                    disabled={category.locked}
                    aria-label="類型名稱"
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => removeCategory(category.id)}
                    disabled={category.locked}
                    aria-label={category.locked ? '保留類型不可刪除' : `刪除 ${category.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="new-category-row">
              <input
                type="color"
                value={newCategoryColor}
                onChange={(event) => setNewCategoryColor(event.target.value)}
                aria-label="新類型顏色"
              />
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addCategory()
                  }
                }}
                placeholder="輸入新的類型名稱"
              />
              <button type="button" className="small-button" onClick={addCategory} disabled={!newCategoryName.trim()}>
                <Plus size={15} />
                新增
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>掃描行為</h3>
            <p>每次按下「掃描資料夾」都會重新選擇位置，不會設定預設路徑；主畫面只保留最近五筆不重複的掃描歷史。</p>
            <label className="depth-field">
              <span>掃描資料夾深度</span>
              <input
                type="number"
                min={1}
                max={8}
                value={draft.scanDepth}
                onChange={(event) => setDraft({
                  ...draft,
                  scanDepth: Number(event.target.value)
                })}
              />
            </label>
          </section>
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={closeWithoutSaving}>取消</button>
          <button type="button" className="save-button" onClick={() => void save()} disabled={saving}>
            <Save size={16} />
            {saving ? '儲存中' : '儲存設定'}
          </button>
        </div>
      </section>
    </div>
  )
}
