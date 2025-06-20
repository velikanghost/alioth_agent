import type {
  Action,
  Content,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from '@elizaos/core'
import { logger } from '@elizaos/core'
import { defiDataService } from '../services/dataService.js'

/**
 * Portfolio Optimization Action - Now with real market data
 */
export const optimizePortfolioAction: Action = {
  name: 'OPTIMIZE_PORTFOLIO',
  similes: ['REBALANCE', 'ALLOCATE', 'OPTIMIZE_ALLOCATION', 'PORTFOLIO_ADVICE'],
  description:
    'Provides portfolio optimization recommendations based on current market conditions',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || ''

    // Don't interfere with specific protocol queries - let ANALYZE_YIELD handle those
    const isSpecificProtocolQuery =
      text.includes('aave') ||
      text.includes('compound') ||
      text.includes('uniswap') ||
      text.includes('curve') ||
      text.includes('best token') ||
      text.includes('which token')

    if (isSpecificProtocolQuery) {
      return false
    }

    // Enhanced validation to catch investment queries too
    const isPortfolioQuery =
      text.includes('portfolio') ||
      text.includes('allocat') ||
      text.includes('rebalance') ||
      text.includes('diversif')
    const isStrategyQuery =
      text.includes('strategy') &&
      (text.includes('yield') ||
        text.includes('defi') ||
        text.includes('invest'))
    const isOptimizeQuery =
      text.includes('optimize') &&
      (text.includes('yield') ||
        text.includes('defi') ||
        text.includes('portfolio'))
    const isInvestmentQuery =
      text.includes('invest') &&
      (text.includes('yield') ||
        text.includes('defi') ||
        text.includes('strategy'))

    const shouldTrigger =
      isPortfolioQuery ||
      isStrategyQuery ||
      isOptimizeQuery ||
      isInvestmentQuery

    logger.info(
      `OPTIMIZE_PORTFOLIO validation: portfolio=${isPortfolioQuery}, strategy=${isStrategyQuery}, optimize=${isOptimizeQuery}, investment=${isInvestmentQuery}, shouldTrigger=${shouldTrigger}`,
    )

    return shouldTrigger
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: HandlerCallback,
    responses: Memory[],
  ) => {
    try {
      logger.info('Optimizing portfolio with real market data')

      // Get current market data
      const [topYields, stableYields] = await Promise.all([
        defiDataService.getTopYieldOpportunities(5, 10_000_000),
        defiDataService.getStablecoinYields(),
      ])

      // Calculate current market averages
      const avgHighYield =
        topYields.length > 0
          ? topYields.reduce((sum, pool) => sum + (pool.apy || 0), 0) /
            topYields.length
          : 15
      const avgStableYield =
        stableYields.length > 0
          ? stableYields
              .slice(0, 5)
              .reduce((sum, pool) => sum + (pool.apy || 0), 0) /
            Math.min(5, stableYields.length)
          : 6

      // Dynamic allocation based on current market
      const allocations = {
        conservative: {
          stablecoins: 70,
          bluechip: 25,
          riskAssets: 5,
          expectedAPY: avgStableYield * 0.7 + 4 * 0.25 + avgHighYield * 0.05,
          description: `Low risk, steady yields (${(avgStableYield * 0.7 + 4 * 0.25 + avgHighYield * 0.05).toFixed(1)}% APY target)`,
        },
        moderate: {
          stablecoins: 50,
          bluechip: 30,
          riskAssets: 20,
          expectedAPY: avgStableYield * 0.5 + 6 * 0.3 + avgHighYield * 0.2,
          description: `Balanced risk/reward (${(avgStableYield * 0.5 + 6 * 0.3 + avgHighYield * 0.2).toFixed(1)}% APY target)`,
        },
        aggressive: {
          stablecoins: 25,
          bluechip: 25,
          riskAssets: 50,
          expectedAPY: avgStableYield * 0.25 + 8 * 0.25 + avgHighYield * 0.5,
          description: `Higher risk, higher potential yields (${(avgStableYield * 0.25 + 8 * 0.25 + avgHighYield * 0.5).toFixed(1)}% APY target)`,
        },
      }

      // Get top protocols for recommendations
      const topStableProtocols = stableYields.slice(0, 2).map((p) => p.project)
      const topYieldProtocols = topYields.slice(0, 2).map((p) => p.project)

      const strategyBreakdown = Object.entries(allocations)
        .map(
          ([strategy, data]) =>
            `**${strategy.charAt(0).toUpperCase() + strategy.slice(1)}** - ${data.description}\n` +
            `• Stablecoins: ${data.stablecoins}% (${topStableProtocols.join(', ') || 'Aave, Compound'})\n` +
            `• Blue-chip DeFi: ${data.bluechip}% (ETH staking, major tokens)\n` +
            `• Risk Assets: ${data.riskAssets}% (${topYieldProtocols.join(', ') || 'LP tokens, new protocols'})`,
        )
        .join('\n\n')

      const responseContent: Content = {
        text:
          `📊 **Live Portfolio Optimization** 🎯\n\n` +
          `*Based on current market data (${new Date().toLocaleDateString()})*\n\n` +
          `${strategyBreakdown}\n\n` +
          `💡 **Current Market Context:**\n` +
          `• Average stable yields: ${avgStableYield.toFixed(1)}% APY\n` +
          `• Top opportunities: ${avgHighYield.toFixed(1)}% APY average\n` +
          `• Market conditions: ${avgHighYield > 20 ? 'High yield environment' : avgHighYield > 10 ? 'Moderate yields available' : 'Conservative market'}\n\n` +
          `🔄 **Implementation Tips:**\n` +
          `• Start conservative and adjust based on experience\n` +
          `• Rebalance when allocations drift >15% from target\n` +
          `• Consider gas costs in your rebalancing strategy\n` +
          `• Keep 10-15% in stablecoins for opportunities\n\n` +
          `🎯 **Rebalancing Triggers:**\n` +
          `• Significant yield changes (>2% APY difference)\n` +
          `• New protocol launches or major updates\n` +
          `• Risk score changes for existing positions\n\n` +
          `*Data refreshed from DeFiLlama every 5 minutes*`,
        actions: ['OPTIMIZE_PORTFOLIO'],
        source: message.content.source,
      }

      await callback(responseContent)
      return responseContent
    } catch (error) {
      logger.error('Error in OPTIMIZE_PORTFOLIO action:', error)

      // Fallback to static recommendations if API fails
      const fallbackContent: Content = {
        text:
          `📊 **Portfolio Optimization** 🎯\n\n⚠️ *Using cached recommendations - live data temporarily unavailable*\n\n` +
          `**Conservative** (5-8% APY target): 60% stables, 30% blue-chip, 10% risk\n` +
          `**Moderate** (8-12% APY target): 40% stables, 35% blue-chip, 25% risk\n` +
          `**Aggressive** (12%+ APY target): 20% stables, 30% blue-chip, 50% risk\n\n` +
          `💡 Always diversify and never invest more than you can afford to lose.`,
        actions: ['OPTIMIZE_PORTFOLIO'],
        source: message.content.source,
      }

      await callback(fallbackContent)
      return fallbackContent
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'How should I allocate my DeFi portfolio?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '📊 **Live Portfolio Optimization** 🎯\n\n*Based on current market data*...',
          actions: ['OPTIMIZE_PORTFOLIO'],
        },
      },
    ],
  ],
}
