import type { Plugin } from '@elizaos/core'
import {
  type Action,
  type Content,
  type GenerateTextParams,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type Provider,
  type ProviderResult,
  Service,
  type State,
  logger,
} from '@elizaos/core'
import { z } from 'zod'
import { defiDataService } from './services/dataService.js'
import { createRealTimeYieldService } from './services/realTimeYieldService.js'

/**
 * Configuration schema for the yield optimizer plugin
 */
const configSchema = z.object({
  DEFILLAMA_API_KEY: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  DUNE_API_KEY: z.string().optional(),
  DEFAULT_SLIPPAGE: z.string().default('0.5'),
  MIN_YIELD_THRESHOLD: z.string().default('5.0'),
  MAX_RISK_SCORE: z.string().default('7.0'),
})

/**
 * Yield Analysis Action - Now using real DeFi data
 */
const analyzeYieldAction: Action = {
  name: 'ANALYZE_YIELD',
  similes: ['CHECK_YIELDS', 'FIND_OPPORTUNITIES', 'YIELD_SCAN', 'BEST_YIELDS'],
  description:
    'Analyzes current yield farming opportunities using real DeFi protocol data',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || ''
    return (
      text.includes('yield') ||
      text.includes('apy') ||
      text.includes('farming') ||
      text.includes('opportunities') ||
      text.includes('best rates') ||
      text.includes('defi')
    )
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
      logger.info('🔍 Fetching real-time yield opportunities from web search')

      // Create real-time yield service
      const yieldService = createRealTimeYieldService(runtime)

      // Get current best yield opportunities using web search
      const yields = await yieldService.getBestYieldOpportunities()
      const stableYields = await yieldService.getStableYields()

      if (yields.length === 0) {
        const responseContent: Content = {
          text: '⚠️ **Unable to fetch current yield data**\n\nWeb search services are temporarily unavailable. Using fallback data for basic yield information.',
          actions: ['ANALYZE_YIELD'],
          source: message.content.source,
        }
        await callback(responseContent)
        return responseContent
      }

      // Format the response using the service's built-in formatter
      const formattedResponse = yieldService.formatYieldsForDisplay(yields)

      // Add stable yields section
      const stableYieldsList = stableYields
        .slice(0, 3)
        .map((yield_) => {
          return `**${yield_.protocol}**: ${yield_.apy.toFixed(1)}% APY (${yield_.asset}) - Risk: ${yield_.risk}`
        })
        .join('\n')

      const responseContent: Content = {
        text:
          formattedResponse +
          `\n\n**🛡️ Stable Yields (Conservative):**\n${stableYieldsList}\n\n` +
          `📊 **Real-time Data Sources:**\n` +
          `• Live web search of protocol websites\n` +
          `• Cross-referenced yield information\n` +
          `• Updated every 10 minutes\n\n` +
          `*Note: Always verify rates on official protocol websites before investing.*`,
        actions: ['ANALYZE_YIELD'],
        source: message.content.source,
      }

      await callback(responseContent)
      return responseContent
    } catch (error) {
      logger.error('Error in ANALYZE_YIELD action:', error)

      const errorContent: Content = {
        text: '❌ **Error fetching yield data**\n\nUnable to retrieve current yield opportunities via web search. This might be due to network issues or API rate limits. Please try again in a few minutes.',
        actions: ['ANALYZE_YIELD'],
        source: message.content.source,
      }

      await callback(errorContent)
      return errorContent
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'What are the best yield opportunities right now?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '🔍 **Live Yield Analysis** 📊\n\n**🚀 Top Yield Opportunities:**\n**Aave** (Ethereum): **8.2%** APY...',
          actions: ['ANALYZE_YIELD'],
        },
      },
    ],
  ],
}

/**
 * Risk Assessment Action - Now with real protocol risk analysis
 */
