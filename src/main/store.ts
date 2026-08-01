import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, normalize } from 'node:path'
import type {
  PersistedState,
  ProjectRecord,
  ScanHistoryEntry,
  ScanResult,
  UserSettings
} from '../shared/types'
import { discoverProjects, partitionLaunchCommands } from '../shared/scanner'
import { normalizeProjectUrl } from '../shared/runtime'
import {
  DEFAULT_PROJECT_CATEGORIES,
  inferCategoryId,
  randomProjectIcon
} from '../shared/visuals'

const DEFAULT_SETTINGS: UserSettings = {
  defaultBrowser: 'edge',
  autoOpenBrowser: true,
  launchAtLogin: false,
  theme: 'dark',
  scanDepth: 4,
  cardDisplayMode: 'icon',
  cardSize: 'medium',
  cardColumns: 3,
  categories: DEFAULT_PROJECT_CATEGORIES
}

const DEFAULT_STATE: PersistedState = {
  version: 5,
  projects: [],
  settings: DEFAULT_SETTINGS,
  scanHistory: []
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function pathKey(filePath: string): string {
  return normalize(filePath).toLocaleLowerCase('en-US')
}

function normalizeCategories(settings: Partial<UserSettings>): UserSettings['categories'] {
  const hasSuppliedCategories = Array.isArray(settings.categories)
  const supplied = Array.isArray(settings.categories) ? settings.categories : []
  const unique = supplied
    .filter((category) => category?.id && category?.name && category?.color)
    .filter((category, index, categories) =>
      categories.findIndex((candidate) => candidate.id === category.id) === index
    )
    .map((category) => ({ ...category }))

  if (!unique.some((category) => category.id === 'uncategorized')) {
    unique.push(structuredClone(DEFAULT_PROJECT_CATEGORIES.find((category) =>
      category.id === 'uncategorized'
    )!))
  }
  return hasSuppliedCategories ? unique : structuredClone(DEFAULT_PROJECT_CATEGORIES)
}

function migrateProject(project: ProjectRecord): ProjectRecord {
  const tags = Array.isArray(project.tags) ? project.tags : []
  const commands = Array.isArray(project.availableCommands) ? project.availableCommands : []
  const commandGroups = partitionLaunchCommands(commands)
  const migratedPrimaryCommands = project.command && !commandGroups.primary.includes(project.command)
    ? [project.command, ...commandGroups.primary]
    : commandGroups.primary
  return {
    ...project,
    folderName: project.folderName || basename(project.path),
    sourceRoot: project.sourceRoot || '',
    tags,
    iconId: project.iconId || randomProjectIcon(),
    customIconDataUrl: project.customIconDataUrl || '',
    previewImageDataUrl: project.previewImageDataUrl || '',
    categoryId: project.categoryId || inferCategoryId(tags),
    githubUrl: project.githubUrl || '',
    availableCommands: migratedPrimaryCommands,
    secondaryCommands: [...new Set([
      ...(Array.isArray(project.secondaryCommands) ? project.secondaryCommands : []),
      ...commandGroups.secondary
    ])].filter((command) => command !== project.command),
    customUrl: project.customUrl ? normalizeProjectUrl(project.customUrl) : ''
  }
}

function normalizeScanHistory(value: unknown): ScanHistoryEntry[] {
  if (!Array.isArray(value)) return []
  const unique = new Set<string>()
  return value
    .filter((entry): entry is ScanHistoryEntry =>
      Boolean(
        entry
        && typeof entry.path === 'string'
        && typeof entry.scannedAt === 'string'
        && typeof entry.discovered === 'number'
      )
    )
    .filter((entry) => {
      const key = pathKey(entry.path)
      if (unique.has(key)) return false
      unique.add(key)
      return true
    })
    .slice(0, 5)
    .map((entry) => ({ ...entry, path: normalize(entry.path) }))
}

export class RepoDeskStore {
  private state: PersistedState = structuredClone(DEFAULT_STATE)

  constructor(private readonly filePath: string) {}

  async initialize(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<PersistedState>
      this.state = {
        version: 5,
        projects: Array.isArray(parsed.projects) ? parsed.projects.map(migrateProject) : [],
        settings: {
          defaultBrowser: parsed.settings?.defaultBrowser === 'chrome' ? 'chrome' : 'edge',
          autoOpenBrowser: parsed.settings?.autoOpenBrowser !== false,
          launchAtLogin: parsed.settings?.launchAtLogin === true,
          theme: parsed.settings?.theme === 'light' ? 'light' : 'dark',
          scanDepth: Math.max(1, Math.min(8, parsed.settings?.scanDepth ?? 4)),
          cardDisplayMode: parsed.settings?.cardDisplayMode === 'preview' ? 'preview' : 'icon',
          cardSize: parsed.settings?.cardSize === 'small' || parsed.settings?.cardSize === 'large'
            ? parsed.settings.cardSize
            : 'medium',
          cardColumns: parsed.settings?.cardColumns === 2 || parsed.settings?.cardColumns === 4
            ? parsed.settings.cardColumns
            : 3,
          categories: normalizeCategories(parsed.settings ?? {})
        },
        scanHistory: normalizeScanHistory(parsed.scanHistory)
      }
    } catch {
      this.state = structuredClone(DEFAULT_STATE)
    }
    await this.refreshMissingFlags()
    await this.save()
  }

  getState(): PersistedState {
    return structuredClone(this.state)
  }

  getProject(projectId: string): ProjectRecord | undefined {
    return this.state.projects.find((project) => project.id === projectId)
  }

  async addProject(project: ProjectRecord): Promise<PersistedState> {
    const key = pathKey(project.path)
    const existing = this.state.projects.find((candidate) => pathKey(candidate.path) === key)
    if (!existing) {
      this.state.projects.unshift(project)
      await this.save()
    }
    return this.getState()
  }

  async updateProject(project: ProjectRecord): Promise<PersistedState> {
    const index = this.state.projects.findIndex((candidate) => candidate.id === project.id)
    if (index < 0) throw new Error('找不到要更新的專案。')
    this.state.projects[index] = {
      ...project,
      folderName: project.folderName || basename(project.path),
      sourceRoot: project.sourceRoot || '',
      customUrl: project.customUrl ? normalizeProjectUrl(project.customUrl) : '',
      availableCommands: [...new Set(project.availableCommands ?? [])],
      secondaryCommands: [...new Set(project.secondaryCommands ?? [])]
        .filter((command) => command !== project.command),
      updatedAt: new Date().toISOString()
    }
    await this.save()
    return this.getState()
  }

  async touchProject(projectId: string): Promise<void> {
    const project = this.getProject(projectId)
    if (!project) return
    project.lastOpenedAt = new Date().toISOString()
    project.updatedAt = project.lastOpenedAt
    await this.save()
  }

  async removeProject(projectId: string): Promise<PersistedState> {
    return this.removeProjects([projectId])
  }

  async removeProjects(projectIds: string[]): Promise<PersistedState> {
    const selectedIds = new Set(projectIds)
    this.state.projects = this.state.projects.filter((project) => !selectedIds.has(project.id))
    await this.save()
    return this.getState()
  }

  async clearProjects(): Promise<PersistedState> {
    this.state.projects = []
    await this.save()
    return this.getState()
  }

  async updateSettings(settings: UserSettings): Promise<PersistedState> {
    const categories = normalizeCategories(settings)
    const categoryIds = new Set(categories.map((category) => category.id))
    this.state.settings = {
      defaultBrowser: settings.defaultBrowser,
      autoOpenBrowser: settings.autoOpenBrowser,
      launchAtLogin: settings.launchAtLogin === true,
      theme: settings.theme === 'light' ? 'light' : 'dark',
      scanDepth: Math.max(1, Math.min(8, settings.scanDepth)),
      cardDisplayMode: settings.cardDisplayMode === 'preview' ? 'preview' : 'icon',
      cardSize: settings.cardSize === 'small' || settings.cardSize === 'large'
        ? settings.cardSize
        : 'medium',
      cardColumns: settings.cardColumns === 2 || settings.cardColumns === 4
        ? settings.cardColumns
        : 3,
      categories
    }
    this.state.projects.forEach((project) => {
      if (!categoryIds.has(project.categoryId)) project.categoryId = 'uncategorized'
    })
    await this.save()
    return this.getState()
  }

  async scanRoot(root: string): Promise<ScanResult> {
    const normalizedRoot = normalize(root)
    const projects = await discoverProjects(normalizedRoot, this.state.settings.scanDepth)
    const categoryIds = new Set(this.state.settings.categories.map((category) => category.id))
    const existingByPath = new Map(
      this.state.projects.map((project) => [pathKey(project.path), project])
    )
    let added = 0
    let updated = 0

    for (const discovered of projects) {
      discovered.sourceRoot = normalizedRoot
      if (!categoryIds.has(discovered.categoryId)) discovered.categoryId = 'uncategorized'
      const existing = existingByPath.get(pathKey(discovered.path))
      if (existing) {
        existing.availableCommands = [...new Set([
          ...discovered.availableCommands,
          ...(existing.command ? [existing.command] : [])
        ])]
        existing.secondaryCommands = discovered.secondaryCommands
          .filter((command) => command !== existing.command)
        existing.folderName = discovered.folderName
        existing.sourceRoot = normalizedRoot
        existing.githubUrl = discovered.githubUrl
        existing.missing = false
        if (!existing.tags.length) existing.tags = discovered.tags
        if (!existing.command) existing.command = discovered.command
        updated += 1
      } else {
        this.state.projects.push(discovered)
        existingByPath.set(pathKey(discovered.path), discovered)
        added += 1
      }
    }

    this.state.scanHistory = [
      {
        path: normalizedRoot,
        scannedAt: new Date().toISOString(),
        discovered: projects.length
      },
      ...this.state.scanHistory.filter((entry) => pathKey(entry.path) !== pathKey(normalizedRoot))
    ].slice(0, 5)
    await this.refreshMissingFlags()
    await this.save()
    return {
      root: normalizedRoot,
      discovered: projects.length,
      added,
      updated,
      state: this.getState()
    }
  }

  private async refreshMissingFlags(): Promise<void> {
    await Promise.all(this.state.projects.map(async (project) => {
      project.missing = !(await pathExists(project.path))
    }))
  }

  private async save(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8')
  }
}
