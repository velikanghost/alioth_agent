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
import { backendWalletService } from '../services/backendWalletService.js'
import { uniswapV3Service } from '../services/uniswapV3Service.js'
import { getTokenBySymbol } from '../config/uniswap.js'
import {
  detectRequestType,
  extractInputToken,
  extractInputAmount,
  extractRiskTolerance,
  extractWalletId,
  extractUserAddress,
} from '../utils/requestDetection.js'
import type {
  ProtocolAllocation,
  MarketData,
  SwapQuote,
  TransactionRequest,
  SwapExecutionRequest,
} from '../types/interfaces.js'

// Supported tokens as specified by user
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
      // Continue to token symbol extraction
    }
  }
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
      // Continue to natural language extraction
    }
  }
}

/**
 * Analyze market conditions and find optimal token allocation
 */
const analyzeOptimalAllocation = async (params: {
  inputTokenAddress: string
  usdAmount: number
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
}): Promise<{
  optimalTokens: string[]
  allocations: ProtocolAllocation[]
  marketAnalysis: MarketData
}> => {
  const { usdAmount, riskTolerance } = params

  // Get current market data filtered by supported protocols
  const [topYields, stableYields] = await Promise.all([
    defiDataService.getTopYieldOpportunities(10, 500_000),
    defiDataService.getStablecoinYields(),
  ])

  // Filter for supported protocols only
  const protocolFilter = (pool: any) =>
    SUPPORTED_PROTOCOLS.some((protocol) =>
      pool.project?.toLowerCase().includes(protocol.replace('-v3', '')),
    )

  const filteredYields = topYields.filter(protocolFilter)
  const filteredStables = stableYields.filter(protocolFilter)

  // Filter for supported tokens only
  const tokenFilter = (pool: any) =>
    SUPPORTED_TOKENS.some(
      (token) =>
        pool.symbol?.toUpperCase().includes(token) ||
        (token === 'WETH' && pool.symbol?.toUpperCase().includes('ETH')),
    )

  const supportedYields = filteredYields.filter(tokenFilter)
  const supportedStables = filteredStables.filter(tokenFilter)

  // Create allocation strategy based on risk tolerance
  let allocations: ProtocolAllocation[] = []
  let optimalTokens: string[] = []

  if (riskTolerance === 'conservative') {
    // 70% stablecoins, 30% ETH/WETH
    const stableAllocation = supportedStables.slice(0, 2)
    const ethAllocation = supportedYields.find(
      (p) => p.symbol?.includes('ETH') || p.symbol?.includes('WETH'),
    )

    allocations = [
      ...stableAllocation.map((pool, i) => ({
        protocol: pool.project || 'Unknown',
        percentage: i === 0 ? 40 : 30,
        expectedAPY: pool.apy || 4,
        riskScore: 2,
        tvl: pool.tvlUsd || 0,
        chain: pool.chain || '',
        token: pool.symbol || '',
      })),
      ...(ethAllocation
        ? [
            {
              protocol: ethAllocation.project || 'Unknown',
              percentage: 30,
              expectedAPY: ethAllocation.apy || 3.5,
              riskScore: 3,
              tvl: ethAllocation.tvlUsd || 0,
              chain: ethAllocation.chain || 'ethereum',
              token: ethAllocation.symbol || 'ETH',
            },
          ]
        : []),
    ]

    optimalTokens = [
      ...stableAllocation.map((p) => p.symbol || 'USDC'),
      ethAllocation?.symbol || 'ETH',
    ]
  } else if (riskTolerance === 'moderate') {
    // 40% stables, 40% ETH/WETH, 20% WBTC/AAVE/LINK
    const stableAllocation = supportedStables.slice(0, 1)
    const ethAllocation = supportedYields.find(
      (p) => p.symbol?.includes('ETH') || p.symbol?.includes('WETH'),
    )
    const altAllocation = supportedYields.find(
      (p) =>
        p.symbol?.includes('WBTC') ||
        p.symbol?.includes('AAVE') ||
        p.symbol?.includes('LINK'),
    )

    allocations = [
      ...stableAllocation.map((pool) => ({
        protocol: pool.project || 'Unknown',
        percentage: 40,
        expectedAPY: pool.apy || 4,
        riskScore: 2,
        tvl: pool.tvlUsd || 0,
        chain: pool.chain || 'ethereum',
        token: pool.symbol || 'USDC',
      })),
      ...(ethAllocation
        ? [
            {
              protocol: ethAllocation.project || 'Unknown',
              percentage: 40,
              expectedAPY: ethAllocation.apy || 5,
              riskScore: 4,
              tvl: ethAllocation.tvlUsd || 0,
              chain: ethAllocation.chain || 'ethereum',
              token: ethAllocation.symbol || 'ETH',
            },
          ]
        : []),
      ...(altAllocation
        ? [
            {
              protocol: altAllocation.project || 'Unknown',
              percentage: 20,
              expectedAPY: altAllocation.apy || 6,
              riskScore: 5,
              tvl: altAllocation.tvlUsd || 0,
              chain: altAllocation.chain || 'ethereum',
              token: altAllocation.symbol || 'WBTC',
            },
          ]
        : []),
    ]

    optimalTokens = [
      ...stableAllocation.map((p) => p.symbol || 'USDC'),
      ethAllocation?.symbol || 'ETH',
      altAllocation?.symbol || 'WBTC',
    ].filter(Boolean)
  } else {
    // Aggressive: 20% stables, 50% ETH/WETH, 30% WBTC/AAVE/LINK
    const stableAllocation = supportedStables.slice(0, 1)
    const ethAllocation = supportedYields.find(
      (p) => p.symbol?.includes('ETH') || p.symbol?.includes('WETH'),
    )
    const altAllocations = supportedYields
      .filter(
        (p) =>
          p.symbol?.includes('WBTC') ||
          p.symbol?.includes('AAVE') ||
          p.symbol?.includes('LINK'),
      )
      .slice(0, 2)

    allocations = [
      ...stableAllocation.map((pool) => ({
        protocol: pool.project || 'Unknown',
        percentage: 20,
        expectedAPY: pool.apy || 4,
        riskScore: 2,
        tvl: pool.tvlUsd || 0,
        chain: pool.chain || 'ethereum',
        token: pool.symbol || 'USDC',
      })),
      ...(ethAllocation
        ? [
            {
              protocol: ethAllocation.project || 'Unknown',
              percentage: 50,
              expectedAPY: ethAllocation.apy || 6,
              riskScore: 5,
              tvl: ethAllocation.tvlUsd || 0,
              chain: ethAllocation.chain || 'ethereum',
              token: ethAllocation.symbol || 'ETH',
            },
          ]
        : []),
      ...altAllocations.map((pool, i) => ({
        protocol: pool.project || 'Unknown',
        percentage: i === 0 ? 20 : 10,
        expectedAPY: pool.apy || 8,
        riskScore: 6 + i,
        tvl: pool.tvlUsd || 0,
        chain: pool.chain || 'ethereum',
        token: pool.symbol || 'WBTC',
      })),
    ]

    optimalTokens = [
      ...stableAllocation.map((p) => p.symbol || 'USDC'),
      ethAllocation?.symbol || 'ETH',
      ...altAllocations.map((p) => p.symbol || 'WBTC'),
    ].filter(Boolean)
  }

  // Calculate market data
  const allPools = [...filteredYields, ...filteredStables]
  const totalTvl = allPools.reduce((sum, pool) => sum + (pool.tvlUsd || 0), 0)
  const averageYield =
    allPools.length > 0
      ? allPools.reduce((sum, pool) => sum + (pool.apy || 0), 0) /
        allPools.length
      : 6

  const marketAnalysis: MarketData = {
    timestamp: new Date().toISOString(),
    totalTvl,
    averageYield,
    topProtocols: SUPPORTED_PROTOCOLS,
    marketCondition:
      averageYield > 8 ? 'bull' : averageYield < 5 ? 'bear' : 'sideways',
  }

  return { optimalTokens, allocations, marketAnalysis }
}

