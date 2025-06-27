import { describe, it, expect, vi } from 'vitest'
import plugin from '../src/plugin'
import { configSchema } from '../src/config/schema.js'

// Silence logger output during tests
vi.mock('@elizaos/core', async () => {
  const actual = await vi.importActual('@elizaos/core')
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  }
})

describe('Alioth Plugin – Basic Metadata & Initialization', () => {
  it('exposes correct metadata', () => {
    expect(plugin.name).toBe('yield_optimizer')
    expect(typeof plugin.description).toBe('string')
  })

  it('default config adheres to schema', async () => {
    await expect(configSchema.parseAsync(plugin.config)).resolves.toBeTruthy()
  })

  it('init() sets provided env vars', async () => {
    const key = 'DEFILLAMA_API_KEY'
    delete process.env[key]
    await plugin.init?.({ [key]: 'TEST_VALUE' }, {} as any)
    expect(process.env[key]).toBe('TEST_VALUE')
  })
})
