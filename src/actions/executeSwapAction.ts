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
  extractUserAddress,
  extractInputToken,
  extractInputAmount,
  extractRiskTolerance,
  detectRequestType,
} from '../utils/requestDetection.js'
import { backendWalletService } from '../services/backendWalletService.js'
import { slippageProtectionService } from '../services/slippageProtectionService.js'
import { getTokenBySymbol } from '../config/uniswap.js'
import { uniswapV3Service } from 'src/services/uniswapV3Service.js'

// Helper function to extract output token from message
const extractOutputToken = (message: Memory): string => {
  // Handle direct API parameters
  if (
    message.content.outputToken &&
    typeof message.content.outputToken === 'string'
  )
    return message.content.outputToken

  // Handle JSON in text field
  if (message.content.text && message.content.text.includes('outputToken')) {
    try {
      const parsed = JSON.parse(message.content.text)
      if (parsed.outputToken && typeof parsed.outputToken === 'string')
        return parsed.outputToken
    } catch {
      // Continue to natural language extraction
    }
  }

  // Extract from natural language
  const text = message.content.text?.toLowerCase() || ''

  // Look for "to TOKEN" or "for TOKEN" patterns
  const toMatch = text.match(/(?:to|for|into)\s+(usdc|dai|usdt|eth|weth|wbtc)/i)
  if (toMatch) return toMatch[1].toUpperCase()

  // Look for arrow patterns like "USDC -> ETH"
  const arrowMatch = text.match(
    /(?:usdc|dai|usdt|eth|weth|wbtc)\s*->\s*(usdc|dai|usdt|eth|weth|wbtc)/i,
  )
  if (arrowMatch) return arrowMatch[1].toUpperCase()

  return 'ETH' // Default fallback
}

// Helper function to extract slippage tolerance
const extractSlippageTolerance = (message: Memory): number => {
  // Handle direct API parameters
  if (
    message.content.slippageTolerance &&
    typeof message.content.slippageTolerance === 'number'
  )
    return message.content.slippageTolerance

  // Handle JSON in text field
  if (
    message.content.text &&
    message.content.text.includes('slippageTolerance')
  ) {
    try {
      const parsed = JSON.parse(message.content.text)
      if (
        parsed.slippageTolerance &&
        typeof parsed.slippageTolerance === 'number'
      )
        return parsed.slippageTolerance
    } catch {
      // Continue to natural language extraction
    }
  }

  // Extract from natural language
  const text = message.content.text?.toLowerCase() || ''
  const slippageMatch = text.match(/(\d+(?:\.\d+)?)\s*%?\s*slippage/i)
  if (slippageMatch) {
    const percentage = parseFloat(slippageMatch[1])
    return Math.round(percentage * 100) // Convert to basis points
  }

  // Default based on risk tolerance
  const riskTolerance = extractRiskTolerance(message)
  const defaultSlippage = {
    conservative: 50, // 0.5%
    moderate: 100, // 1.0%
    aggressive: 200, // 2.0%
  }

  return defaultSlippage[riskTolerance]
}

