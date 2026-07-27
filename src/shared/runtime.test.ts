import { describe, expect, it } from 'vitest'
import { consumeDevelopmentOutput, detectDevelopmentUrl, normalizeProjectUrl } from './runtime'

describe('development URL detection', () => {
  it('detects a Vite-style local URL', () => {
    expect(detectDevelopmentUrl('  ➜  Local: http://localhost:5173/')).toBe(
      'http://localhost:5173/'
    )
  })

  it('normalizes an all-interfaces host for the browser', () => {
    expect(detectDevelopmentUrl('Listening at http://0.0.0.0:3000')).toBe(
      'http://localhost:3000/'
    )
  })

  it('waits for a complete output line before accepting a split host and port', () => {
    const first = consumeDevelopmentOutput('', '➜ Local: http://127.0.0.1')
    const second = consumeDevelopmentOutput(first.remainder, ':3000/\n')

    expect(first.url).toBe('')
    expect(second.url).toBe('http://127.0.0.1:3000/')
  })

  it('accepts a complete URL even when the process has not flushed a newline', () => {
    expect(consumeDevelopmentOutput('', 'Local: http://127.0.0.1:3000').url).toBe(
      'http://127.0.0.1:3000/'
    )
  })

  it('does not open unrelated public links printed by a command', () => {
    expect(detectDevelopmentUrl('Documentation: https://example.com/start')).toBe('')
  })

  it('normalizes a user-entered local address without a protocol', () => {
    expect(normalizeProjectUrl('localhost:4173')).toBe('http://localhost:4173/')
    expect(normalizeProjectUrl('http://0.0.0.0:3000')).toBe('http://localhost:3000/')
    expect(normalizeProjectUrl('https://example.com/app')).toBe('https://example.com/app')
    expect(normalizeProjectUrl('ftp://example.com/file')).toBe('')
  })
})