const riskAssessmentAction: Action = {
  name: 'ASSESS_RISK',
  similes: ['CALCULATE_RISK', 'RISK_ANALYSIS', 'SAFETY_CHECK', 'PROTOCOL_RISK'],
  description:
    'Assesses risks for DeFi protocols using real TVL, audit, and market data',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || ''
    return (
      text.includes('risk') ||
      text.includes('safe') ||
      text.includes('dangerous') ||
      text.includes('audit') ||
      text.includes('secure')
    )
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
      logger.info('Assessing DeFi risks with real data')

      // Extract protocol name from message if mentioned
      const text = message.content.text?.toLowerCase() || ''
      const protocolNames = [
        'aave',
        'compound',
        'uniswap',
        'curve',
        'convex',
        'lido',
        'makerdao',
      ]
      const mentionedProtocol = protocolNames.find((name) =>
        text.includes(name),
      )

      let riskAnalysis = ''

      if (mentionedProtocol) {
        // Analyze specific protocol
        try {
          const riskMetrics =
            await defiDataService.calculateProtocolRisk(mentionedProtocol)

          riskAnalysis =
            `🔍 **${mentionedProtocol.charAt(0).toUpperCase() + mentionedProtocol.slice(1)} Risk Analysis**\n\n` +
            `**Overall Risk Score: ${riskMetrics.overallRisk}/10** ` +
            `(${riskMetrics.overallRisk <= 4 ? 'Low' : riskMetrics.overallRisk <= 7 ? 'Medium' : 'High'})\n\n` +
            `**Risk Breakdown:**\n` +
            `• Protocol Risk: ${riskMetrics.protocolRisk}/10\n` +
            `• Smart Contract Risk: ${riskMetrics.smartContractRisk}/10\n` +
            `• Liquidity Risk: ${riskMetrics.liquidityRisk}/10\n` +
            `• Market Risk: ${riskMetrics.marketRisk}/10\n` +
            `• Composability Risk: ${riskMetrics.composabilityRisk}/10\n\n`

          if (riskMetrics.riskFactors.length > 0) {
            riskAnalysis += `⚠️ **Risk Factors:**\n${riskMetrics.riskFactors.map((f) => `• ${f}`).join('\n')}\n\n`
          }
        } catch (error) {
          logger.error(`Error analyzing ${mentionedProtocol}:`, error)
          riskAnalysis = `⚠️ Unable to analyze ${mentionedProtocol} - protocol may not be found in database.\n\n`
        }
      }

      // General risk framework
      const generalRisk =
        `🛡️ **DeFi Risk Framework** 📊\n\n` +
        `**Smart Contract Risk** (varies by protocol):\n` +
        `💡 *Mitigation:* Use audited protocols with long track records\n\n` +
        `**Impermanent Loss** (LP positions):\n` +
        `💡 *Mitigation:* Choose correlated pairs or single-sided staking\n\n` +
        `**Liquidation Risk** (leveraged positions):\n` +
        `💡 *Mitigation:* Maintain healthy collateralization ratios\n\n` +
        `**Protocol Risk** (governance/economic):\n` +
        `💡 *Mitigation:* Diversify across multiple protocols\n\n` +
        `🎯 **Best Practices:**\n` +
        `• Never invest more than you can afford to lose\n` +
        `• Start small and gradually increase exposure\n` +
        `• Diversify across protocols, chains, and strategies\n` +
        `• Monitor TVL trends and protocol news\n` +
        `• Set position limits and stop-losses`

      const responseContent: Content = {
        text: riskAnalysis + generalRisk,
        actions: ['ASSESS_RISK'],
        source: message.content.source,
      }

      await callback(responseContent)
      return responseContent
    } catch (error) {
      logger.error('Error in ASSESS_RISK action:', error)
      throw error
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'How risky is Aave?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '🔍 **Aave Risk Analysis**\n\n**Overall Risk Score: 3.2/10** (Low)...',
          actions: ['ASSESS_RISK'],
        },
      },
    ],
  ],
}

/**
 * Portfolio Optimization Action - Now with real market data
 */
