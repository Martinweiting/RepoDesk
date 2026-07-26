import { describe, expect, it } from 'vitest'
import { consumeDevelopmentOutput, detectDevelopmentUrl } from './runtime'

describe('development URL detection', () => {
  it('detects a Vite-style local URL', () => {
    expect(detectDevelopmentUrl('  ➜  Local: http://localhost:5173/')).toBe(
      'http://localhost:5173/'
    )
  })

  it('normalizes an all-interfaces host for the browser', () => {
    expect(detectDevelopmentUrl('Listening at http://0.0.0.0:3000')).toBe(
      'http://localhost:3000'
    )
  })

  it('waits for a complete output line before accepting a split host and port', () => {
    const first = consumeDevelopmentOutput('', '➜ Local: http://127.0.0.1')
    const second = consumeDevelopmentOutput(first.remainder, ':3000/\n')

    expect(first.url).toBe('')
    expect(second.url).toBe('http://127.0.0.1:3000/')
  })

  it('does not open unrelated public links printed by a command', () => {
    expect(detectDevelopmentUrl('Documentation: https://example.com/start')).toBe('')
  })
})
