import { describe, it, expect } from 'vitest'
import { configSchema, defaultConfig } from '../src/config/schema.js'

describe('Alioth Config Schema', () => {
  it('defaultConfig satisfies the zod schema', async () => {
    await expect(configSchema.parseAsync(defaultConfig)).resolves.toBeTruthy()
  })

  it('missing optional keys should still be valid', async () => {
    const minimal = {
      DEFAULT_SLIPPAGE: '0.5',
      MIN_YIELD_THRESHOLD: '5.0',
      MAX_RISK_SCORE: '7.0',
    }
    await expect(configSchema.parseAsync(minimal)).resolves.toBeTruthy()
  })

  it('invalid numeric strings are accepted as strings by schema', async () => {
    const bad = { DEFAULT_SLIPPAGE: 'not-a-number' }
    await expect(configSchema.parseAsync(bad)).resolves.toBeTruthy()
  })
})
