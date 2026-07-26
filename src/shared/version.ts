function versionParts(value: string): number[] {
  const normalized = value.trim().replace(/^v/i, '').split('-')[0]
  return normalized.split('.').map((part) => {
    const parsed = Number.parseInt(part, 10)
    return Number.isFinite(parsed) ? parsed : 0
  })
}

export function compareVersions(first: string, second: string): number {
  const firstParts = versionParts(first)
  const secondParts = versionParts(second)
  const length = Math.max(firstParts.length, secondParts.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (firstParts[index] ?? 0) - (secondParts[index] ?? 0)
    if (difference) return difference > 0 ? 1 : -1
  }
  return 0
}
