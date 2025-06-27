import { describe, it, expect, vi } from 'vitest'
import { defiAnalysisProvider } from '../src/providers/defiAnalysisProvider.js'
import {
  createMockRuntime,
  createMockMessage,
  createMockState,
} from './utils/core-test-utils'

// Mock defidata service to avoid network calls
vi.mock('../src/services/dataService.js', async () => {
  const actual = await vi.importActual('../src/services/dataService.js')
  return {
    ...actual,
    defiDataService: {
      ...(actual as any).defiDataService,
      getTopYieldOpportunities: vi.fn().mockResolvedValue([]),
      getStablecoinYields: vi.fn().mockResolvedValue([]),
      calculateProtocolRisk: vi.fn().mockResolvedValue({
        overallRisk: 5,
        protocolRisk: 4,
        smartContractRisk: 5,
        liquidityRisk: 5,
        marketRisk: 5,
        composabilityRisk: 5,
        riskFactors: [],
      }),
    },
  }
})

describe('Provider – DEFI_ANALYSIS', () => {
  it('exposes correct metadata', () => {
    expect(defiAnalysisProvider.name).toBe('DEFI_ANALYSIS')
    expect(typeof defiAnalysisProvider.description).toBe('string')
  })

  it('returns empty object when query is not DeFi related', async () => {
    const res = await defiAnalysisProvider.get(
      createMockRuntime(),
      createMockMessage('Just saying hi!'),
      createMockState(),
    )
    expect(res).toEqual({ text: '', values: {}, data: {} })
  })
})
