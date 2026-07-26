import type { ProjectCategory } from './types'

export const PROJECT_ICON_IDS = [
  'folder-code',
  'app-window',
  'globe',
  'gamepad',
  'bot',
  'terminal',
  'database',
  'palette',
  'boxes',
  'sparkles',
  'rocket',
  'braces'
] as const

export const DEFAULT_PROJECT_CATEGORIES: ProjectCategory[] = [
  { id: 'web', name: '網站與 Web App', color: '#5b9cf6' },
  { id: 'desktop', name: '桌面應用程式', color: '#9f72e7' },
  { id: 'game', name: '遊戲', color: '#f26b8a' },
  { id: 'ai', name: 'AI 與自動化', color: '#16b8a6' },
  { id: 'tools', name: '工具與服務', color: '#e09a3e' },
  { id: 'library', name: '函式庫與套件', color: '#57a867' },
  { id: 'uncategorized', name: '未分類', color: '#747b8f', locked: true }
]

export function randomProjectIcon(): string {
  return PROJECT_ICON_IDS[Math.floor(Math.random() * PROJECT_ICON_IDS.length)]
}

export function inferCategoryId(tags: string[]): string {
  const normalized = new Set(tags.map((tag) => tag.toLocaleLowerCase('en-US')))
  if (normalized.has('game') || normalized.has('godot')) return 'game'
  if (normalized.has('ai')) return 'ai'
  if (normalized.has('electron') || normalized.has('windows')) return 'desktop'
  if (['react', 'next.js', 'vue', 'svelte', 'vite'].some((tag) => normalized.has(tag))) return 'web'
  if (['python', 'rust', '.net', 'node.js'].some((tag) => normalized.has(tag))) return 'tools'
  return 'uncategorized'
}
