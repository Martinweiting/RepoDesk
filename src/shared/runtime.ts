const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -\/]*[@-~]/g
const LOCAL_URL_PATTERN = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:\/[^\s]*)?/i

export function normalizeProjectUrl(value: string): string {
  let candidate = value.trim().replace(/[),.;]+$/, '')
  if (!candidate) return ''
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(candidate)) {
    if (/^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:\/.*)?$/i.test(candidate)) {
      candidate = `http://${candidate}`
    } else {
      return ''
    }
  }

  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    if (url.hostname === '0.0.0.0') url.hostname = 'localhost'
    if (!url.pathname) url.pathname = '/'
    return url.toString()
  } catch {
    return ''
  }
}

export function detectDevelopmentUrl(text: string): string {
  const match = text.replace(ANSI_ESCAPE_PATTERN, '').match(LOCAL_URL_PATTERN)
  return match ? normalizeProjectUrl(match[0]) : ''
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
  // Avoid accepting a split `127.0.0.1` before its port arrives, while still
  // handling common one-chunk output such as `http://localhost:5173`.
  if (/(?:https?:\/\/[^\s]+:\d+(?:\/[^\s]*)?|https?:\/\/[^\s]+\/[^\s]*)$/i.test(nextRemainder)) {
    const url = detectDevelopmentUrl(nextRemainder)
    if (url) return { remainder: '', url }
  }
  return { remainder: nextRemainder, url: '' }
}
