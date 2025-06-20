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
  extractInputToken,
  extractInputAmount,
  extractRiskTolerance,
  parseMessage,
} from '../utils/requestDetection.js'
import { formatConversationalYieldResponse } from '../utils/responseFormatters.js'
import type {
  YieldAnalysisResponse,
  ProtocolAllocation,
  MarketData,
  EnhancedContent,
} from '../types/interfaces.js'

/**
 * Helper function to format general yield response
 */
const formatGeneralYieldResponse = (yields: any[]): string => {
  let response = `🔍 **Live Yield Analysis** 📊\n\n**🚀 Top Yield Opportunities:**\n\n`

  yields.slice(0, 6).forEach((yield_, index) => {
    const riskLevel =
      yield_.symbol?.includes('USD') || yield_.symbol?.includes('stETH')
        ? 'Low'
        : 'Medium'
    response += `${index + 1}. **${yield_.project}** (${yield_.chain}): **${yield_.apy?.toFixed(1)}%** APY\n`
    response += `   • Asset: ${yield_.symbol}\n`
    response += `   • TVL: $${(yield_.tvlUsd / 1000000).toFixed(1)}M\n`
    response += `   • Risk: ${riskLevel}\n\n`
  })

  return response
}

/**
 * Core yield analysis logic - shared by both conversational and API modes
 */