/**
 * Execute required swaps to achieve target allocation
 */
const executeOptimalSwaps = async (params: {
  inputTokenAddress: string
  optimalTokens: string[]
  allocations: ProtocolAllocation[]
  usdAmount: number
  walletId: string
  userAddress: string
}): Promise<{
  swapsExecuted: any[]
  finalAllocation: ProtocolAllocation[]
}> => {
  const {
    inputTokenAddress,
    optimalTokens,
    allocations,
    usdAmount,
    walletId,
    userAddress,
  } = params

  const swapsExecuted: any[] = []
  const finalAllocation: ProtocolAllocation[] = []

  // Get input token info
  const inputTokenSymbol =
    Object.entries(
      getTokenBySymbol('ETH')
        ? {
            ETH: '0x0000000000000000000000000000000000000000',
            USDC: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
            WETH: '0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c',
            LINK: '0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5',
            WBTC: '0x29f2D40B0605204364af54EC677bD022dA425d03',
          }
        : {},
    ).find(
      ([symbol, address]) =>
        address.toLowerCase() === inputTokenAddress.toLowerCase(),
    )?.[0] || 'USDC'

  // Calculate swap amounts based on allocations
  for (const allocation of allocations) {
    const targetToken = allocation.token
    const targetAmount = ((usdAmount * allocation.percentage) / 100).toString()

    // Skip if already have the target token
    if (targetToken.toUpperCase() === inputTokenSymbol.toUpperCase()) {
      finalAllocation.push({
        ...allocation,
        token: targetToken,
        amount: targetAmount,
      })
      continue
    }

    try {
      // Get tokens for swap
      const inputToken = getTokenBySymbol(inputTokenSymbol)
      const outputToken = getTokenBySymbol(targetToken)

      if (!inputToken || !outputToken) {
        logger.warn(
          `Unsupported token pair: ${inputTokenSymbol}/${targetToken}`,
        )
        continue
      }

      // Get swap quote
      const quote = await uniswapV3Service.getQuote(
        inputToken.symbol,
        outputToken.symbol,
        targetAmount,
      )

      // Execute smart swap
      const swapResult = await uniswapV3Service.executeSmartSwap(
        inputToken,
        outputToken,
        targetAmount,
        100, // 1% slippage
        userAddress,
        walletId,
        userAddress,
      )

      swapsExecuted.push({
        inputToken: inputTokenSymbol,
        outputToken: targetToken,
        inputAmount: targetAmount,
        outputAmount: quote.outputAmount,
        protocol: allocation.protocol,
        expectedAPY: allocation.expectedAPY,
        riskScore: allocation.riskScore,
        txHash: swapResult.txHash,
        success: swapResult.success,
        gasUsed: swapResult.gasUsed,
      })

      if (swapResult.success) {
        finalAllocation.push({
          ...allocation,
          token: targetToken,
          amount: quote.outputAmount,
        })
      }
    } catch (error) {
      logger.error(`Error executing swap for ${targetToken}:`, error)
    }
  }

  return { swapsExecuted, finalAllocation }
}

