import {
  AppWindow,
  Bot,
  Boxes,
  Braces,
  Database,
  FolderCode,
  Gamepad2,
  Globe2,
  Palette,
  Rocket,
  Sparkles,
  TerminalSquare,
  type LucideIcon
} from 'lucide-react'

const iconComponents: Record<string, LucideIcon> = {
  'folder-code': FolderCode,
  'app-window': AppWindow,
  globe: Globe2,
  gamepad: Gamepad2,
  bot: Bot,
  terminal: TerminalSquare,
  database: Database,
  palette: Palette,
  boxes: Boxes,
  sparkles: Sparkles,
  rocket: Rocket,
  braces: Braces
}

export const PROJECT_ICON_LABELS: Record<string, string> = {
  'folder-code': '程式專案',
  'app-window': '應用程式',
  globe: '網站',
  gamepad: '遊戲',
  bot: 'AI',
  terminal: '開發工具',
  database: '資料服務',
  palette: '設計',
  boxes: '套件',
  sparkles: '創意',
  rocket: '產品',
  braces: '程式庫'
}

interface ProjectIconProps {
  iconId: string
  customIconDataUrl?: string
  size?: number
  strokeWidth?: number
}

export function ProjectIcon({
  iconId,
  customIconDataUrl,
  size = 20,
  strokeWidth = 1.9
}: ProjectIconProps) {
  if (customIconDataUrl) {
    return (
      <img
        className="custom-project-icon"
        src={customIconDataUrl}
        alt=""
        width={size}
        height={size}
      />
    )
  }

  const Icon = iconComponents[iconId] ?? FolderCode
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />
}