const performYieldAnalysis = async (params: {
  inputToken: string
  inputAmount: string
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
  userAddress?: string
}): Promise<YieldAnalysisResponse> => {
  const { inputToken, inputAmount, riskTolerance } = params

  // Get current market data
  const [topYields, stableYields, protocols] = await Promise.all([
    defiDataService.getTopYieldOpportunities(10, 1_000_000),
    defiDataService.getStablecoinYields(),
    defiDataService.getProtocols(),
  ])

  // Filter opportunities based on input token and risk tolerance
  let filteredOpportunities = topYields.filter((pool) =>
    pool.symbol?.toUpperCase().includes(inputToken.toUpperCase()),
  )

  // If no specific token matches, get general opportunities
  if (filteredOpportunities.length === 0) {
    filteredOpportunities =
      riskTolerance === 'conservative'
        ? stableYields.slice(0, 5)
        : topYields.slice(0, 5)
  }

  // Convert to protocol allocations
  const allocation: ProtocolAllocation[] = filteredOpportunities.map(
    (pool, index) => ({
      protocol: pool.project || 'Unknown',
      percentage: index === 0 ? 60 : 40 / (filteredOpportunities.length - 1),
      expectedAPY: pool.apy || 0,
      riskScore: calculateRiskScore(pool, riskTolerance),
      tvl: pool.tvlUsd || 0,
      chain: pool.chain || 'ethereum',
      token: pool.symbol || inputToken,
    }),
  )

  // Calculate market data
  const totalTvl = protocols.reduce((sum, p) => sum + (p.tvl || 0), 0)
  const averageYield =
    topYields.length > 0
      ? topYields.reduce((sum, pool) => sum + (pool.apy || 0), 0) /
        topYields.length
      : 8

  const marketData: MarketData = {
    timestamp: new Date().toISOString(),
    totalTvl,
    averageYield,
    topProtocols: protocols.slice(0, 5).map((p) => p.name || 'Unknown'),
    marketCondition:
      averageYield > 15 ? 'bull' : averageYield < 5 ? 'bear' : 'sideways',
  }

  // Generate reasoning based on risk tolerance and market conditions
  const reasoning = generateReasoning(allocation, riskTolerance, marketData)

  // Calculate confidence based on data quality and market conditions
  const confidence = Math.min(
    95,
    Math.max(
      70,
      85 -
        (riskTolerance === 'aggressive' ? 10 : 0) +
        (allocation.length > 3 ? 5 : 0),
    ),
  )

  return {
    allocation,
    confidence,
    reasoning,
    marketAnalysis: marketData,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Calculate risk score for a pool based on various factors
 */
const calculateRiskScore = (pool: any, riskTolerance: string): number => {
  let riskScore = 5 // Base risk score

  // Adjust based on TVL (higher TVL = lower risk)
  if (pool.tvlUsd > 100_000_000) riskScore -= 2
  else if (pool.tvlUsd > 10_000_000) riskScore -= 1
  else if (pool.tvlUsd < 1_000_000) riskScore += 2

  // Adjust based on known protocols
  const lowRiskProtocols = ['Aave', 'Compound', 'Lido']
  const highRiskProtocols = ['New protocols', 'Experimental']

  if (lowRiskProtocols.includes(pool.project)) riskScore -= 1
  if (highRiskProtocols.some((risk) => pool.project?.includes(risk)))
    riskScore += 2

  // Adjust based on APY (very high APY = higher risk)
  if (pool.apy > 50) riskScore += 3
  else if (pool.apy > 20) riskScore += 1
  else if (pool.apy < 5) riskScore -= 1

  return Math.max(1, Math.min(10, riskScore))
}

/**
 * Generate reasoning for the allocation
 */
const generateReasoning = (
  allocation: ProtocolAllocation[],
  riskTolerance: string,
  marketData: MarketData,
): string => {
  const avgAPY =
    allocation.reduce((sum, alloc) => sum + alloc.expectedAPY, 0) /
    allocation.length

  let reasoning = `Based on current market conditions (${marketData.marketCondition}), `
  reasoning += `I recommend a ${riskTolerance} approach. `

  if (riskTolerance === 'conservative') {
    reasoning += `Focus on established protocols with proven track records. `
  } else if (riskTolerance === 'aggressive') {
    reasoning += `Consider higher-yield opportunities while managing risk exposure. `
  } else {
    reasoning += `Balance risk and reward with diversified protocol exposure. `
  }

  reasoning += `The average APY of ${avgAPY.toFixed(1)}% reflects current market opportunities. `
  reasoning += `Top allocation to ${allocation[0]?.protocol} due to strong fundamentals and yield potential.`

  return reasoning
}

/**
 * Yield Analysis Action - Enhanced with dual-mode support
 */
export const analyzeYieldAction: Action = {
  name: 'ANALYZE_YIELD',
  similes: ['CHECK_YIELDS', 'FIND_OPPORTUNITIES', 'YIELD_SCAN', 'BEST_YIELDS'],
  description:
    'Dual-mode yield analysis: conversational + structured API responses',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || ''

    // Keep existing natural language validation for chat
    const isConversational =
      text.includes('yield') ||
      text.includes('apy') ||
      text.includes('opportunities') ||
      text.includes('best') ||
      text.includes('roi') ||
      text.includes('return') ||
      text.includes('interest') ||
      text.includes('staking')

    // Add API request detection with proper type checking
    const isAPIRequest =
      message.content.structured === true ||
      (typeof message.content.inputToken === 'string' &&
        typeof message.content.inputAmount === 'string')

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
      logger.info('🔍 Processing dual-mode yield analysis request')

      // Detect request type and extract parameters
      const requestType = detectRequestType(message)
      const inputToken = extractInputToken(message)
      const inputAmount = extractInputAmount(message)
      const riskTolerance = extractRiskTolerance(message)

      logger.info(
        `Request type: ${requestType}, Token: ${inputToken}, Amount: ${inputAmount}, Risk: ${riskTolerance}`,
      )

      // Core analysis logic (shared by both modes)
      const analysis = await performYieldAnalysis({
        inputToken,
        inputAmount,
        riskTolerance,
        userAddress: message.content.userAddress as string,
      })

      if (requestType === 'api') {
        // Structured API response
        const apiResponse = {
          allocation: analysis.allocation,
          confidence: analysis.confidence,
          reasoning: analysis.reasoning,
          marketAnalysis: analysis.marketAnalysis,
          timestamp: analysis.timestamp,
        }

        logger.info(
          `API response generated with ${analysis.allocation.length} allocations, confidence: ${analysis.confidence}%`,
        )
        return apiResponse
      } else {
        // Conversational response with embedded structured data
        const responseContent: Content = {
          text: formatConversationalYieldResponse(analysis),
          actions: ['ANALYZE_YIELD'],
          source: message.content.source,
        }

        logger.info(
          `Conversational response generated for ${inputToken} with ${analysis.allocation.length} opportunities`,
        )
        await callback(responseContent)
        return responseContent
      }
    } catch (error) {
      logger.error('Error in ANALYZE_YIELD action:', error)

      const requestType = detectRequestType(message)

      if (requestType === 'api') {
        // API error response
        throw new Error(
          `Yield analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      } else {
        // Conversational error response
        const errorContent: Content = {
          text: '❌ **Error fetching yield data**\n\nUnable to retrieve current yield opportunities. This might be due to API rate limits or network issues. Please try again in a few minutes.',
          actions: ['ANALYZE_YIELD'],
          source: message.content.source,
        }

        await callback(errorContent)
        return errorContent
      }
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