/**
 * Complete Yield Optimization Action - handles the full flow as specified
 */
export const completeYieldOptimizationAction: Action = {
  name: 'COMPLETE_YIELD_OPTIMIZATION',
  similes: ['OPTIMIZE_YIELD', 'FULL_OPTIMIZATION', 'YIELD_WITH_SWAPS'],
  description:
    'Complete yield optimization flow: analysis → swaps → protocol allocation',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> => {
    // Check for required parameters in API mode
    const hasRequiredParams =
      message.content.inputTokenAddress ||
      message.content.usdAmount ||
      (message.content.walletId && message.content.userAddress)

    // Check for natural language optimization request
    const text = message.content.text?.toLowerCase() || ''
    const hasOptimizationKeywords =
      (text.includes('optimize') ||
        text.includes('yield') ||
        text.includes('swap') ||
        text.includes('allocation')) &&
      (text.includes('execute') ||
        text.includes('complete') ||
        text.includes('full'))

    return Boolean(hasRequiredParams || hasOptimizationKeywords)
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: HandlerCallback,
  ) => {
    try {
      logger.info('🚀 Starting complete yield optimization flow')

      // Step 1: Extract parameters
      const inputTokenAddress = extractInputTokenAddress(message)
      const usdAmount = extractUSDAmount(message)
      const riskTolerance = extractRiskTolerance(message)
      const walletId = extractWalletId(message) || '' // Default for demo
      const userAddress = extractUserAddress(message) || ''

      logger.info('Extracted parameters:', {
        inputTokenAddress,
        usdAmount,
        riskTolerance,
        walletId,
        userAddress,
      })

      // Step 2: Analyze optimal protocols and tokens
      logger.info('📊 Analyzing market conditions and optimal allocation...')
      const { optimalTokens, allocations, marketAnalysis } =
        await analyzeOptimalAllocation({
          inputTokenAddress,
          usdAmount,
          riskTolerance,
        })

      logger.info(
        `Found ${allocations.length} optimal allocations across ${optimalTokens.length} tokens`,
      )

      logger.info(`Allocations: ${allocations}`)

      logger.info(`Optimal: ${optimalTokens}`)

      // Step 3: Execute required swaps
      logger.info('🔄 Executing optimal swaps...')
      const { swapsExecuted, finalAllocation } = await executeOptimalSwaps({
        inputTokenAddress,
        optimalTokens,
        allocations,
        usdAmount,
        walletId,
        userAddress,
      })

      logger.info(`Executed ${swapsExecuted.length} swaps successfully`)

      // Step 4: Calculate metrics
      const totalExpectedAPY = finalAllocation.reduce(
        (sum, alloc) => sum + (alloc.expectedAPY * alloc.percentage) / 100,
        0,
      )

      const confidence = Math.min(
        95,
        Math.max(
          70,
          85 -
            (riskTolerance === 'aggressive' ? 10 : 0) +
            swapsExecuted.filter((s) => s.success).length * 5,
        ),
      )

      // Step 5: Generate reasoning
      const reasoning =
        `Based on ${riskTolerance} risk tolerance, allocated across ${SUPPORTED_PROTOCOLS.join(', ')} protocols. ` +
        `Executed ${swapsExecuted.length} swaps to achieve optimal ${finalAllocation.length}-token allocation. ` +
        `Target APY: ${totalExpectedAPY.toFixed(2)}% with risk-adjusted diversification.`

      // Step 6: Prepare final response
      const finalStrategy = {
        swapsExecuted,
        finalAllocation: finalAllocation.map((alloc) => ({
          protocol: alloc.protocol,
          token: alloc.token,
          amount:
            alloc.amount || ((usdAmount * alloc.percentage) / 100).toString(),
          percentage: alloc.percentage,
          expectedAPY: alloc.expectedAPY,
          riskScore: alloc.riskScore,
          chain: alloc.chain,
        })),
        totalExpectedAPY,
        confidence,
        reasoning,
        marketAnalysis,
        timestamp: new Date().toISOString(),
      }

      // Return API response for backend
      const requestType = detectRequestType(message)
      if (requestType === 'api') {
        logger.info('Returning structured API response')
        return finalStrategy
      } else {
        // Conversational response
        const responseText =
          `🎯 **Complete Yield Optimization Executed** 🚀\n\n` +
          `**💰 Investment**: $${usdAmount.toLocaleString()} (${riskTolerance} strategy)\n\n` +
          `**🔄 Swaps Executed** (${swapsExecuted.length}):\n` +
          swapsExecuted
            .map(
              (swap, i) =>
                `${i + 1}. ${swap.inputToken} → ${swap.outputToken}: $${parseFloat(swap.inputAmount).toLocaleString()}\n` +
                `   • Protocol: ${swap.protocol} | APY: ${swap.expectedAPY.toFixed(1)}%\n` +
                `   • ${swap.success ? '✅ Success' : '❌ Failed'} ${swap.txHash ? `| TX: ${swap.txHash.slice(0, 8)}...` : ''}`,
            )
            .join('\n') +
          '\n\n' +
          `**📊 Final Allocation**:\n` +
          finalStrategy.finalAllocation
            .map(
              (alloc, i) =>
                `${i + 1}. **${alloc.protocol}** (${alloc.token}): ${alloc.percentage}% | ${alloc.expectedAPY.toFixed(1)}% APY\n` +
                `   • Amount: $${parseFloat(alloc.amount).toLocaleString()} | Risk: ${alloc.riskScore}/10`,
            )
            .join('\n') +
          '\n\n' +
          `**🎯 Expected Portfolio APY**: ${totalExpectedAPY.toFixed(2)}%\n` +
          `**📈 Confidence**: ${confidence}%\n\n` +
          `**💡 Reasoning**: ${reasoning}\n\n` +
          `⚠️ **Next Steps**: Tokens are ready for protocol deposits on ${finalStrategy.finalAllocation.map((a) => a.protocol).join(', ')}`

        const responseContent: Content = {
          text: responseText,
          actions: ['COMPLETE_YIELD_OPTIMIZATION'],
          source: message.content.source,
        }

        logger.info('Returning conversational response')
        await callback(responseContent)
        return responseContent
      }
    } catch (error) {
      logger.error('Error in complete yield optimization:', error)
      throw error
    }
  },
}
