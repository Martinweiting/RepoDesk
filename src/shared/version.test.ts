import { describe, expect, it } from 'vitest'
import { compareVersions } from './version'

describe('version comparison', () => {
  it('compares semantic version numbers numerically', () => {
    expect(compareVersions('0.3.0', '0.2.9')).toBe(1)
    expect(compareVersions('v1.10.0', '1.9.9')).toBe(1)
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0)
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
  })
})
