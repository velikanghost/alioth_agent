import type {
  Action,
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
import type { ProtocolAllocation, MarketData } from '../types/interfaces.js'

// Supported tokens and protocols - Available on Aave testnets
const SUPPORTED_TOKENS = [
  'LINK',
  'WBTC',
  'WETH',
  'ETH',
  'AAVE',
  'GHO',
  'EURS',
  'USDC',
]
const SUPPORTED_PROTOCOLS = ['aave', 'compound-v3'] // Now supports Compound V3

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

  // Get yield opportunities for this specific token from Aave contracts
  const [allProtocols, tokenYields] = await Promise.all([
    defiDataService.getProtocols(),
    defiDataService.getTokenYieldOpportunities(tokenSymbol),
  ])

  // Sort by APY descending
  const sortedYields = tokenYields.sort((a, b) => (b.apy || 0) - (a.apy || 0))

  // Create recommendations based on risk tolerance
  let recommendations: ProtocolAllocation[] = []
  let reasoning = ''

  if (sortedYields.length === 0) {
    throw new Error(
      `No yield opportunities found for ${tokenSymbol} in Aave testnets. Supported tokens: ${SUPPORTED_TOKENS.join(', ')}`,
    )
  }

  // Risk-based allocation strategy - Aave only for testnets
  if (riskTolerance === 'conservative') {
    // Use highest and second highest APY chains for diversification
    const topTwo = sortedYields.slice(0, 2)

    if (topTwo.length >= 2) {
      // Split across top 2 chains: 70% highest, 30% second highest
      topTwo.forEach((pool, index) => {
        const percentage = index === 0 ? 70 : 30
        recommendations.push({
          protocol: pool.project || 'unknown',
          percentage,
          expectedAPY: pool.apy || 0,
          riskScore: 2,
          tvl: pool.tvlUsd || 0,
          chain: pool.chain || 'sepolia',
          token: tokenSymbol,
          amount: ((parseFloat(tokenAmount) * percentage) / 100).toString(),
        })
      })
      reasoning = `Conservative strategy: Diversified across Aave V3 on ${topTwo[0]?.chain} (${topTwo[0]?.apy?.toFixed(2)}% APY, 70%) and ${topTwo[1]?.chain} (${topTwo[1]?.apy?.toFixed(2)}% APY, 30%) for risk reduction.`
    } else {
      // Single chain allocation
      const bestPool = topTwo[0]
      recommendations.push({
        protocol: bestPool.project || 'unknown',
        percentage: 100,
        expectedAPY: bestPool.apy || 0,
        riskScore: 2,
        tvl: bestPool.tvlUsd || 0,
        chain: bestPool.chain || 'sepolia',
        token: tokenSymbol,
        amount: tokenAmount,
      })
      reasoning = `Conservative strategy: Full allocation to Aave V3 on ${bestPool.chain} (${bestPool.apy?.toFixed(2)}% APY) - single available option.`
    }
  } else if (riskTolerance === 'moderate') {
    // Balance between top chains, slightly favor higher yield
    const topTwo = sortedYields.slice(0, 2)

    if (topTwo.length >= 2) {
      topTwo.forEach((pool, index) => {
        const percentage = index === 0 ? 60 : 40
        recommendations.push({
          protocol: pool.project || 'unknown',
          percentage,
          expectedAPY: pool.apy || 0,
          riskScore: 3,
          tvl: pool.tvlUsd || 0,
          chain: pool.chain || 'sepolia',
          token: tokenSymbol,
          amount: ((parseFloat(tokenAmount) * percentage) / 100).toString(),
        })
      })
      reasoning = `Moderate strategy: Balanced allocation across Aave V3 networks. ${topTwo[0]?.chain} (${topTwo[0]?.apy?.toFixed(2)}% APY) gets 60% for higher yield, ${topTwo[1]?.chain} (${topTwo[1]?.apy?.toFixed(2)}% APY) gets 40% for diversification.`
    } else {
      // Single option available
      const bestYield = topTwo[0]
      recommendations.push({
        protocol: bestYield.project || 'unknown',
        percentage: 100,
        expectedAPY: bestYield.apy || 0,
        riskScore: 3,
        tvl: bestYield.tvlUsd || 0,
        chain: bestYield.chain || 'sepolia',
        token: tokenSymbol,
        amount: tokenAmount,
      })
      reasoning = `Moderate strategy: Full allocation to Aave V3 on ${bestYield.chain} (${bestYield.apy?.toFixed(2)}% APY) - single available option.`
    }
  } else {
    // Aggressive: Go for highest yield chain
    const bestYield = sortedYields[0]

    recommendations.push({
      protocol: bestYield.project || 'unknown',
      percentage: 100,
      expectedAPY: bestYield.apy || 0,
      riskScore: 5,
      tvl: bestYield.tvlUsd || 0,
      chain: bestYield.chain || 'sepolia',
      token: tokenSymbol,
      amount: tokenAmount,
    })

    reasoning = `Aggressive strategy: Full allocation to Aave V3 on ${bestYield.chain} (${bestYield.apy?.toFixed(2)}% APY) for maximum yield on ${tokenSymbol}.`
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
