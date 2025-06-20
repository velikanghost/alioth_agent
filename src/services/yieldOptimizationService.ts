import { Service, type IAgentRuntime, logger } from '@elizaos/core'
import { defiDataService } from './dataService.js'

/**
 * Simplified Yield Optimization Service - MVP version without monitoring
 * Rebalancing triggers removed as Chainlink Upkeep handles execution timing
 */
export class YieldOptimizationService extends Service {
  static serviceType = 'yield_optimization'
  capabilityDescription =
    'Provides yield optimization insights on-demand without background monitoring'

  constructor(runtime: IAgentRuntime) {
    super(runtime)
  }

  static async start(runtime: IAgentRuntime) {
    logger.info('*** Starting Simplified Yield Optimization Service ***')
    const service = new YieldOptimizationService(runtime)
    return service
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info('*** Stopping Yield Optimization Service ***')
    // No cleanup needed as no background monitoring
  }

  async stop() {
    logger.info('*** Stopping Yield Optimization Service instance ***')
    // No cleanup needed as no background monitoring
  }

  /**
   * Get current market snapshot for yield analysis
   */
  async getCurrentMarketSnapshot() {
    try {
      logger.info('Fetching current market snapshot...')

      const [topYields, stableYields, protocols] = await Promise.all([
        defiDataService.getTopYieldOpportunities(10),
        defiDataService.getStablecoinYields(),
        defiDataService.getProtocols(),
      ])

      // Calculate market metrics
      const avgYield =
        topYields.reduce((sum, pool) => sum + (pool.apy || 0), 0) /
        topYields.length
      const totalTVL = protocols.reduce((sum, p) => sum + (p.tvl || 0), 0)

      logger.info(
        `Market snapshot: ${topYields.length} opportunities, avg ${avgYield.toFixed(1)}% APY, $${(totalTVL / 1_000_000_000).toFixed(1)}B total TVL`,
      )

      return {
        topYields,
        stableYields,
        protocols,
        metrics: {
          averageYield: avgYield,
          totalTVL,
          timestamp: new Date().toISOString(),
        },
      }
    } catch (error) {
      logger.error('Error fetching market snapshot:', error)
      throw error
    }
  }

  /**
   * Validate if a yield opportunity is still available
   */
  async validateYieldOpportunity(
    protocol: string,
    expectedAPY: number,
  ): Promise<boolean> {
    try {
      const pools = await defiDataService.getPoolsByProtocol(protocol)
      const currentAPY = pools.length > 0 ? pools[0].apy : 0

      // Check if current APY is within 10% of expected
      const tolerance = expectedAPY * 0.1
      return Math.abs((currentAPY || 0) - expectedAPY) <= tolerance
    } catch (error) {
      logger.error(`Error validating opportunity for ${protocol}:`, error)
      return false
    }
  }
}
