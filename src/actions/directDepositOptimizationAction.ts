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
import { getTokenBySymbol } from '../config/uniswap.js'
import {
  detectRequestType,
  extractRiskTolerance,
} from '../utils/requestDetection.js'
import type { ProtocolAllocation, MarketData } from '../types/interfaces.js'

// Supported tokens and protocols
const SUPPORTED_TOKENS = ['AAVE', 'LINK', 'ETH', 'WETH', 'WBTC']
const SUPPORTED_PROTOCOLS = ['aave', 'compound-v3']

/**
 * Extract input token address from message
 */
const extractInputTokenAddress = (message: Memory): string => {
  // Handle direct API parameters
  if (
    message.content.inputTokenAddress &&
    typeof message.content.inputTokenAddress === 'string'
  ) {
    return message.content.inputTokenAddress
  }

  // Handle JSON in text field
  if (
    message.content.text &&
    message.content.text.includes('inputTokenAddress')
  ) {
    try {
      const parsed = JSON.parse(message.content.text)
      if (
        parsed.inputTokenAddress &&
        typeof parsed.inputTokenAddress === 'string'
      ) {
        return parsed.inputTokenAddress
      }
    } catch {
      // Continue to fallback
    }
  }

  return ''
}

/**
 * Extract input token symbol from message
 */
const extractInputTokenSymbol = (message: Memory): string => {
  // Handle direct API parameters
  if (
    message.content.inputTokenSymbol &&
    typeof message.content.inputTokenSymbol === 'string'
  ) {
    return message.content.inputTokenSymbol.toUpperCase()
  }

  // Handle JSON in text field
  if (
    message.content.text &&
    message.content.text.includes('inputTokenSymbol')
  ) {
    try {
      const parsed = JSON.parse(message.content.text)
      if (
        parsed.inputTokenSymbol &&
        typeof parsed.inputTokenSymbol === 'string'
      ) {
        return parsed.inputTokenSymbol.toUpperCase()
      }
    } catch {
      // Continue to fallback
    }
  }

  return ''
}

/**
 * Extract input token amount from message
 */
const extractInputTokenAmount = (message: Memory): string => {
  // Handle direct API parameters
  if (
    message.content.inputTokenAmount &&
    typeof message.content.inputTokenAmount === 'string'
  ) {
    return message.content.inputTokenAmount
  }

  // Handle JSON in text field
  if (
    message.content.text &&
    message.content.text.includes('inputTokenAmount')
  ) {
    try {
      const parsed = JSON.parse(message.content.text)
      if (
        parsed.inputTokenAmount &&
        typeof parsed.inputTokenAmount === 'string'
      ) {
        return parsed.inputTokenAmount
      }
    } catch {
      // Continue to fallback
    }
  }

  return '0'
}

/**
 * Extract USD amount from message
 */
const extractUSDAmount = (message: Memory): number => {
  // Handle direct API parameters
  if (
    message.content.usdAmount &&
    typeof message.content.usdAmount === 'number'
  ) {
    return message.content.usdAmount
  }

  // Handle JSON in text field
  if (message.content.text && message.content.text.includes('usdAmount')) {
    try {
      const parsed = JSON.parse(message.content.text)
      if (parsed.usdAmount && typeof parsed.usdAmount === 'number') {
        return parsed.usdAmount
      }
    } catch {
      // Continue to fallback
    }
  }

  return 0
}

/**
 * Find best yield opportunities for the specific token across supported protocols
 */
