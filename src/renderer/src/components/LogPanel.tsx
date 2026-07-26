import { RotateCcw, TerminalSquare, X } from 'lucide-react'
import type { LogEntry, ProjectRecord, RuntimeState } from '../../../shared/types'

interface LogPanelProps {
  project: ProjectRecord
  runtime: RuntimeState
  logs: LogEntry[]
  onClose: () => void
  onRestart: () => void
}

export function LogPanel({ project, runtime, logs, onClose, onRestart }: LogPanelProps) {
  return (
    <section className="log-panel">
      <header>
        <div className="log-title">
          <TerminalSquare size={17} />
          <div>
            <strong>{project.name}</strong>
            <span>開發伺服器輸出</span>
          </div>
        </div>
        <div className="log-actions">
          <span className={`runtime-label ${runtime.status}`}>{runtime.status}</span>
          <button type="button" className="icon-button" onClick={onRestart} aria-label="重新啟動">
            <RotateCcw size={16} />
          </button>
          <button type="button" className="icon-button" onClick={onClose} aria-label="關閉日誌">
            <X size={18} />
          </button>
        </div>
      </header>
      <div className="console">
        {logs.length ? logs.map((entry, index) => (
          <div className={`console-line ${entry.stream}`} key={`${entry.timestamp}-${index}`}>
            <time>{new Date(entry.timestamp).toLocaleTimeString('zh-TW', { hour12: false })}</time>
            <span>{entry.message}</span>
          </div>
        )) : (
          <div className="console-empty">啟動專案後，終端輸出會顯示在這裡。</div>
        )}
      </div>
    </section>
  )
}
