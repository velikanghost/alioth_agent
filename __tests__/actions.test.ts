import {
  describe,
  expect,
  it,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest'
import { v4 as uuidv4 } from 'uuid'
import dotenv from 'dotenv'
import {
  runCoreActionTests,
  documentTestResult,
  createMockRuntime,
  createMockMessage,
  createMockState,
} from './utils/core-test-utils'
import { defiDataService } from '../src/services/dataService.js'
import { logger } from '@elizaos/core'

// Setup environment variables
dotenv.config()

// Spy on logger to capture logs for documentation
beforeAll(() => {
  vi.spyOn(logger, 'info')
  vi.spyOn(logger, 'error')
  vi.spyOn(logger, 'warn')
})

afterAll(() => {
  vi.restoreAllMocks()
})

// ────────────────────────────────────────────────────────────────────────────
// Utility: provide deterministic mock data for the data-service so we do not
// hit external APIs during test execution.
// ────────────────────────────────────────────────────────────────────────────

const actionsMap = plugin.actions!.reduce<Record<string, any>>((map, a) => {
  map[a.name] = a
  return map
}, {})

const analyzeYieldAction = actionsMap['ANALYZE_YIELD']

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

vi.mock('../src/services/dataService.js', async () => {
  const actual = await vi.importActual('../src/services/dataService.js')

  const mockTopYields = [
    {
      project: 'Aave',
      chain: 'ethereum',
      apy: 10,
      tvlUsd: 100_000_000,
      symbol: 'USDC',
    },
    {
      project: 'Compound',
      chain: 'ethereum',
      apy: 8,
      tvlUsd: 50_000_000,
      symbol: 'USDC',
    },
  ]

  const mockStableYields = [
    {
      project: 'Curve',
      chain: 'ethereum',
      apy: 6,
      tvlUsd: 200_000_000,
      symbol: 'USDC',
    },
  ]

  const ds = (actual as any).defiDataService
  ds.getTopYieldOpportunities = vi.fn().mockResolvedValue(mockTopYields)
  ds.getStablecoinYields = vi.fn().mockResolvedValue(mockStableYields)

  return actual
})

import plugin from '../src/plugin'

describe('Alioth Plugin Actions', () => {
  describe('ANALYZE_YIELD', () => {
    it('validate() recognises conversational query', async () => {
      const ok = await analyzeYieldAction.validate(
        createMockRuntime(),
        createMockMessage('Where can I get the best USDC yields?'),
        createMockState(),
      )
      expect(ok).toBe(true)
    })

    // Handler-level tests omitted – integration covered elsewhere
  })
})
