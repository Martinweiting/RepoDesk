import { createHash, randomUUID } from 'node:crypto'
import { access, readFile, readdir } from 'node:fs/promises'
import { basename, join, normalize } from 'node:path'
import type { ProjectRecord } from './types'
import { inferCategoryId, randomProjectIcon } from './visuals'

const MARKERS = new Set([
  'package.json',
  'project.godot',
  'pyproject.toml',
  'Cargo.toml'
])

const SKIP_DIRECTORIES = new Set([
  '.git',
  '.claude',
  '.codex',
  '.idea',
  '.next',
  '.nuxt',
  '.output',
  '.turbo',
  '.vercel',
  '.vscode',
  '.worktrees',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'release',
  'target',
  'vendor'
])

const ACCENTS = [
  '#7c6cff',
  '#16b8a6',
  '#f26b8a',
  '#5b9cf6',
  '#e09a3e',
  '#9f72e7',
  '#57a867'
]

interface PackageJson {
  name?: string
  description?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  repository?: string | { url?: string }
}

export function normalizeGitHubUrl(value: string | undefined): string {
  if (!value) return ''
  const trimmed = value.trim().replace(/^git\+/, '')
  const match = trimmed.match(/github\.com(?::|\/)([^/\s:]+)\/([^/\s#?]+)/i)
  if (!match) return ''
  const owner = match[1]
  const repository = match[2].replace(/\.git$/i, '')
  if (!owner || !repository) return ''
  return `https://github.com/${owner}/${repository}`
}

async function githubUrlFromProject(projectPath: string, pkg: PackageJson | null): Promise<string> {
  try {
    const config = await readFile(join(projectPath, '.git', 'config'), 'utf8')
    const originSection = config.match(/\[remote\s+"origin"\]([\s\S]*?)(?=\r?\n\[|$)/i)?.[1] ?? ''
    const remoteUrl = originSection.match(/^\s*url\s*=\s*(.+)\s*$/im)?.[1]
    const normalizedRemote = normalizeGitHubUrl(remoteUrl)
    if (normalizedRemote) return normalizedRemote
  } catch {
    // Projects without a normal .git/config can still declare package repository metadata.
  }

  const repository = typeof pkg?.repository === 'string'
    ? pkg.repository
    : pkg?.repository?.url
  return normalizeGitHubUrl(repository)
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function titleFromFolder(folder: string): string {
  return folder
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function accentFromPath(projectPath: string): string {
  const digest = createHash('sha1').update(projectPath.toLowerCase()).digest()
  return ACCENTS[digest[0] % ACCENTS.length]
}

function inferTags(pkg: PackageJson | null, markerNames: Set<string>): string[] {
  const tags = new Set<string>()
  const dependencies = { ...pkg?.dependencies, ...pkg?.devDependencies }

  if ('electron' in dependencies) tags.add('Electron')
  if ('next' in dependencies) tags.add('Next.js')
  if ('react' in dependencies) tags.add('React')
  if ('vue' in dependencies) tags.add('Vue')
  if ('svelte' in dependencies) tags.add('Svelte')
  if ('vite' in dependencies) tags.add('Vite')
  if (['openai', '@google/generative-ai', 'ai'].some((name) => name in dependencies)) tags.add('AI')
  if (/\bgame\b|遊戲/i.test(`${pkg?.name ?? ''} ${pkg?.description ?? ''}`)) tags.add('Game')
  if (markerNames.has('project.godot')) tags.add('Godot')
  if (markerNames.has('pyproject.toml')) tags.add('Python')
  if (markerNames.has('Cargo.toml')) tags.add('Rust')
  if (pkg && tags.size === 0) tags.add('Node.js')

  return [...tags].slice(0, 5)
}

function commandsFromPackage(pkg: PackageJson | null): string[] {
  if (!pkg?.scripts) return []
  const preference = ['dev', 'start', 'serve', 'preview']
  const ordered = [
    ...preference.filter((script) => script in (pkg.scripts ?? {})),
    ...Object.keys(pkg.scripts).filter((script) => !preference.includes(script))
  ]
  return ordered.slice(0, 12).map((script) => `npm run ${script}`)
}

function defaultCommandFromPackage(pkg: PackageJson | null): string {
  if (!pkg?.scripts) return ''
  const script = ['dev', 'start', 'serve', 'preview'].find((name) => name in pkg.scripts!)
  return script ? `npm run ${script}` : ''
}

export async function inspectProject(projectPath: string): Promise<ProjectRecord> {
  const entries = await readdir(projectPath, { withFileTypes: true })
  const fileNames = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name))
  let pkg: PackageJson | null = null

  if (fileNames.has('package.json')) {
    try {
      pkg = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf8')) as PackageJson
    } catch {
      pkg = null
    }
  }

  let availableCommands = commandsFromPackage(pkg)
  let defaultCommand = defaultCommandFromPackage(pkg)
  if (fileNames.has('project.godot')) availableCommands = ['godot --editor', ...availableCommands]
  if (fileNames.has('pyproject.toml') && await exists(join(projectPath, 'app.py'))) {
    availableCommands = ['python app.py', ...availableCommands]
  }
  if (fileNames.has('Cargo.toml')) availableCommands = ['cargo run', ...availableCommands]
  if (fileNames.has('project.godot')) defaultCommand = 'godot --editor'
  if (fileNames.has('pyproject.toml') && await exists(join(projectPath, 'app.py'))) {
    defaultCommand = 'python app.py'
  }
  if (fileNames.has('Cargo.toml')) defaultCommand = 'cargo run'

  const now = new Date().toISOString()
  const normalizedPath = normalize(projectPath)
  const tags = inferTags(pkg, fileNames)
  const githubUrl = await githubUrlFromProject(projectPath, pkg)
  return {
    id: randomUUID(),
    path: normalizedPath,
    name: pkg?.name ? titleFromFolder(pkg.name) : titleFromFolder(basename(normalizedPath)),
    description: pkg?.description?.trim() || '尚未填寫專案介紹。',
    tags,
    status: 'active',
    favorite: false,
    accent: accentFromPath(normalizedPath),
    iconId: randomProjectIcon(),
    customIconDataUrl: '',
    previewImageDataUrl: '',
    categoryId: inferCategoryId(tags),
    command: defaultCommand,
    browser: 'inherit',
    customUrl: '',
    githubUrl,
    availableCommands,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
    missing: false
  }
}

export async function discoverProjects(root: string, maxDepth: number): Promise<ProjectRecord[]> {
  const found: ProjectRecord[] = []

  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > maxDepth) return

    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      return
    }

    const fileNames = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name))
    const isProject = [...MARKERS].some((marker) => fileNames.has(marker))
      || entries.some((entry) => entry.isFile() && entry.name.endsWith('.sln'))

    if (isProject) {
      try {
        const project = await inspectProject(directory)
        if (entries.some((entry) => entry.isFile() && entry.name.endsWith('.sln'))) {
          project.tags = project.tags.length ? project.tags : ['.NET']
          project.availableCommands = project.availableCommands.length
            ? project.availableCommands
            : ['dotnet run']
          project.command ||= 'dotnet run'
          project.categoryId = 'tools'
        }
        found.push(project)
      } catch {
        // A malformed project should not stop the rest of the scan.
      }
    }

    await Promise.all(entries
      .filter((entry) => entry.isDirectory() && !SKIP_DIRECTORIES.has(entry.name))
      .map((entry) => walk(join(directory, entry.name), depth + 1)))
  }

  await walk(normalize(root), 0)
  return found
}