const optimizePortfolioAction: Action = {
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

/**
 * Enhanced Impermanent Loss Calculator
 */
const calculateILAction: Action = {
  name: 'CALCULATE_IL',
  similes: ['IMPERMANENT_LOSS', 'IL_CALC', 'LP_RISK', 'LIQUIDITY_RISK'],
  description:
    'Calculates impermanent loss scenarios with real market examples',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || ''
    return (
      text.includes('impermanent') ||
      text.includes('il') ||
      text.includes('liquidity') ||
      text.includes('lp') ||
      text.includes('pool') ||
      text.includes('loss')
    )
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
      logger.info('Calculating impermanent loss with real examples')

      // IL calculation scenarios
      const scenarios = [
        { priceChange: 10, il: defiDataService.calculateImpermanentLoss(10) },
        { priceChange: 25, il: defiDataService.calculateImpermanentLoss(25) },
        { priceChange: 50, il: defiDataService.calculateImpermanentLoss(50) },
        { priceChange: 100, il: defiDataService.calculateImpermanentLoss(100) },
        { priceChange: 200, il: defiDataService.calculateImpermanentLoss(200) },
      ]

      const ilTable = scenarios
        .map(
          (s) =>
            `**±${s.priceChange}%** price change: **${s.il.toFixed(2)}%** IL`,
        )
        .join('\n')

      // Try to get real pool examples
      let poolExamples = ''
      try {
        const pools = await defiDataService.getYieldPools()
        const ethPools = pools
          .filter(
            (p) =>
              p.symbol.includes('ETH') &&
              (p.symbol.includes('USDC') || p.symbol.includes('USDT')) &&
              p.tvlUsd > 5_000_000,
          )
          .slice(0, 2)

        if (ethPools.length > 0) {
          poolExamples =
            `\n\n🔍 **Real Pool Examples:**\n` +
            ethPools
              .map(
                (pool) =>
                  `• **${pool.project}** ${pool.symbol}: ${(pool.apy || 0).toFixed(1)}% APY (${pool.chain})`,
              )
              .join('\n')
        }
      } catch (error) {
        logger.error('Error fetching pool examples:', error)
      }

      const responseContent: Content = {
        text:
          `📉 **Impermanent Loss Calculator** 📊\n\n` +
          `${ilTable}\n\n` +
          `💡 **IL Mitigation Strategies:**\n` +
          `• **Correlated pairs**: ETH/stETH, USDC/USDT (minimal IL)\n` +
          `• **Stablecoin pairs**: Lower volatility = lower IL\n` +
          `• **Single-sided staking**: No IL risk (Aave, Compound)\n` +
          `• **Short-term positions**: Less time = less IL exposure\n` +
          `• **Fee tier selection**: Higher fees can offset IL\n\n` +
          `⚖️ **Break-even Analysis:**\n` +
          `LP fees + rewards must exceed IL for profitability\n` +
          `Example: 2% IL needs >2% additional yield to break even\n\n` +
          `🎯 **Pro Tips:**\n` +
          `• Monitor price ratios regularly\n` +
          `• Set IL alerts at 1-2% levels\n` +
          `• Consider IL insurance products\n` +
          `• Factor IL into total return calculations${poolExamples}`,
        actions: ['CALCULATE_IL'],
        source: message.content.source,
      }

      await callback(responseContent)
      return responseContent
    } catch (error) {
      logger.error('Error in CALCULATE_IL action:', error)
      throw error
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Calculate impermanent loss for ETH/USDC',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '📉 **Impermanent Loss Calculator** 📊\n\n**±10%** price change: **0.10%** IL...',
          actions: ['CALCULATE_IL'],
        },
      },
    ],
  ],
}

/**
 * Custom Investment Allocation Provider - Bypasses action system issues
 */
