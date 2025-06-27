import { describe, it, expect } from 'vitest'
import plugin from '../src/plugin'

const expectedEvents = [
  'MESSAGE_RECEIVED',
  'YIELD_OPPORTUNITY_DETECTED',
  'DEPOSIT_OPTIMIZED',
]

describe('Alioth Plugin Events', () => {
  it('should expose the expected event hooks', () => {
    const keys = Object.keys(plugin.events ?? {})
    expectedEvents.forEach((ev) => expect(keys).toContain(ev))
  })

  it('each event array should contain at least one handler function', () => {
    expectedEvents.forEach((ev) => {
      const handlers = plugin.events![ev]
      expect(Array.isArray(handlers)).toBe(true)
      expect(handlers.length).toBeGreaterThan(0)
      handlers.forEach((h) => expect(typeof h).toBe('function'))
    })
  })
})
