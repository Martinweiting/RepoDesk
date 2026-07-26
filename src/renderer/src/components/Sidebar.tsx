import {
  Archive,
  CirclePause,
  FolderKanban,
  LayoutGrid,
  PlayCircle,
  Settings2,
  Sparkles,
  Star,
  Tags
} from 'lucide-react'
import type { ProjectCategory, ProjectRecord, RuntimeState } from '../../../shared/types'

export type BaseFilterKey = 'all' | 'running' | 'favorites' | 'active' | 'paused' | 'complete'
export type FilterKey = BaseFilterKey | `category:${string}`

interface SidebarProps {
  projects: ProjectRecord[]
  categories: ProjectCategory[]
  runtimes: Record<string, RuntimeState>
  filter: FilterKey
  onFilterChange: (filter: FilterKey) => void
  onSettings: () => void
}

const items: Array<{
  key: BaseFilterKey
  label: string
  icon: typeof LayoutGrid
}> = [
  { key: 'all', label: '全部專案', icon: LayoutGrid },
  { key: 'running', label: '正在執行', icon: PlayCircle },
  { key: 'favorites', label: '我的最愛', icon: Star },
  { key: 'active', label: '開發中', icon: Sparkles },
  { key: 'paused', label: '暫停', icon: CirclePause },
  { key: 'complete', label: '已完成', icon: Archive }
]

export function Sidebar({
  projects,
  categories,
  runtimes,
  filter,
  onFilterChange,
  onSettings
}: SidebarProps) {
  function count(key: FilterKey): number {
    if (key.startsWith('category:')) {
      return projects.filter((project) => project.categoryId === key.slice('category:'.length)).length
    }
    if (key === 'all') return projects.length
    if (key === 'running') {
      return projects.filter((project) =>
        ['starting', 'running', 'stopping'].includes(runtimes[project.id]?.status)
      ).length
    }
    if (key === 'favorites') return projects.filter((project) => project.favorite).length
    return projects.filter((project) => project.status === key).length
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <FolderKanban size={20} strokeWidth={2.2} />
        </div>
        <div>
          <strong>RepoDesk</strong>
          <span>PROJECT CONTROL</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="專案篩選">
        <p className="nav-label">工作區</p>
        {items.slice(0, 3).map(({ key, label, icon: Icon }) => (
          <button
            type="button"
            className={filter === key ? 'nav-item active' : 'nav-item'}
            onClick={() => onFilterChange(key)}
            key={key}
          >
            <Icon size={17} />
            <span>{label}</span>
            <span className="nav-count">{count(key)}</span>
          </button>
        ))}

        <p className="nav-label section-label">專案狀態</p>
        {items.slice(3).map(({ key, label, icon: Icon }) => (
          <button
            type="button"
            className={filter === key ? 'nav-item active' : 'nav-item'}
            onClick={() => onFilterChange(key)}
            key={key}
          >
            <Icon size={17} />
            <span>{label}</span>
            <span className="nav-count">{count(key)}</span>
          </button>
        ))}

        <p className="nav-label section-label category-nav-label">專案類型</p>
        <div className="category-nav">
          {categories.map((category) => {
            const key: FilterKey = `category:${category.id}`
            return (
              <button
                type="button"
                className={filter === key ? 'nav-item category-nav-item active' : 'nav-item category-nav-item'}
                onClick={() => onFilterChange(key)}
                key={category.id}
              >
                <span className="category-dot" style={{ background: category.color }} />
                <span>{category.name}</span>
                <span className="nav-count">{count(key)}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="library-summary">
          <span className="library-icon"><Tags size={16} /></span>
          <div>
            <strong>{projects.length} 個專案</strong>
            <span>{categories.length} 種專案類型</span>
          </div>
        </div>
        <button type="button" className="nav-item settings-link" onClick={onSettings}>
          <Settings2 size={17} />
          <span>偏好設定</span>
        </button>
      </div>
    </aside>
  )
}