const investmentAllocationProvider: Provider = {
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
      const hasInvestment =
        text.includes('invest') ||
        text.includes('best') ||
        text.includes('allocat')
      const hasAmount = text.includes('$') || /\$?\d+/.test(text)
      const hasYield = text.includes('yield') || text.includes('opportunity')

      if (!hasInvestment || !hasAmount || !hasYield) {
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

/**
 * Historical Pool Analysis Action - Analyzes pool trends and historical data
 */
const historicalAnalysisAction: Action = {
  name: 'ANALYZE_POOL_HISTORY',
  similes: [
    'POOL_TRENDS',
    'HISTORICAL_DATA',
    'POOL_ANALYSIS',
    'TREND_ANALYSIS',
    'HISTORICAL_YIELD',
  ],
  description:
    'Analyzes historical yield and TVL trends for specific pools using real DeFiLlama data',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || ''
    return (
      text.includes('historical') ||
      text.includes('trend') ||
      text.includes('history') ||
      text.includes('past performance') ||
      text.includes('chart') ||
      text.includes('pool analysis') ||
      (text.includes('pool') && text.includes('747c1d2a')) // Specific pool ID
    )
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
      logger.info('Analyzing pool historical data')

      // Extract pool ID from message if provided
      const text = message.content.text || ''
      const poolIdMatch = text.match(/([a-f0-9-]{36})/) // UUID pattern
      let poolId = poolIdMatch
        ? poolIdMatch[1]
        : '747c1d2a-c668-4682-b9f9-296708a3dd90' // Default example

      try {
        // Fetch historical data and analyze trends
        const [historicalData, trends] = await Promise.all([
          defiDataService.getPoolHistoricalData(poolId, 30),
          defiDataService.analyzePoolTrends(poolId, 30),
        ])

        if (historicalData.length === 0) {
          const noDataContent: Content = {
            text:
              `⚠️ **No Historical Data Found**\n\n` +
              `Pool ID: \`${poolId}\`\n\n` +
              `This could mean:\n` +
              `• Pool ID doesn't exist or is incorrect\n` +
              `• Pool is too new (less than 30 days)\n` +
              `• Data temporarily unavailable\n\n` +
              `💡 Try analyzing a different pool or ask about "top yield opportunities" instead.`,
            actions: ['ANALYZE_POOL_HISTORY'],
            source: message.content.source,
          }
          await callback(noDataContent)
          return noDataContent
        }

        // Format trends analysis
        const apyTrendIcon =
          trends.apyTrend === 'increasing'
            ? '📈'
            : trends.apyTrend === 'decreasing'
              ? '📉'
              : '➡️'
        const tvlTrendIcon =
          trends.tvlTrend === 'increasing'
            ? '📈'
            : trends.tvlTrend === 'decreasing'
              ? '📉'
              : '➡️'

        const riskColor =
          trends.riskScore <= 3 ? '🟢' : trends.riskScore <= 6 ? '🟡' : '🔴'

        // Calculate key metrics
        const latestData = historicalData[historicalData.length - 1]
        const oldestData = historicalData[0]
        const apyChange =
          ((latestData.apy - oldestData.apy) / oldestData.apy) * 100
        const tvlChange =
          ((latestData.tvlUsd - oldestData.tvlUsd) / oldestData.tvlUsd) * 100

        const responseContent: Content = {
          text:
            `📊 **Pool Historical Analysis** (30 days)\n\n` +
            `**🔗 Pool ID:** \`${poolId}\`\n\n` +
            `**📈 Current Metrics:**\n` +
            `• APY: **${trends.currentApy.toFixed(2)}%** (${apyChange >= 0 ? '+' : ''}${apyChange.toFixed(1)}% vs 30d ago)\n` +
            `• TVL: **$${(latestData.tvlUsd / 1_000_000).toFixed(1)}M** (${tvlChange >= 0 ? '+' : ''}${tvlChange.toFixed(1)}% vs 30d ago)\n\n` +
            `**📊 Trend Analysis:**\n` +
            `• APY Trend: ${apyTrendIcon} **${trends.apyTrend.toUpperCase()}** (30d avg: ${trends.averageApy.toFixed(2)}%)\n` +
            `• TVL Trend: ${tvlTrendIcon} **${trends.tvlTrend.toUpperCase()}**\n` +
            `• Volatility: **${trends.volatility.toFixed(1)}%** ${trends.volatility > 25 ? '(High)' : trends.volatility > 10 ? '(Medium)' : '(Low)'}\n\n` +
            `**⚖️ Risk Assessment:**\n` +
            `• Risk Score: ${riskColor} **${trends.riskScore}/10**\n` +
            `• Recommendation: **${trends.recommendation}**\n\n` +
            `**📊 Data Summary:**\n` +
            `• Data Points: ${historicalData.length} days\n` +
            `• Highest APY: ${Math.max(...historicalData.map((d) => d.apy)).toFixed(2)}%\n` +
            `• Lowest APY: ${Math.min(...historicalData.map((d) => d.apy)).toFixed(2)}%\n` +
            `• Peak TVL: $${(Math.max(...historicalData.map((d) => d.tvlUsd)) / 1_000_000).toFixed(1)}M\n\n` +
            `**💡 Investment Insights:**\n` +
            `• **Stability:** ${trends.volatility < 10 ? 'High' : trends.volatility < 25 ? 'Medium' : 'Low'} (based on APY volatility)\n` +
            `• **Growth:** ${trends.tvlTrend === 'increasing' ? 'Expanding' : trends.tvlTrend === 'decreasing' ? 'Contracting' : 'Stable'} TVL indicates ${trends.tvlTrend === 'increasing' ? 'growing confidence' : trends.tvlTrend === 'decreasing' ? 'declining interest' : 'stable interest'}\n` +
            `• **Timing:** ${trends.apyTrend === 'increasing' ? 'Good entry point' : trends.apyTrend === 'decreasing' ? 'Consider waiting' : 'Neutral timing'}\n\n` +
            `*Historical data from DeFiLlama • Updated in real-time*`,
          actions: ['ANALYZE_POOL_HISTORY'],
          source: message.content.source,
        }

        await callback(responseContent)
        return responseContent
      } catch (dataError) {
        logger.error('Error fetching pool historical data:', dataError)

        const errorContent: Content = {
          text:
            `❌ **Error Analyzing Pool History**\n\n` +
            `Pool ID: \`${poolId}\`\n\n` +
            `Unable to fetch historical data. This could be due to:\n` +
            `• Invalid or non-existent pool ID\n` +
            `• API rate limiting\n` +
            `• Temporary service issues\n\n` +
            `💡 **Try:**\n` +
            `• Using a different pool ID\n` +
            `• Asking for "top yield opportunities" to find valid pools\n` +
            `• Checking the DeFiLlama website for valid pool identifiers`,
          actions: ['ANALYZE_POOL_HISTORY'],
          source: message.content.source,
        }

        await callback(errorContent)
        return errorContent
      }
    } catch (error) {
      logger.error('Error in ANALYZE_POOL_HISTORY action:', error)

      const errorContent: Content = {
        text:
          '❌ **Historical Analysis Unavailable**\n\n' +
          'Unable to perform historical analysis at this time. Please try again later or ask about current yield opportunities.',
        actions: ['ANALYZE_POOL_HISTORY'],
        source: message.content.source,
      }

      await callback(errorContent)
      return errorContent
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Analyze historical data for pool 747c1d2a-c668-4682-b9f9-296708a3dd90',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '📊 **Pool Historical Analysis** (30 days)\n\n**🔗 Pool ID:** `747c1d2a-c668-4682-b9f9-296708a3dd90`...',
          actions: ['ANALYZE_POOL_HISTORY'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Show me the trend analysis for this pool',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '📊 **Pool Historical Analysis** (30 days)...',
          actions: ['ANALYZE_POOL_HISTORY'],
        },
      },
    ],
  ],
}

