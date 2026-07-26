import { readdir, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'

const releaseDirectory = resolve(process.cwd(), 'release')
const installerPattern = /^RepoDesk(?: Setup|-Setup)(?:(?: v|-v)\d+\.\d+\.\d+(?:[-+][^\\/]*)?)?\.exe(?:\.blockmap)?$/i

let entries = []
try {
  entries = await readdir(releaseDirectory, { withFileTypes: true })
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

const oldInstallers = entries.filter((entry) =>
  entry.isFile() && installerPattern.test(entry.name)
)

await Promise.all(oldInstallers.map((entry) =>
  unlink(resolve(releaseDirectory, entry.name))
))

if (oldInstallers.length) {
  console.log(`已移除 ${oldInstallers.length} 個舊安裝檔。`)
} else {
  console.log('沒有需要移除的舊安裝檔。')
}
