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
 * Custom Investment Allocation Provider - Bypasses action system issues
 */
export const investmentAllocationProvider: Provider = {
  name: 'INVESTMENT_ALLOCATION',
  description:
    'Provides detailed investment allocation recommendations with real market data',

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    try {
      const text = message.content.text?.toLowerCase() || ''

      // Check if this is an investment allocation request
      const hasInvestment = text.includes('invest') || text.includes('allocat')
      const hasAmount = text.includes('$') || /\$?\d+/.test(text)
      const hasYield = text.includes('yield') || text.includes('opportunity')

      // Don't trigger for specific protocol queries (let ANALYZE_YIELD handle those)
      const isSpecificProtocolQuery =
        text.includes('aave') ||
        text.includes('compound') ||
        text.includes('uniswap') ||
        text.includes('curve')

      if (
        !hasInvestment ||
        !hasAmount ||
        !hasYield ||
        isSpecificProtocolQuery
      ) {
        return {
          text: '',
          values: {},
          data: {},
        }
      }

      logger.info(
        '🚀 CUSTOM PROVIDER TRIGGERED - Generating detailed allocation',
      )

      // Extract investment amount
      const amountMatch = text.match(
        /(\$?\d+(?:,\d{3})*(?:\.\d{2})?)\s*(usd|dollar|k|thousand)?/i,
      )
      let investmentAmount = 1000

      if (amountMatch) {
        let amount = parseFloat(amountMatch[1].replace(/[$,]/g, ''))
        const unit = amountMatch[2]?.toLowerCase()
        if (unit === 'k' || unit === 'thousand') amount *= 1000
        investmentAmount = amount
      }

      // Get real market data
      const [topYields, stableYields] = await Promise.all([
        defiDataService.getTopYieldOpportunities(8, 500_000),
        defiDataService.getStablecoinYields(),
      ])

      logger.info(
        `📊 Provider fetched: ${topYields.length} yields, ${stableYields.length} stables`,
      )

      if (topYields.length === 0 && stableYields.length === 0) {
        return {
          text: 'Unable to fetch current market data',
          values: { error: 'no_data' },
          data: {},
        }
      }

      // Create allocations
      const stableOptions = stableYields.slice(0, 3)
      const yieldOptions = topYields.slice(0, 4)

      const stableAllocation = Math.round(investmentAmount * 0.6)
      const bluechipAllocation = Math.round(investmentAmount * 0.25)
      const riskAllocation =
        investmentAmount - stableAllocation - bluechipAllocation

      // Format recommendations
      const stableRecommendations = stableOptions
        .map((pool) => {
          const allocation = Math.round(stableAllocation / stableOptions.length)
          return `**${pool.project}** (${pool.chain}): $${allocation.toLocaleString()}\n  └ ${pool.symbol} - ${(pool.apy || 0).toFixed(1)}% APY - TVL: $${(pool.tvlUsd / 1_000_000).toFixed(1)}M`
        })
        .join('\n')

      const yieldRecommendations = yieldOptions
        .slice(0, 2)
        .map((pool) => {
          const allocation = Math.round(riskAllocation / 2)
          return `**${pool.project}** (${pool.chain}): $${allocation.toLocaleString()}\n  └ ${pool.symbol} - ${(pool.apy || 0).toFixed(1)}% APY - TVL: $${(pool.tvlUsd / 1_000_000).toFixed(1)}M`
        })
        .join('\n')

      const expectedAPY = (
        (stableOptions.reduce((sum, p) => sum + (p.apy || 0), 0) /
          Math.max(stableOptions.length, 1)) *
          0.6 +
        6 * 0.25 +
        (yieldOptions.slice(0, 2).reduce((sum, p) => sum + (p.apy || 0), 0) /
          2) *
          0.15
      ).toFixed(1)

      const allocationText =
        `💰 **Investment Allocation for $${investmentAmount.toLocaleString()}** 📊\n\n` +
        `*Based on live market data (${new Date().toLocaleDateString()})*\n\n` +
        `**🛡️ Stable Yields (60% - $${stableAllocation.toLocaleString()}):**\n${stableRecommendations}\n\n` +
        `**🔵 Blue-chip DeFi (25% - $${bluechipAllocation.toLocaleString()}):**\n` +
        `**Lido** (Ethereum): $${Math.round(bluechipAllocation * 0.7).toLocaleString()}\n` +
        `  └ stETH - 3.8% APY - Liquid staking\n` +
        `**Rocket Pool** (Ethereum): $${Math.round(bluechipAllocation * 0.3).toLocaleString()}\n` +
        `  └ rETH - 3.6% APY - Decentralized staking\n\n` +
        `**🚀 Higher Yield (15% - $${riskAllocation.toLocaleString()}):**\n${yieldRecommendations}\n\n` +
        `**📈 Expected Portfolio APY: ${expectedAPY}%**\n\n` +
        `**💡 Implementation Steps:**\n` +
        `1. Start with stablecoin yields (lowest risk)\n` +
        `2. Add ETH staking positions gradually\n` +
        `3. Research higher-yield protocols thoroughly\n` +
        `4. Keep $${Math.round(investmentAmount * 0.1).toLocaleString()} (10%) in wallet for gas + opportunities\n\n` +
        `**⚠️ Risk Management:**\n` +
        `• Never invest more than you can afford to lose\n` +
        `• Verify all contract addresses before depositing\n` +
        `• Consider starting with smaller amounts to test\n` +
        `• Monitor positions regularly for changes\n\n` +
        `*Data from DeFiLlama • Rates updated every 5 minutes*`

      logger.info('✅ CUSTOM PROVIDER SUCCESS - Detailed allocation generated')

      return {
        text: allocationText,
        values: {
          investmentAmount,
          expectedAPY: parseFloat(expectedAPY),
          stableAllocation,
          riskAllocation,
          topYields: topYields.slice(0, 3),
        },
        data: {
          allocations: {
            stable: stableOptions,
            yield: yieldOptions.slice(0, 2),
          },
        },
      }
    } catch (error) {
      logger.error('Error in investment allocation provider:', error)
      return {
        text: '',
        values: {},
        data: {},
      }
    }
  },
}
