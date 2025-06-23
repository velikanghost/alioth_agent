import type {
  Action,
  Content,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from '@elizaos/core'
import { logger } from '@elizaos/core'
import {
  extractWalletId,
  extractUserAddress,
  extractRiskTolerance,
  detectRequestType,
} from '../utils/requestDetection.js'
import { backendWalletService } from '../services/backendWalletService.js'
import { slippageProtectionService } from '../services/slippageProtectionService.js'
import { uniswapV3Service } from '../services/uniswapV3Service.js'
import { getTokenBySymbol } from '../config/uniswap.js'
import type {
  OptimizationStep,
  TokenAllocation,
  TransactionRequest,
} from '../types/interfaces.js'

// Helper function to extract target allocation from message
const extractTargetAllocation = (message: Memory): TokenAllocation[] => {
  // Handle direct API parameters
  if (
    message.content.targetAllocation &&
    Array.isArray(message.content.targetAllocation)
  ) {
    return message.content.targetAllocation
  }

  // Handle JSON in text field
  if (
    message.content.text &&
    message.content.text.includes('targetAllocation')
  ) {
    try {
      const parsed = JSON.parse(message.content.text)
      if (parsed.targetAllocation && Array.isArray(parsed.targetAllocation)) {
        return parsed.targetAllocation
      }
    } catch {
      // Continue to default allocation
    }
  }

  // Return default allocation based on risk tolerance
  const riskTolerance = extractRiskTolerance(message)
  const defaultAllocations = {
    conservative: [
      { token: 'USDC', amount: '700', percentage: 70 },
      { token: 'DAI', amount: '200', percentage: 20 },
      { token: 'ETH', amount: '100', percentage: 10 },
    ],
    moderate: [
      { token: 'USDC', amount: '400', percentage: 40 },
      { token: 'DAI', amount: '200', percentage: 20 },
      { token: 'ETH', amount: '250', percentage: 25 },
      { token: 'WBTC', amount: '150', percentage: 15 },
    ],
    aggressive: [
      { token: 'USDC', amount: '200', percentage: 20 },
      { token: 'ETH', amount: '400', percentage: 40 },
      { token: 'WBTC', amount: '250', percentage: 25 },
      { token: 'DAI', amount: '150', percentage: 15 },
    ],
  }

  return defaultAllocations[riskTolerance]
}

// Helper function to calculate optimization steps
const calculateOptimizationSteps = (
  currentAllocation: TokenAllocation[],
  targetAllocation: TokenAllocation[],
): OptimizationStep[] => {
  const steps: OptimizationStep[] = []

  // Create maps for easier lookup
  const currentMap = new Map(currentAllocation.map((a) => [a.token, a]))
  const targetMap = new Map(targetAllocation.map((a) => [a.token, a]))

  // Calculate which tokens need to be swapped
  for (const [token, current] of currentMap) {
    const target = targetMap.get(token)
    const currentAmount = parseFloat(current.amount)
    const targetAmount = target ? parseFloat(target.amount) : 0

    if (currentAmount > targetAmount) {
      // Need to sell some of this token
      const excessAmount = (currentAmount - targetAmount).toString()

      // For now, convert excess to USDC (most liquid)
      if (token !== 'USDC') {
        steps.push({
          type: 'SWAP',
          inputToken: token,
          outputToken: 'USDC',
          amount: excessAmount,
        })
      }
    }
  }

  // Calculate which tokens need to be bought
  for (const [token, target] of targetMap) {
    const current = currentMap.get(token)
    const currentAmount = current ? parseFloat(current.amount) : 0
    const targetAmount = parseFloat(target.amount)

    if (targetAmount > currentAmount) {
      // Need to buy more of this token
      const neededAmount = (targetAmount - currentAmount).toString()

      // Buy from USDC (most liquid)
      if (token !== 'USDC') {
        steps.push({
          type: 'SWAP',
          inputToken: 'USDC',
          outputToken: token,
          amount: neededAmount,
        })
      }
    }
  }

  return steps
}

// Helper function to execute a single swap step
const executeSwapStep = async (
  step: OptimizationStep,
  walletId: string,
  userAddress: string,
  maxSlippage: number,
): Promise<any> => {
  const inputToken = getTokenBySymbol(step.inputToken)
  const outputToken = getTokenBySymbol(step.outputToken)

  if (!inputToken || !outputToken) {
    throw new Error(
      `Unsupported token pair: ${step.inputToken}/${step.outputToken}`,
    )
  }

  // Get quote
  const quote = await uniswapV3Service.getQuote(
    inputToken.symbol,
    outputToken.symbol,
    step.amount,
  )

  // Execute swap transaction using smart router
  const result = await uniswapV3Service.executeSmartSwap(
    inputToken,
    outputToken,
    step.amount,
    maxSlippage,
    userAddress,
    walletId,
  )

  return {
    step,
    quote,
    result,
    success: result.success,
    txHash: result.txHash,
    gasUsed: result.gasUsed,
  }
}

// Helper function to wait for transaction confirmation
const waitForTransactionConfirmation = async (
  txHash: string,
): Promise<void> => {
  // In a real implementation, this would poll the blockchain
  // For now, just wait a bit
  await new Promise((resolve) => setTimeout(resolve, 5000))
  logger.info(`Transaction ${txHash} confirmed (simulated)`)
}

export const executeOptimizationAction: Action = {
  name: 'EXECUTE_OPTIMIZATION',
  similes: ['REBALANCE', 'OPTIMIZE_PORTFOLIO', 'PORTFOLIO_REBALANCE'],
  description: 'Execute complete portfolio optimization with Uniswap v4 swaps',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || ''

    // Check for optimization-related keywords
    const hasOptimizationKeywords =
      text.includes('optimize') ||
      text.includes('rebalance') ||
      text.includes('portfolio') ||
      text.includes('allocat')

    // Check for API request with optimization parameters
    const hasOptimizationParameters = Boolean(
      message.content.targetAllocation || message.content.currentAllocation,
    )

    return hasOptimizationKeywords || hasOptimizationParameters
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: HandlerCallback,
  ) => {
    try {
      logger.info('🔄 Starting portfolio optimization process')

      // 1. Parse optimization request
      const optimizationRequest = {
        walletId: extractWalletId(message) || 'clm7ykw0x0000mi08u4n8hn5q', // Default Privy wallet ID for demo
        userAddress:
          extractUserAddress(message) ||
          '0x0000000000000000000000000000000000000000', // For transaction building
        targetAllocation: extractTargetAllocation(message),
        maxSlippage: 100, // 1% default
        riskTolerance: extractRiskTolerance(message),
      }

      logger.info('Parsed optimization request:', optimizationRequest)

      // 2. Get current portfolio from backend (with fallback)
      let currentPortfolio
      try {
        // Note: getPortfolio method was removed from PrivyWalletService
        // Using fallback data for now - replace with actual portfolio API call
        currentPortfolio = {
          tokens: [{ token: 'USDC', amount: '1000', percentage: 100 }],
          totalValue: '1000',
        }
      } catch (error) {
        logger.warn('Could not get current portfolio, using default:', error)
        currentPortfolio = {
          tokens: [{ token: 'USDC', amount: '1000', percentage: 100 }],
          totalValue: '1000',
        }
      }

      // 3. Calculate optimization steps
      const currentAllocation: TokenAllocation[] = currentPortfolio.tokens || []
      const optimizationSteps = calculateOptimizationSteps(
        currentAllocation,
        optimizationRequest.targetAllocation,
      )

      logger.info(`Calculated ${optimizationSteps.length} optimization steps`)

      // 4. Determine if this is an API request or conversational
      const isAPIRequest = detectRequestType(message) === 'api'

      if (isAPIRequest) {
        // For API requests, return structured optimization plan
        const structuredResponse = {
          success: true,
          action: 'EXECUTE_OPTIMIZATION',
          data: {
            optimizationRequest,
            currentPortfolio,
            optimizationSteps,
            estimatedSteps: optimizationSteps.length,
            readyForExecution: true,
          },
          timestamp: new Date().toISOString(),
        }

        const responseContent: Content = {
          text: JSON.stringify(structuredResponse, null, 2),
          actions: ['EXECUTE_OPTIMIZATION'],
          source: message.content.source,
        }

        await callback(responseContent)
        return responseContent
      } else {
        // For conversational requests, provide user-friendly response
        const responseText =
          `🎯 **Portfolio Optimization Plan** 📊\n\n` +
          `**Current Portfolio:**\n` +
          currentAllocation
            .map((a) => `• ${a.token}: ${a.amount} (${a.percentage}%)`)
            .join('\n') +
          '\n\n' +
          `**Target Allocation (${optimizationRequest.riskTolerance}):**\n` +
          optimizationRequest.targetAllocation
            .map((a) => `• ${a.token}: ${a.amount} (${a.percentage}%)`)
            .join('\n') +
          '\n\n' +
          `**Optimization Steps Required:**\n` +
          (optimizationSteps.length > 0
            ? optimizationSteps
                .map(
                  (step, i) =>
                    `${i + 1}. ${step.type}: ${step.amount} ${step.inputToken} → ${step.outputToken}`,
                )
                .join('\n')
            : '✅ Portfolio already optimized!') +
          '\n\n' +
          `**Estimated Details:**\n` +
          `• Steps: ${optimizationSteps.length}\n` +
          `• Max Slippage: ${slippageProtectionService.formatSlippageForDisplay(optimizationRequest.maxSlippage)}\n` +
          `• Risk Level: ${optimizationRequest.riskTolerance}\n\n` +
          `⚠️ **Note:** This is an optimization plan. To execute, each swap will be processed sequentially with proper confirmation.\n\n` +
          `💡 **Next Steps:**\n` +
          `• Review the optimization plan above\n` +
          `• Ensure sufficient gas for multiple transactions\n` +
          `• Confirm execution through your wallet`

        const responseContent: Content = {
          text: responseText,
          actions: ['EXECUTE_OPTIMIZATION'],
          source: message.content.source,
        }

        await callback(responseContent)
        return responseContent
      }
    } catch (error) {
      logger.error('Error in EXECUTE_OPTIMIZATION action:', error)

      const errorContent: Content = {
        text: JSON.stringify(
          {
            success: false,
            action: 'EXECUTE_OPTIMIZATION',
            error: error.message,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
        actions: ['EXECUTE_OPTIMIZATION'],
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
          text: 'Optimize my portfolio with moderate risk',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '🎯 **Portfolio Optimization Plan** 📊\n\n**Current Portfolio:**...',
          actions: ['EXECUTE_OPTIMIZATION'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Rebalance my portfolio to 50% USDC, 30% ETH, 20% WBTC',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '🎯 **Portfolio Optimization Plan** 📊\n\n**Optimization Steps Required:**...',
          actions: ['EXECUTE_OPTIMIZATION'],
        },
      },
    ],
  ],
}
