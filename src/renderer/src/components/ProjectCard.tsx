import {
  AlertTriangle,
  AppWindow,
  Check,
  ExternalLink,
  FolderOpen,
  Github,
  MoreHorizontal,
  Play,
  Square,
  Star,
  TerminalSquare
} from 'lucide-react'
import type {
  CardDisplayMode,
  ProjectCategory,
  ProjectRecord,
  RuntimeState
} from '../../../shared/types'
import { ProjectIcon } from './ProjectIcon'

interface ProjectCardProps {
  project: ProjectRecord
  category?: ProjectCategory
  displayMode: CardDisplayMode
  runtime: RuntimeState
  onEdit: () => void
  onStart: () => void
  onStop: () => void
  onOpenUrl: () => void
  onOpenFolder: () => void
  onOpenTerminal: () => void
  onShowLogs: () => void
  onToggleFavorite: () => void
  onOpenGithub: () => void
  selectionMode: boolean
  selected: boolean
  onSelectionChange: () => void
}

const statusLabels = {
  active: '開發中',
  paused: '暫停',
  complete: '已完成'
}

export function ProjectCard({
  project,
  category,
  displayMode,
  runtime,
  onEdit,
  onStart,
  onStop,
  onOpenUrl,
  onOpenFolder,
  onOpenTerminal,
  onShowLogs,
  onToggleFavorite,
  onOpenGithub,
  selectionMode,
  selected,
  onSelectionChange
}: ProjectCardProps) {
  const isBusy = runtime.status === 'starting' || runtime.status === 'stopping'
  const isRunning = runtime.status === 'running'
  const hasError = runtime.status === 'error'
  const stateBadge = isRunning ? (
    <span className="runtime-pill running"><i />執行中</span>
  ) : isBusy ? (
    <span className="runtime-pill busy"><i />{runtime.status === 'starting' ? '啟動中' : '停止中'}</span>
  ) : hasError ? (
    <span className="runtime-pill error"><AlertTriangle size={12} />啟動失敗</span>
  ) : (
    <span className="project-status">{statusLabels[project.status]}</span>
  )

  return (
    <article
      className={[
        'project-card',
        displayMode === 'preview' ? 'preview-mode' : 'icon-mode',
        isRunning ? 'is-running' : '',
        project.missing ? 'is-missing' : '',
        selectionMode ? 'selection-mode' : '',
        selected ? 'selected-for-removal' : ''
      ].filter(Boolean).join(' ')}
      style={{ '--project-accent': project.accent } as React.CSSProperties}
    >
      <div className="project-accent" />
      {selectionMode && (
        <label className="card-selection">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelectionChange}
            aria-label={`選取 ${project.name}`}
          />
          <span aria-hidden="true"><Check size={15} strokeWidth={3} /></span>
        </label>
      )}

      {displayMode === 'preview' ? (
        <div className="project-preview">
          <button type="button" className="preview-media" onClick={onEdit} aria-label={`編輯 ${project.name}`}>
            {project.previewImageDataUrl ? (
              <img src={project.previewImageDataUrl} alt={`${project.name} 預覽圖`} />
            ) : (
              <span className="preview-fallback">
                <ProjectIcon
                  iconId={project.iconId}
                  customIconDataUrl={project.customIconDataUrl}
                  size={42}
                  strokeWidth={1.5}
                />
                <small>尚未加入預覽圖</small>
              </span>
            )}
            <span className="preview-shade" />
            <span className="preview-icon-chip">
              <ProjectIcon
                iconId={project.iconId}
                customIconDataUrl={project.customIconDataUrl}
                size={17}
              />
            </span>
          </button>
          <div className="preview-state">
            {stateBadge}
            <button
              type="button"
              className={`icon-button favorite-button ${project.favorite ? 'selected' : ''}`}
              aria-label={project.favorite ? '取消最愛' : '加入最愛'}
              aria-pressed={project.favorite}
              onClick={onToggleFavorite}
            >
              <Star size={17} fill={project.favorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      ) : (
        <div className="project-card-head">
          <button
            type="button"
            className="project-avatar"
            onClick={onEdit}
            aria-label={`編輯 ${project.name}`}
          >
            <ProjectIcon
              iconId={project.iconId}
              customIconDataUrl={project.customIconDataUrl}
              size={19}
            />
          </button>
          <div className="project-state">
            {stateBadge}
            <button
              type="button"
              className={`icon-button favorite-button ${project.favorite ? 'selected' : ''}`}
              aria-label={project.favorite ? '取消最愛' : '加入最愛'}
              aria-pressed={project.favorite}
              onClick={onToggleFavorite}
            >
              <Star size={17} fill={project.favorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      )}

      <button type="button" className="project-copy" onClick={onEdit}>
        <h3>{project.name}</h3>
        <p>{project.missing ? '找不到專案資料夾，請確認路徑是否已變更。' : project.description}</p>
      </button>

      <div className="tag-row">
        {category && (
          <span
            className="category-tag"
            style={{ '--category-color': category.color } as React.CSSProperties}
          >
            <i />
            {category.name}
          </span>
        )}
        {project.tags.slice(0, category ? 2 : 3).map((tag) => <span key={tag}>{tag}</span>)}
        {!project.tags.length && !category && <span>未分類</span>}
      </div>

      {project.githubUrl && (
        <button
          type="button"
          className="project-github-link"
          onClick={onOpenGithub}
          title={project.githubUrl}
        >
          <Github size={16} />
          <span>{project.githubUrl.replace(/^https:\/\//, '')}</span>
          <ExternalLink size={14} />
        </button>
      )}

      <button type="button" className="project-command" onClick={onShowLogs}>
        <TerminalSquare size={14} />
        <span>{project.command || '尚未設定啟動命令'}</span>
      </button>

      <div className="project-card-footer">
        {isRunning ? (
          <>
            {runtime.url || project.customUrl ? (
              <button type="button" className="primary-action open-action" onClick={onOpenUrl}>
                <ExternalLink size={16} />
                開啟網站
              </button>
            ) : (
              <span className="running-app-label">
                <AppWindow size={16} />
                應用程式執行中
              </span>
            )}
            <button type="button" className="stop-action" onClick={onStop} aria-label="停止專案">
              <Square size={15} fill="currentColor" />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="primary-action"
            onClick={onStart}
            disabled={isBusy || project.missing || !project.command}
          >
            <Play size={16} fill="currentColor" />
            {runtime.status === 'starting' ? '啟動中' : hasError ? '重新啟動' : '啟動專案'}
          </button>
        )}
        <div className="quick-actions">
          <button type="button" className="icon-button" onClick={onOpenFolder} aria-label="開啟資料夾">
            <FolderOpen size={17} />
          </button>
          <button type="button" className="icon-button" onClick={onOpenTerminal} aria-label="開啟 PowerShell">
            <TerminalSquare size={17} />
          </button>
          <button type="button" className="icon-button" onClick={onEdit} aria-label="更多設定">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>
    </article>
  )
}