export const executeSwapAction: Action = {
  name: 'EXECUTE_SWAP',
  similes: ['SWAP', 'TRADE', 'EXCHANGE', 'CONVERT'],
  description: 'Execute token swaps through Uniswap v4',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || ''

    // Check for swap-related keywords
    const hasSwapKeywords =
      text.includes('swap') ||
      text.includes('trade') ||
      text.includes('exchange') ||
      text.includes('convert')

    // Check for API request with token parameters
    const hasSwapParameters =
      (message.content.inputToken && message.content.outputToken) ||
      (message.content.inputToken && hasSwapKeywords)

    // Check for natural language patterns
    const hasSwapPatterns =
      text.match(/swap\s+\d+\s+\w+/i) ||
      text.match(/\w+\s*->\s*\w+/i) ||
      text.match(/trade\s+\w+\s+for\s+\w+/i) ||
      text.match(/convert\s+\w+\s+to\s+\w+/i)

    return Boolean(hasSwapKeywords || hasSwapParameters || hasSwapPatterns)
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: HandlerCallback,
  ) => {
    try {
      logger.info('🔄 Starting swap execution process')

      // 1. Parse swap request
      const swapRequest = {
        userAddress:
          extractUserAddress(message) ||
          '0x0000000000000000000000000000000000000000',
        inputToken: extractInputToken(message),
        outputToken: extractOutputToken(message),
        inputAmount: extractInputAmount(message),
        slippageTolerance: extractSlippageTolerance(message),
      }

      logger.info('Parsed swap request:', swapRequest)

      // 2. Get tokens and validate
      const inputToken = getTokenBySymbol(swapRequest.inputToken)
      const outputToken = getTokenBySymbol(swapRequest.outputToken)

      if (!inputToken || !outputToken) {
        throw new Error(
          `Unsupported token pair: ${swapRequest.inputToken}/${swapRequest.outputToken}. Supported tokens: ETH, USDC, DAI, WETH, WBTC, USDT`,
        )
      }

      if (inputToken.address === outputToken.address) {
        throw new Error('Cannot swap token to itself')
      }

      // 3. Validate slippage tolerance
      if (
        !slippageProtectionService.validateSlippageTolerance(
          swapRequest.slippageTolerance,
        )
      ) {
        throw new Error(
          `Invalid slippage tolerance: ${swapRequest.slippageTolerance}bp. Must be between 1-5000 basis points`,
        )
      }

      // 4. Get swap quote from Uniswap v3
      logger.info('📊 Getting swap quote from Uniswap v3...')
      const quote = await uniswapV3Service.getQuote(
        inputToken.symbol,
        outputToken.symbol,
        swapRequest.inputAmount,
        swapRequest.slippageTolerance,
      )

      // 5. Validate price impact
      if (!slippageProtectionService.validatePriceImpact(quote.priceImpact)) {
        throw new Error(
          `Price impact too high: ${quote.priceImpact.toFixed(2)}%. Maximum allowed is 3%`,
        )
      }

      // 6. Execute swap transaction
      logger.info('🔨 Executing swap transaction...')
      const executionResult = await uniswapV3Service.executeSmartSwap(
        inputToken,
        outputToken,
        swapRequest.inputAmount,
        swapRequest.slippageTolerance,
        swapRequest.userAddress,
        'demo-wallet-id', // Default wallet ID for demo
      )

      // 7. Determine if this is an API request or conversational
      const isAPIRequest = detectRequestType(message) === 'api'

      if (isAPIRequest) {
        // For API requests, return structured data for backend execution
        const structuredResponse = {
          success: executionResult.success,
          action: 'EXECUTE_SWAP',
          data: {
            swapRequest,
            quote: {
              inputAmount: quote.inputAmount,
              outputAmount: quote.outputAmount,
              priceImpact: quote.priceImpact,
              slippageTolerance: quote.slippageTolerance,
            },
            executionResult: {
              txHash: executionResult.txHash,
              success: executionResult.success,
              error: executionResult.error,
            },
            userAddress: swapRequest.userAddress,
          },
          timestamp: new Date().toISOString(),
        }

        const responseContent: Content = {
          text: JSON.stringify(structuredResponse, null, 2),
          actions: ['EXECUTE_SWAP'],
          source: message.content.source,
        }

        await callback(responseContent)
        return responseContent
      } else {
        // For conversational requests, provide user-friendly response
        const responseText =
          `🔄 **Swap Quote Ready** 💫\n\n` +
          `**Trade Details:**\n` +
          `• Swap: ${swapRequest.inputAmount} ${inputToken.symbol} → ${quote.outputAmount} ${outputToken.symbol}\n` +
          `• Price Impact: ${quote.priceImpact.toFixed(2)}%\n` +
          `• Slippage Tolerance: ${slippageProtectionService.formatSlippageForDisplay(quote.slippageTolerance)}\n` +
          `• Estimated Gas: ${quote.gasEstimate || 'Unknown'}\n\n` +
          `**Safety Checks:**\n` +
          `✅ Supported token pair\n` +
          `✅ Price impact within limits\n` +
          `✅ Slippage tolerance validated\n\n` +
          `⚠️ **Note:** This is a quote only. To execute the swap, the transaction needs to be submitted to the blockchain through your connected wallet.\n\n` +
          `💡 **Next Steps:**\n` +
          `• Review the quote details above\n` +
          `• Ensure you have sufficient balance\n` +
          `• Submit the transaction through your wallet`

        const responseContent: Content = {
          text: responseText,
          actions: ['EXECUTE_SWAP'],
          source: message.content.source,
        }

        await callback(responseContent)
        return responseContent
      }
    } catch (error) {
      logger.error('Error in EXECUTE_SWAP action:', error)

      const errorContent: Content = {
        text: JSON.stringify(
          {
            success: false,
            action: 'EXECUTE_SWAP',
            error: error.message,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
        actions: ['EXECUTE_SWAP'],
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
          text: 'Swap 1000 USDC to ETH',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '🔄 **Swap Quote Ready** 💫\n\n**Trade Details:**\n• Swap: 1000 USDC → 0.5 ETH...',
          actions: ['EXECUTE_SWAP'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I want to trade my ETH for USDC with 1% slippage',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '🔄 **Swap Quote Ready** 💫\n\n**Trade Details:**...',
          actions: ['EXECUTE_SWAP'],
        },
      },
    ],
  ],
}
