import { describe, expect, it } from 'vitest'
import { resolveDataSource } from './dataSource'

describe('the data source switch', () => {
  it('accepts demo and api', () => {
    expect(resolveDataSource('demo')).toBe('demo')
    expect(resolveDataSource('api')).toBe('api')
  })

  it('refuses a missing value, so the build cannot fall into the demo', () => {
    expect(() => resolveDataSource(undefined)).toThrow(/VITE_DATA_SOURCE/)
    expect(() => resolveDataSource('')).toThrow(/VITE_DATA_SOURCE/)
  })

  it('refuses any other value, whatever its case or spacing', () => {
    for (const value of ['production', 'Demo', 'API', ' demo', 'demo ', 'both']) {
      expect(() => resolveDataSource(value)).toThrow(/"demo" or "api"/)
    }
  })
})
