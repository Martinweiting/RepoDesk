import { FolderClock } from 'lucide-react'
import type { ScanHistoryEntry } from '../../../shared/types'

interface ScanHistoryPanelProps {
  entries: ScanHistoryEntry[]
}

function scanTime(value: string): string {
  return new Date(value).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function ScanHistoryPanel({ entries }: ScanHistoryPanelProps) {
  if (!entries.length) return null

  return (
    <section className="scan-history" aria-labelledby="scan-history-title">
      <div className="scan-history-heading">
        <FolderClock size={19} />
        <div>
          <h2 id="scan-history-title">最近掃描</h2>
          <p>只保留最近五個不重複的資料夾</p>
        </div>
      </div>
      <ol>
        {entries.map((entry) => (
          <li key={entry.path} title={entry.path}>
            <span className="scan-history-path">{entry.path}</span>
            <span>{entry.discovered} 個專案</span>
            <time dateTime={entry.scannedAt}>{scanTime(entry.scannedAt)}</time>
          </li>
        ))}
      </ol>
    </section>
  )
}
