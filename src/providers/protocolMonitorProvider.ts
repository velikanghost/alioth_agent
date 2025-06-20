import type {
  IAgentRuntime,
  Memory,
  Provider,
  ProviderResult,
  State,
} from '@elizaos/core'
import { logger } from '@elizaos/core'
import { defiDataService } from '../services/dataService.js'

/**
 * Real-time Protocol Monitor Provider
 */
export const protocolMonitorProvider: Provider = {
  name: 'PROTOCOL_MONITOR',
  description: 'Provides real-time DeFi protocol metrics and market data',

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    try {
      const [protocols, topYields] = await Promise.all([
        defiDataService.getProtocols(),
        defiDataService.getTopYieldOpportunities(10),
      ])

      const topProtocols = protocols.sort((a, b) => b.tvl - a.tvl).slice(0, 10)

      const marketData = {
        totalTVL: protocols.reduce((sum, p) => sum + (p.tvl || 0), 0),
        topProtocols: topProtocols.map((p) => ({
          name: p.name,
          tvl: p.tvl,
          category: p.category,
          change_24h: p.change_1d,
        })),
        topYields: topYields.map((pool) => ({
          project: pool.project,
          apy: pool.apy,
          tvl: pool.tvlUsd,
          chain: pool.chain,
        })),
        lastUpdated: new Date().toISOString(),
      }

      return {
        text: `Live DeFi market data: $${(marketData.totalTVL / 1_000_000_000).toFixed(1)}B total TVL across ${protocols.length} protocols`,
        values: marketData,
        data: marketData,
      }
    } catch (error) {
      logger.error('Error in protocol monitor:', error)
      return {
        text: 'Protocol monitoring temporarily unavailable',
        values: {},
        data: {},
      }
    }
  },
}
