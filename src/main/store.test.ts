import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { RepoDeskStore } from './store'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ))
})

async function createStore(): Promise<{ store: RepoDeskStore; filePath: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'repodesk-store-'))
  temporaryDirectories.push(directory)
  const filePath = join(directory, 'repodesk-data.json')
  return { store: new RepoDeskStore(filePath), filePath }
}

describe('RepoDeskStore defaults', () => {
  it('starts with a genuinely empty project library', async () => {
    const { store } = await createStore()
    await store.initialize()

    const state = store.getState()
    expect(state.projects).toEqual([])
    expect(state.scanHistory).toEqual([])
    expect(state.settings.launchAtLogin).toBe(false)
    expect(state.settings.theme).toBe('dark')
    expect('scanRoots' in state.settings).toBe(false)
  })

  it('drops scan paths saved by older versions', async () => {
    const { store, filePath } = await createStore()
    await writeFile(filePath, JSON.stringify({
      version: 2,
      projects: [],
      settings: {
        defaultBrowser: 'chrome',
        autoOpenBrowser: false,
        theme: 'light',
        scanRoots: ['Z:\\Private\\Projects'],
        scanDepth: 6,
        cardDisplayMode: 'preview'
      }
    }))

    await store.initialize()
    const state = store.getState()
    expect(state.settings.defaultBrowser).toBe('chrome')
    expect(state.settings.scanDepth).toBe(6)
    expect(state.settings.launchAtLogin).toBe(false)
    expect(state.settings.theme).toBe('light')
    expect('scanRoots' in state.settings).toBe(false)
  })

  it('keeps only the five most recent unique scan folders', async () => {
    const { store, filePath } = await createStore()
    await store.initialize()
    const roots: string[] = []
    for (let index = 0; index < 6; index += 1) {
      const root = await mkdtemp(join(tmpdir(), `repodesk-history-${index}-`))
      temporaryDirectories.push(root)
      roots.push(root)
      const projectPath = join(root, `sample-app-${index}`)
      await mkdir(projectPath)
      await writeFile(join(projectPath, 'package.json'), JSON.stringify({
        name: `sample-app-${index}`,
        scripts: { dev: 'vite' }
      }))
      await store.scanRoot(root)
    }
    await store.scanRoot(roots[2])

    const state = store.getState()
    const saved = JSON.parse(await readFile(filePath, 'utf8')) as {
      settings: Record<string, unknown>
      scanHistory: Array<{ path: string }>
    }
    expect(state.scanHistory).toHaveLength(5)
    expect(state.scanHistory[0].path).toBe(roots[2])
    expect(new Set(state.scanHistory.map((entry) => entry.path)).size).toBe(5)
    expect(saved.scanHistory).toHaveLength(5)
    expect(saved.settings).not.toHaveProperty('scanRoots')
  })

  it('removes list entries without touching any source project files', async () => {
    const { store } = await createStore()
    await store.initialize()
    const root = await mkdtemp(join(tmpdir(), 'repodesk-safe-clear-'))
    temporaryDirectories.push(root)
    const firstProject = join(root, 'first-project')
    const secondProject = join(root, 'second-project')
    await mkdir(firstProject)
    await mkdir(secondProject)
    await writeFile(join(firstProject, 'package.json'), JSON.stringify({
      name: 'first-project',
      scripts: { dev: 'vite' }
    }))
    await writeFile(join(secondProject, 'package.json'), JSON.stringify({
      name: 'second-project',
      scripts: { dev: 'vite' }
    }))
    await writeFile(join(firstProject, 'sentinel.txt'), 'must remain')
    await writeFile(join(secondProject, 'sentinel.txt'), 'must remain')
    await store.scanRoot(root)

    const firstId = store.getState().projects.find((project) =>
      project.path === firstProject)!.id
    await store.removeProjects([firstId])
    expect(await readFile(join(firstProject, 'sentinel.txt'), 'utf8')).toBe('must remain')
    expect(store.getState().projects).toHaveLength(1)

    await store.clearProjects()
    expect(await readFile(join(secondProject, 'sentinel.txt'), 'utf8')).toBe('must remain')
    expect(store.getState().projects).toEqual([])
    expect(store.getState().scanHistory).toHaveLength(1)
  })
})