const findBestYieldForToken = async (params: {
  tokenSymbol: string
  tokenAmount: string
  usdAmount: number
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
}): Promise<{
  recommendations: ProtocolAllocation[]
  marketAnalysis: MarketData
  confidence: number
  reasoning: string
}> => {
  const { tokenSymbol, tokenAmount, usdAmount, riskTolerance } = params

  logger.info(
    `Finding best yield for ${tokenAmount} ${tokenSymbol} (~$${usdAmount}) with ${riskTolerance} risk tolerance`,
  )

  // Get yield opportunities for this specific token across all protocols
  const [allProtocols, topYields] = await Promise.all([
    defiDataService.getProtocols(),
    defiDataService.getTopYieldOpportunities(20, 100_000),
  ])

  // Filter for supported protocols and the specific token
  const tokenYields = topYields.filter((pool) => {
    const isSupprotedProtocol = SUPPORTED_PROTOCOLS.some((protocol) =>
      pool.project?.toLowerCase().includes(protocol.replace('-v3', '')),
    )

    const matchesToken =
      pool.symbol?.toUpperCase().includes(tokenSymbol.toUpperCase()) ||
      (tokenSymbol === 'ETH' && pool.symbol?.toUpperCase().includes('WETH')) ||
      (tokenSymbol === 'WETH' && pool.symbol?.toUpperCase().includes('ETH'))

    return isSupprotedProtocol && matchesToken
  })

  // Sort by APY descending
  const sortedYields = tokenYields.sort((a, b) => (b.apy || 0) - (a.apy || 0))

  // Create recommendations based on risk tolerance
  let recommendations: ProtocolAllocation[] = []
  let reasoning = ''

  if (sortedYields.length === 0) {
    throw new Error(
      `No yield opportunities found for ${tokenSymbol} in supported protocols (Aave, Compound-v3)`,
    )
  }

  // Risk-based allocation strategy
  if (riskTolerance === 'conservative') {
    // Use top 1-2 most stable protocols, prefer Aave
    const aavePool = sortedYields.find((p) =>
      p.project?.toLowerCase().includes('aave'),
    )
    const compoundPool = sortedYields.find((p) =>
      p.project?.toLowerCase().includes('compound'),
    )

    if (aavePool) {
      recommendations.push({
        protocol: 'aave',
        percentage: compoundPool ? 70 : 100,
        expectedAPY: aavePool.apy || 0,
        riskScore: 2,
        tvl: aavePool.tvlUsd || 0,
        chain: aavePool.chain || 'ethereum',
        token: tokenSymbol,
        amount: compoundPool
          ? (parseFloat(tokenAmount) * 0.7).toString()
          : tokenAmount,
      })
    }

    if (compoundPool && aavePool) {
      recommendations.push({
        protocol: 'compound-v3',
        percentage: 30,
        expectedAPY: compoundPool.apy || 0,
        riskScore: 3,
        tvl: compoundPool.tvlUsd || 0,
        chain: compoundPool.chain || 'ethereum',
        token: tokenSymbol,
        amount: (parseFloat(tokenAmount) * 0.3).toString(),
      })
    }

    reasoning = `Conservative strategy: Prioritizing Aave (${aavePool?.apy?.toFixed(2)}% APY) for ${aavePool ? '70%' : '100%'} allocation due to strong track record and security. ${compoundPool ? `Compound-v3 (${compoundPool.apy?.toFixed(2)}% APY) for remaining 30% to diversify protocol risk.` : ''}`
  } else if (riskTolerance === 'moderate') {
    // Balance between protocols, slightly favor higher yield
    const topTwo = sortedYields.slice(0, 2)

    topTwo.forEach((pool, index) => {
      const percentage = index === 0 ? 60 : 40
      const protocol = pool.project?.toLowerCase().includes('aave')
        ? 'aave'
        : 'compound-v3'

      recommendations.push({
        protocol,
        percentage,
        expectedAPY: pool.apy || 0,
        riskScore: protocol === 'aave' ? 3 : 4,
        tvl: pool.tvlUsd || 0,
        chain: pool.chain || 'ethereum',
        token: tokenSymbol,
        amount: ((parseFloat(tokenAmount) * percentage) / 100).toString(),
      })
    })

    reasoning = `Moderate strategy: Balanced allocation across top protocols. ${topTwo[0]?.project} (${topTwo[0]?.apy?.toFixed(2)}% APY) gets 60% for higher yield, ${topTwo[1]?.project} (${topTwo[1]?.apy?.toFixed(2)}% APY) gets 40% for diversification.`
  } else {
    // Aggressive: Go for highest yield protocol
    const bestYield = sortedYields[0]
    const protocol = bestYield.project?.toLowerCase().includes('aave')
      ? 'aave'
      : 'compound-v3'

    recommendations.push({
      protocol,
      percentage: 100,
      expectedAPY: bestYield.apy || 0,
      riskScore: 5,
      tvl: bestYield.tvlUsd || 0,
      chain: bestYield.chain || 'ethereum',
      token: tokenSymbol,
      amount: tokenAmount,
    })

    reasoning = `Aggressive strategy: Full allocation to ${bestYield.project} (${bestYield.apy?.toFixed(2)}% APY) for maximum yield on ${tokenSymbol}.`
  }

  // Calculate market analysis
  const avgAPY =
    sortedYields.reduce((sum, pool) => sum + (pool.apy || 0), 0) /
    sortedYields.length
  const totalTVL = allProtocols.reduce((sum, p) => sum + (p.tvl || 0), 0)

  // Create unique top protocols list with chain info
  const uniqueProtocols = new Map<
    string,
    { project: string; chain: string; apy: number }
  >()

  sortedYields.forEach((pool) => {
    const key = `${pool.project}-${pool.chain}`
    if (!uniqueProtocols.has(key) && uniqueProtocols.size < 3) {
      uniqueProtocols.set(key, {
        project: pool.project || 'Unknown',
        chain: pool.chain || 'ethereum',
        apy: pool.apy || 0,
      })
    }
  })

  const topProtocolsList = Array.from(uniqueProtocols.values()).map(
    (p) => `${p.project} (${p.chain})`,
  )

  const marketAnalysis: MarketData = {
    timestamp: new Date().toISOString(),
    totalTvl: totalTVL,
    averageYield: avgAPY,
    topProtocols: topProtocolsList,
    marketCondition: avgAPY > 8 ? 'bull' : avgAPY < 4 ? 'bear' : 'sideways',
  }

  // Calculate confidence based on data quality and market conditions
  const confidence = Math.min(
    95,
    70 +
      sortedYields.length * 5 + // More options = higher confidence
      (avgAPY > 5 ? 10 : 0) + // Good yields = higher confidence
      (recommendations.length > 1 ? 10 : 0), // Diversification = higher confidence
  )

  return {
    recommendations,
    marketAnalysis,
    confidence,
    reasoning,
  }
}

