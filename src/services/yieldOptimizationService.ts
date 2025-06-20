import { Service, type IAgentRuntime, logger } from '@elizaos/core'
import { defiDataService } from './dataService.js'

/**
 * Enhanced Yield Optimization Service with real data monitoring
 */
export class YieldOptimizationService extends Service {
  static serviceType = 'yield_optimization'
  capabilityDescription =
    'Monitors real DeFi protocols and provides live yield optimization insights'

  private monitoringInterval?: NodeJS.Timeout
  private lastUpdate = 0

  constructor(runtime: IAgentRuntime) {
    super(runtime)
  }

  static async start(runtime: IAgentRuntime) {
    logger.info('*** Starting Enhanced Yield Optimization Service ***')
    const service = new YieldOptimizationService(runtime)

    // Start monitoring protocols
    await service.startMonitoring()

    return service
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info('*** Stopping Yield Optimization Service ***')
    const service = runtime.getService(YieldOptimizationService.serviceType)
    if (!service) {
      throw new Error('Yield Optimization service not found')
    }
    await service.stop()
  }

  private async startMonitoring() {
    // Initial data fetch
    await this.checkYieldOpportunities()

    // Monitor yield opportunities every 10 minutes
    this.monitoringInterval = setInterval(
      async () => {
        try {
          await this.checkYieldOpportunities()
        } catch (error) {
          logger.error('Error monitoring yield opportunities:', error)
        }
      },
      10 * 60 * 1000,
    )
  }

  private async checkYieldOpportunities() {
    try {
      logger.info('Fetching real-time yield opportunities...')

      const [topYields, stableYields, protocols] = await Promise.all([
        defiDataService.getTopYieldOpportunities(5),
        defiDataService.getStablecoinYields(),
        defiDataService.getProtocols(),
      ])

      this.lastUpdate = Date.now()

      // Log market summary
      const avgYield =
        topYields.reduce((sum, pool) => sum + (pool.apy || 0), 0) /
        topYields.length
      const totalTVL = protocols.reduce((sum, p) => sum + (p.tvl || 0), 0)

      logger.info(
        `Market update: ${topYields.length} opportunities found, avg ${avgYield.toFixed(1)}% APY, $${(totalTVL / 1_000_000_000).toFixed(1)}B total TVL`,
      )
    } catch (error) {
      logger.error('Error checking yield opportunities:', error)
    }
  }

  async stop() {
    logger.info('*** Stopping Yield Optimization Service instance ***')
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
  }
}
