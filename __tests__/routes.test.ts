import { describe, it, expect } from 'vitest'
import plugin from '../src/plugin'

// Get all route paths for quick helper
const paths = plugin.routes?.map((r) => r.path) ?? []

describe('Alioth Plugin Routes', () => {
  it('should expose REST API endpoints', () => {
    expect(plugin.routes).toBeDefined()
    expect(Array.isArray(plugin.routes)).toBe(true)
    expect(plugin.routes!.length).toBeGreaterThan(0)
  })

  it('should include primary v1 API paths', () => {
    const expected = [
      '/api/v1/yield-analysis',
      '/api/v1/portfolio-optimization',
      '/api/v1/risk-analysis',
      '/api/v1/direct-deposit-optimization',
    ]
    expected.forEach((p) => expect(paths).toContain(p))
  })

  it('each route should have a valid structure', () => {
    plugin.routes!.forEach((route) => {
      expect(typeof route.path).toBe('string')
      expect(route.path.startsWith('/')).toBe(true)
      expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).toContain(route.type)
      expect(typeof route.handler).toBe('function')
    })
  })

  it('paths should be unique', () => {
    const unique = new Set(paths)
    expect(unique.size).toBe(paths.length)
  })
})