export const directDepositOptimizationAction: Action = {
  name: 'DIRECT_DEPOSIT_OPTIMIZATION',
  similes: [
    'OPTIMIZE_DIRECT_DEPOSIT',
    'FIND_BEST_YIELD',
    'ANALYZE_DEPOSIT',
    'YIELD_OPTIMIZATION',
  ],
  description:
    'Analyzes best yield opportunities for direct token deposits without swaps',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || ''

    // Check for optimization-related keywords
    const hasOptimizationKeywords =
      text.includes('optimize') ||
      text.includes('best yield') ||
      text.includes('deposit') ||
      text.includes('yield') ||
      text.includes('apy')

    // Check for API request with required parameters
    const hasRequiredParams =
      message.content.inputTokenAddress &&
      message.content.inputTokenSymbol &&
      message.content.inputTokenAmount &&
      message.content.usdAmount

    // Check for supported tokens
    const hasSupportedToken = SUPPORTED_TOKENS.some((token) =>
      text.includes(token.toLowerCase()),
    )

    return Boolean(
      hasOptimizationKeywords || hasRequiredParams || hasSupportedToken,
    )
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: HandlerCallback,
  ) => {
    try {
      logger.info('🎯 Starting direct deposit optimization analysis')

      // Extract parameters from message
      const inputTokenAddress = extractInputTokenAddress(message)
      const inputTokenSymbol = extractInputTokenSymbol(message)
      const inputTokenAmount = extractInputTokenAmount(message)
      const usdAmount = extractUSDAmount(message)
      const riskTolerance = extractRiskTolerance(message)

      logger.info('Extracted parameters:', {
        inputTokenAddress,
        inputTokenSymbol,
        inputTokenAmount,
        usdAmount,
        riskTolerance,
      })

      // Validate token is supported
      if (!SUPPORTED_TOKENS.includes(inputTokenSymbol)) {
        throw new Error(
          `Unsupported token: ${inputTokenSymbol}. Supported tokens: ${SUPPORTED_TOKENS.join(', ')}`,
        )
      }

      // Validate amount
      if (parseFloat(inputTokenAmount) <= 0 || usdAmount <= 0) {
        throw new Error('Invalid token amount or USD value')
      }

      // Find best yield opportunities
      const optimization = await findBestYieldForToken({
        tokenSymbol: inputTokenSymbol,
        tokenAmount: inputTokenAmount,
        usdAmount,
        riskTolerance,
      })

      // Calculate weighted average APY
      const weightedAPY = optimization.recommendations.reduce(
        (sum, rec) => sum + (rec.expectedAPY * rec.percentage) / 100,
        0,
      )

      // Prepare response
      const requestType = detectRequestType(message)
      const timestamp = new Date().toISOString()

      if (requestType === 'api') {
        // Structured response for backend
        const apiResponse = {
          success: true,
          data: {
            inputToken: {
              address: inputTokenAddress,
              symbol: inputTokenSymbol,
              amount: inputTokenAmount,
              usdValue: usdAmount,
            },
            optimization: {
              strategy: riskTolerance,
              recommendations: optimization.recommendations,
              expectedAPY: Number(weightedAPY.toFixed(2)),
              confidence: optimization.confidence,
              reasoning: optimization.reasoning,
            },
            marketAnalysis: optimization.marketAnalysis,
            timestamp,
          },
          timestamp,
        }

        await callback({
          text: JSON.stringify(apiResponse, null, 2),
          content: apiResponse,
        })
      } else {
        // Human-readable response
        let responseText = `🎯 **Direct Deposit Optimization for ${inputTokenAmount} ${inputTokenSymbol}** 💰\n\n`
        responseText += `**💵 Investment:** $${usdAmount.toLocaleString()} (${inputTokenAmount} ${inputTokenSymbol})\n`
        responseText += `**🎲 Strategy:** ${riskTolerance.charAt(0).toUpperCase() + riskTolerance.slice(1)}\n`
        responseText += `**📈 Expected APY:** ${weightedAPY.toFixed(2)}%\n`
        responseText += `**🎯 Confidence:** ${optimization.confidence}%\n\n`

        responseText += `**🏛️ Recommended Protocol Allocation:**\n\n`

        optimization.recommendations.forEach((rec, index) => {
          responseText += `${index + 1}. **${rec.protocol.toUpperCase()}** (${rec.percentage}%)\n`
          responseText += `   • Amount: ${rec.amount} ${rec.token}\n`
          responseText += `   • APY: ${rec.expectedAPY.toFixed(2)}%\n`
          responseText += `   • Risk Score: ${rec.riskScore}/10\n`
          responseText += `   • TVL: $${(rec.tvl / 1_000_000).toFixed(1)}M\n\n`
        })

        responseText += `**🧠 Strategy Reasoning:**\n${optimization.reasoning}\n\n`

        responseText += `**📊 Market Conditions:**\n`
        responseText += `• Total DeFi TVL: $${(optimization.marketAnalysis.totalTvl / 1_000_000_000).toFixed(1)}B\n`
        responseText += `• Average ${inputTokenSymbol} Yield: ${optimization.marketAnalysis.averageYield.toFixed(2)}%\n`
        responseText += `• Market Sentiment: ${optimization.marketAnalysis.marketCondition.charAt(0).toUpperCase() + optimization.marketAnalysis.marketCondition.slice(1)}\n\n`

        responseText += `*📝 Note: These are direct deposit recommendations. No swaps required - deposit your ${inputTokenSymbol} directly into the recommended protocols.*`

        await callback({
          text: responseText,
          content: {
            success: true,
            data: optimization,
            type: 'direct_deposit_optimization',
          },
        })
      }

      logger.info(
        `✅ Direct deposit optimization completed for ${inputTokenAmount} ${inputTokenSymbol}`,
      )
    } catch (error) {
      logger.error('❌ Error in direct deposit optimization:', error)

      const errorMessage = `❌ **Optimization Failed**\n\nError: ${error instanceof Error ? error.message : 'Unknown error occurred'}\n\nPlease check your input parameters and try again.`

      await callback({
        text: errorMessage,
        content: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          type: 'direct_deposit_optimization_error',
        },
      })
    }
  },
}