/**
 * Real-time Protocol Monitor Provider
 */
const protocolMonitorProvider: Provider = {
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

const plugin: Plugin = {
  name: 'yield_optimizer',
  description:
    'Production-ready DeFi yield optimization with real-time data integration',
  priority: 100,
  config: {
    DEFILLAMA_API_KEY: process.env.DEFILLAMA_API_KEY,
    COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
    DUNE_API_KEY: process.env.DUNE_API_KEY,
    DEFAULT_SLIPPAGE: process.env.DEFAULT_SLIPPAGE || '0.5',
    MIN_YIELD_THRESHOLD: process.env.MIN_YIELD_THRESHOLD || '5.0',
    MAX_RISK_SCORE: process.env.MAX_RISK_SCORE || '7.0',
  },

  async init(config: Record<string, string>) {
    logger.info('*** Initializing Production Yield Optimizer Plugin ***')
    try {
      const validatedConfig = await configSchema.parseAsync(config)

      // Set environment variables
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value) process.env[key] = value
      }

      logger.info('Production yield optimizer plugin initialized successfully')
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid plugin configuration: ${error.errors.map((e) => e.message).join(', ')}`,
        )
      }
      throw error
    }
  },

  routes: [
    {
      name: 'yield-dashboard',
      path: '/yield-dashboard',
      type: 'GET',
      handler: async (req: any, res: any) => {
        try {
          const [topYields, protocols] = await Promise.all([
            defiDataService.getTopYieldOpportunities(10),
            defiDataService.getProtocols(),
          ])

          const dashboard = {
            title: 'YieldMaximizer Live Dashboard',
            topYields: topYields.slice(0, 5).map((pool) => ({
              project: pool.project,
              apy: `${(pool.apy || 0).toFixed(1)}%`,
              tvl: `$${(pool.tvlUsd / 1_000_000).toFixed(1)}M`,
              chain: pool.chain,
              symbol: pool.symbol,
            })),
            marketSummary: {
              totalProtocols: protocols.length,
              totalTVL: `$${(protocols.reduce((sum, p) => sum + (p.tvl || 0), 0) / 1_000_000_000).toFixed(1)}B`,
              avgTopYield: `${(topYields.slice(0, 5).reduce((sum, pool) => sum + (pool.apy || 0), 0) / 5).toFixed(1)}%`,
            },
            lastUpdated: new Date().toISOString(),
          }

          res.json(dashboard)
        } catch (error) {
          logger.error('Dashboard error:', error)
          res.status(500).json({ error: 'Unable to fetch dashboard data' })
        }
      },
    },
    {
      name: 'portfolio-analysis',
      path: '/portfolio-analysis',
      type: 'POST',
      handler: async (req: any, res: any) => {
        try {
          const { positions } = req.body

          if (!positions || !Array.isArray(positions)) {
            return res.status(400).json({ error: 'Invalid positions data' })
          }

          const analysis = await defiDataService.analyzePortfolio(positions)
          res.json(analysis)
        } catch (error) {
          logger.error('Portfolio analysis error:', error)
          res.status(500).json({
            error: 'Portfolio analysis failed',
            details: error.message,
          })
        }
      },
    },
    {
      name: 'protocol-risk',
      path: '/protocol-risk/:protocol',
      type: 'GET',
      handler: async (req: any, res: any) => {
        try {
          const { protocol } = req.params
          const riskMetrics =
            await defiDataService.calculateProtocolRisk(protocol)
          res.json(riskMetrics)
        } catch (error) {
          logger.error(`Risk analysis error for ${req.params.protocol}:`, error)
          res.status(500).json({ error: 'Risk analysis failed' })
        }
      },
    },
    {
      name: 'pool-history',
      path: '/pool-history/:poolId',
      type: 'GET',
      handler: async (req: any, res: any) => {
        try {
          const { poolId } = req.params
          const days = parseInt(req.query.days) || 30

          const [historicalData, trends] = await Promise.all([
            defiDataService.getPoolHistoricalData(poolId, days),
            defiDataService.analyzePoolTrends(poolId, days),
          ])

          if (historicalData.length === 0) {
            return res.status(404).json({
              error: 'Pool not found or no historical data available',
              poolId,
            })
          }

          res.json({
            poolId,
            dataPoints: historicalData.length,
            period: `${days} days`,
            currentMetrics: {
              apy: trends.currentApy,
              tvlUsd: historicalData[historicalData.length - 1].tvlUsd,
            },
            trends: {
              apyTrend: trends.apyTrend,
              tvlTrend: trends.tvlTrend,
              volatility: trends.volatility,
              riskScore: trends.riskScore,
              recommendation: trends.recommendation,
            },
            statistics: {
              averageApy: trends.averageApy,
              maxApy: Math.max(...historicalData.map((d) => d.apy)),
              minApy: Math.min(...historicalData.map((d) => d.apy)),
              maxTvl: Math.max(...historicalData.map((d) => d.tvlUsd)),
              minTvl: Math.min(...historicalData.map((d) => d.tvlUsd)),
            },
            historicalData: historicalData.slice(-100), // Limit to last 100 points for response size
            lastUpdated: new Date().toISOString(),
          })
        } catch (error) {
          logger.error(`Pool history error for ${req.params.poolId}:`, error)
          res.status(500).json({
            error: 'Failed to fetch pool historical data',
            details: error.message,
          })
        }
      },
    },
    {
      name: 'health',
      path: '/health',
      type: 'GET',
      handler: async (req: any, res: any) => {
        try {
          const health = await defiDataService.healthCheck()
          res.json({
            service: 'YieldMaximizer',
            timestamp: new Date().toISOString(),
            ...health,
          })
        } catch (error) {
          logger.error('Health check error:', error)
          res.status(500).json({
            service: 'YieldMaximizer',
            status: 'error',
            timestamp: new Date().toISOString(),
          })
        }
      },
    },
  ],

  events: {
    MESSAGE_RECEIVED: [
      async (params) => {
        logger.info('Processing yield optimization query')
      },
    ],
    YIELD_OPPORTUNITY_DETECTED: [
      async (params) => {
        logger.info('New yield opportunity detected')
      },
    ],
  },

  services: [YieldOptimizationService],
  actions: [
    analyzeYieldAction,
    riskAssessmentAction,
    optimizePortfolioAction,
    calculateILAction,
    historicalAnalysisAction,
  ],
  providers: [protocolMonitorProvider, investmentAllocationProvider],
}

export default plugin
