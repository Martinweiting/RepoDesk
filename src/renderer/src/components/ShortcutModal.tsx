import { useState, type DragEvent } from 'react'
import { FileDown, Link2, UploadCloud, X } from 'lucide-react'

interface ShortcutModalProps {
  onClose: () => void
  onAdd: (shortcutPath: string) => Promise<void>
}

function droppedPath(event: DragEvent<HTMLDivElement>): string {
  const file = event.dataTransfer.files[0] as (File & { path?: string }) | undefined
  if (file?.path) return file.path

  const uri = event.dataTransfer.getData('text/uri-list').split(/\r?\n/).find(Boolean)?.trim() ?? ''
  if (uri.toLocaleLowerCase().startsWith('file://')) {
    return decodeURIComponent(uri.replace(/^file:\/\//i, ''))
      .replace(/^\/([A-Za-z]:)/, '$1')
      .replaceAll('/', '\\')
  }
  return event.dataTransfer.getData('text/plain').trim()
}

export function ShortcutModal({ onClose, onAdd }: ShortcutModalProps) {
  const [shortcutPath, setShortcutPath] = useState('')
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setDragging(false)
    const nextPath = droppedPath(event)
    if (nextPath) setShortcutPath(nextPath)
  }

  async function submit(): Promise<void> {
    const value = shortcutPath.trim()
    if (!value) return
    setSaving(true)
    try {
      await onAdd(value)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="shortcut-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-icon"><Link2 size={20} /></div>
          <div>
            <span className="eyebrow">RepoDesk</span>
            <h2 id="shortcut-modal-title">直接新增捷徑</h2>
          </div>
          <button type="button" className="icon-button close-button" onClick={onClose} aria-label="關閉">
            <X size={20} />
          </button>
        </div>

        <div className="shortcut-modal-body">
          <p className="shortcut-intro">把 Windows 捷徑拖到下方框格，或貼上專案資料夾、程式捷徑的路徑。</p>
          <div
            className={`shortcut-dropzone${dragging ? ' dragging' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (event.currentTarget === event.target) setDragging(false)
            }}
            onDrop={handleDrop}
          >
            <span className="shortcut-drop-icon"><UploadCloud size={28} /></span>
            <strong>{dragging ? '放開以加入捷徑' : '拖曳捷徑到這裡'}</strong>
            <span>支援 .lnk、.url、.exe、.cmd、.bat、.ps1 或專案資料夾</span>
          </div>

          <label className="shortcut-path-field">
            <span><FileDown size={15} />捷徑或目標路徑</span>
            <input
              value={shortcutPath}
              onChange={(event) => setShortcutPath(event.target.value)}
              placeholder={'例如：C:\\Users\\Martin\\Desktop\\我的專案.lnk'}
              autoFocus
            />
          </label>
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          <button type="button" className="save-button" onClick={() => void submit()} disabled={saving || !shortcutPath.trim()}>
            <Link2 size={16} />
            {saving ? '加入中…' : '加入捷徑'}
          </button>
        </div>
      </section>
    </div>
  )
}
