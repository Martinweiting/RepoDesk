import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  accentFromPath,
  discoverProjects,
  inspectProject,
  normalizeGitHubUrl
} from './scanner'
import { inferCategoryId, PROJECT_ICON_IDS } from './visuals'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ))
})

describe('accentFromPath', () => {
  it('returns a stable accent for the same path', () => {
    expect(accentFromPath('Z:\\Projects\\Example')).toBe(accentFromPath('Z:\\Projects\\Example'))
  })

  it('ignores path casing when assigning an accent', () => {
    expect(accentFromPath('Z:\\Projects\\Example')).toBe(accentFromPath('z:\\projects\\example'))
  })
})

describe('project inspection', () => {
  it('detects npm scripts and framework tags', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'repodesk-project-'))
    temporaryDirectories.push(directory)
    await writeFile(join(directory, 'package.json'), JSON.stringify({
      name: 'sample-app',
      description: 'A sample project',
      scripts: { dev: 'vite', build: 'vite build' },
      dependencies: { react: '^19.0.0' },
      devDependencies: { vite: '^6.0.0' }
    }))

    const project = await inspectProject(directory)
    expect(project.command).toBe('npm run dev')
    expect(project.availableCommands).toContain('npm run build')
    expect(project.tags).toEqual(expect.arrayContaining(['React', 'Vite']))
    expect(project.description).toBe('A sample project')
    expect(PROJECT_ICON_IDS).toContain(project.iconId as (typeof PROJECT_ICON_IDS)[number])
    expect(project.categoryId).toBe('web')
  })

  it('does not mistake build or test scripts for a launch command', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'repodesk-non-launch-project-'))
    temporaryDirectories.push(directory)
    await writeFile(join(directory, 'package.json'), JSON.stringify({
      name: 'library-only',
      scripts: { build: 'tsc', test: 'vitest run', postinstall: 'node setup.js' }
    }))

    const project = await inspectProject(directory)
    expect(project.command).toBe('')
    expect(project.availableCommands).toEqual(expect.arrayContaining([
      'npm run build',
      'npm run test',
      'npm run postinstall'
    ]))
  })

  it('detects and normalizes a GitHub origin remote', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'repodesk-github-project-'))
    temporaryDirectories.push(directory)
    const { mkdir } = await import('node:fs/promises')
    await mkdir(join(directory, '.git'))
    await writeFile(join(directory, 'package.json'), JSON.stringify({
      name: 'github-project',
      scripts: { dev: 'vite' }
    }))
    await writeFile(join(directory, '.git', 'config'), [
      '[remote "origin"]',
      '  url = git@github.com:openai/example-project.git',
      '  fetch = +refs/heads/*:refs/remotes/origin/*'
    ].join('\n'))

    const project = await inspectProject(directory)
    expect(project.githubUrl).toBe('https://github.com/openai/example-project')
  })

  it('finds project markers below a selected scan root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'repodesk-root-'))
    temporaryDirectories.push(root)
    const projectDirectory = join(root, 'nested-app')
    const { mkdir } = await import('node:fs/promises')
    await mkdir(projectDirectory)
    await writeFile(join(projectDirectory, 'project.godot'), '[application]\nconfig/name="Demo"\n')

    const projects = await discoverProjects(root, 2)
    expect(projects).toHaveLength(1)
    expect(projects[0].tags).toContain('Godot')
    expect(projects[0].command).toBe('godot --editor')
  })
})

describe('project categories', () => {
  it('prioritizes game and AI project types', () => {
    expect(inferCategoryId(['React', 'Game'])).toBe('game')
    expect(inferCategoryId(['Python', 'AI'])).toBe('ai')
  })

  it('keeps unknown projects uncategorized', () => {
    expect(inferCategoryId(['Unknown Framework'])).toBe('uncategorized')
  })
})

describe('GitHub URL normalization', () => {
  it('supports HTTPS and SSH repository forms', () => {
    expect(normalizeGitHubUrl('https://github.com/openai/codex.git')).toBe(
      'https://github.com/openai/codex'
    )
    expect(normalizeGitHubUrl('ssh://git@github.com/openai/codex.git')).toBe(
      'https://github.com/openai/codex'
    )
  })
})
