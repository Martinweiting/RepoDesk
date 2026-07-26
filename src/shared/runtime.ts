export function detectDevelopmentUrl(text: string): string {
  const match = text.match(
    /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:\/[^\s]*)?/i
  )
  if (!match) return ''
  return match[0]
    .replace(/^https?:\/\/0\.0\.0\.0/i, (origin) => origin.replace('0.0.0.0', 'localhost'))
    .replace(/[),.;]+$/, '')
}

export interface DevelopmentOutputResult {
  remainder: string
  url: string
}

export function consumeDevelopmentOutput(
  remainder: string,
  chunk: string
): DevelopmentOutputResult {
  const combined = `${remainder}${chunk}`.slice(-8192)
  const lines = combined.split(/\r?\n/)
  const nextRemainder = lines.pop() ?? ''
  for (const line of lines) {
    const url = detectDevelopmentUrl(line)
    if (url) return { remainder: nextRemainder, url }
  }
  return { remainder: nextRemainder, url: '' }
}
