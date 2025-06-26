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
import {
  detectRequestType,
  extractRiskTolerance,
} from '../utils/requestDetection.js'
import { formatPortfolioResponse } from '../utils/responseFormatters.js'
import type {
  AllocationStrategy,
  DetailedAllocation,
  ProtocolAllocation,
  MarketData,
  EnhancedContent,
} from '../types/interfaces.js'

// Fixed allocation strategies as specified in focus document
const ALLOCATION_STRATEGIES: Record<string, AllocationStrategy> = {
  conservative: {
    stablecoins: 70,
    bluechip: 25,
    riskAssets: 5,
    description: 'Capital preservation focused, stable yields',
    targetAPY: '4-6%',
  },
  moderate: {
    stablecoins: 50,
    bluechip: 30,
    riskAssets: 20,
    description: 'Balanced risk-reward, diversified approach',
    targetAPY: '6-10%',
  },
  aggressive: {
    stablecoins: 25,
    bluechip: 25,
    riskAssets: 50,
    description: 'Growth focused, higher risk tolerance',
    targetAPY: '10-15%+',
  },
}

/**
 * Calculate detailed protocol allocations within each category
 */
const calculateDetailedAllocation = async (
  baseStrategy: AllocationStrategy,
  marketData: MarketData,
): Promise<DetailedAllocation> => {
  // Get current protocol data
  const [stableYields, topYields] = await Promise.all([
    defiDataService.getStablecoinYields(),
    defiDataService.getTopYieldOpportunities(10, 1_000_000),
  ])

  // Stablecoin allocations (conservative protocols)
  const stableProtocols = stableYields.slice(0, 3)
  const stablecoins: ProtocolAllocation[] = stableProtocols.map(
    (pool, index) => ({
      protocol: pool.project || 'Unknown',
      percentage: baseStrategy.stablecoins * (index === 0 ? 0.5 : 0.25),
      expectedAPY: pool.apy || 4,
      riskScore: 2 + index, // Very low risk
      tvl: pool.tvlUsd || 0,
      chain: pool.chain || 'ethereum',
      token: pool.symbol || 'USDC',
    }),
  )

  // Blue-chip allocations (established DeFi)
  const bluechipProtocols = ['ETH staking', 'Aave', 'Compound']
  const bluechip: ProtocolAllocation[] = bluechipProtocols.map(
    (protocol, index) => ({
      protocol,
      percentage: baseStrategy.bluechip / bluechipProtocols.length,
      expectedAPY: protocol === 'ETH staking' ? 3.5 : 5 + index,
      riskScore: 3 + index,
      tvl: 1_000_000_000, // Placeholder
      chain: 'ethereum',
      token: protocol === 'ETH staking' ? 'ETH' : 'Various',
    }),
  )

  // Risk asset allocations (higher yield opportunities)
  const riskProtocols = topYields
    .filter((pool) => (pool.apy || 0) > 8)
    .slice(0, 3)
  const riskAssets: ProtocolAllocation[] = riskProtocols.map((pool, index) => ({
    protocol: pool.project || 'Unknown',
    percentage: baseStrategy.riskAssets * (index === 0 ? 0.4 : 0.3),
    expectedAPY: pool.apy || 12,
    riskScore: 6 + index,
    tvl: pool.tvlUsd || 0,
    chain: pool.chain || 'ethereum',
    token: pool.symbol || 'Various',
  }))

  return { stablecoins, bluechip, riskAssets }
}

/**
 * Calculate expected APY for the allocation
 */
const calculateExpectedAPY = (allocation: DetailedAllocation): number => {
  const allAllocations = [
    ...allocation.stablecoins,
    ...allocation.bluechip,
    ...allocation.riskAssets,
  ]

  const totalPercentage = allAllocations.reduce(
    (sum, alloc) => sum + alloc.percentage,
    0,
  )
  const weightedAPY = allAllocations.reduce(
    (sum, alloc) => sum + alloc.expectedAPY * alloc.percentage,
    0,
  )

  return totalPercentage > 0 ? weightedAPY / totalPercentage : 0
}

/**
 * Portfolio Optimization Action - Enhanced with fixed strategies
 */
export const optimizePortfolioAction: Action = {
  name: 'OPTIMIZE_PORTFOLIO',
  similes: ['REBALANCE', 'ALLOCATE', 'OPTIMIZE_ALLOCATION', 'PORTFOLIO_ADVICE'],
  description:
    'Dual-mode portfolio optimization with fixed allocation strategies',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || ''

    // Keep existing natural language validation for chat
    const isConversational =
      text.includes('portfolio') ||
      text.includes('allocat') ||
      text.includes('rebalance') ||
      text.includes('diversif') ||
      text.includes('strategy') ||
      text.includes('optimize') ||
      text.includes('invest')

    // Add API request detection with proper type checking
    const isAPIRequest =
      message.content.structured === true ||
      (typeof message.content.riskTolerance === 'string' &&
        ['conservative', 'moderate', 'aggressive'].includes(
          message.content.riskTolerance,
        ))

    return isConversational || isAPIRequest
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: HandlerCallback,
  ) => {
    try {
      logger.info('Optimizing portfolio with real market data')

      // Detect if this is an API request
      const isAPIRequest = detectRequestType(message) === 'api'
      const riskTolerance = extractRiskTolerance(message)

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

      // Return structured data for API requests
      if (isAPIRequest) {
        const selectedStrategy = allocations[riskTolerance]
        const protocols = [
          ...stableYields.slice(0, 2).map((p) => ({
            protocol: p.project || 'Unknown',
            percentage: selectedStrategy.stablecoins / 2,
            expectedAPY: p.apy || 4,
            riskScore: 2,
            category: 'stablecoins',
            chain: p.chain || 'ethereum',
            token: p.symbol || 'USDC',
          })),
          {
            protocol: 'ETH Staking',
            percentage: selectedStrategy.bluechip,
            expectedAPY: 3.5,
            riskScore: 3,
            category: 'bluechip',
            chain: 'ethereum',
            token: 'ETH',
          },
          ...topYields.slice(0, 1).map((p) => ({
            protocol: p.project || 'Unknown',
            percentage: selectedStrategy.riskAssets,
            expectedAPY: p.apy || 12,
            riskScore: 6,
            category: 'riskAssets',
            chain: p.chain || 'ethereum',
            token: p.symbol || 'Various',
          })),
        ]

        const structuredResponse = {
          success: true,
          data: {
            allocation: {
              stablecoins: selectedStrategy.stablecoins,
              bluechip: selectedStrategy.bluechip,
              riskAssets: selectedStrategy.riskAssets,
            },
            expectedAPY: selectedStrategy.expectedAPY,
            protocols,
            confidence: 85,
            reasoning: `${riskTolerance} allocation based on current market conditions`,
            marketData: {
              avgStableYield,
              avgHighYield,
              totalProtocols: topYields.length + stableYields.length,
            },
          },
          timestamp: new Date().toISOString(),
        }

        const responseContent: Content = {
          text: JSON.stringify(structuredResponse, null, 2),
          actions: ['OPTIMIZE_PORTFOLIO'],
          source: message.content.source,
        }

        await callback(responseContent)
        return responseContent
      }

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
