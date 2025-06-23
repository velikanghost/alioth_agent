import type { Memory } from '@elizaos/core'
import type { RequestType, ParsedMessage } from '../types/interfaces.js'

/**
 * Utility to check if a string is valid JSON
 */
export const isValidJSON = (text: string): boolean => {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

/**
 * Detects whether a message is from API or conversational interface
 */
export const detectRequestType = (message: Memory): RequestType => {
  // API request indicators
  const hasStructuredFlag = message.content.structured === true
  const hasAPIParameters =
    message.content.inputToken && message.content.inputAmount
  const isJSONFormat = message.content.text && isValidJSON(message.content.text)

  if (hasStructuredFlag || hasAPIParameters || isJSONFormat) {
    return 'api'
  }

  return 'conversational'
}

/**
 * Extracts input token from both API and conversational requests
 */
export const extractInputToken = (message: Memory): string => {
  // Handle direct API parameters
  if (
    message.content.inputToken &&
    typeof message.content.inputToken === 'string'
  )
    return message.content.inputToken

  // Handle JSON in text field
  if (message.content.text && isValidJSON(message.content.text)) {
    try {
      const parsed = JSON.parse(message.content.text)
      if (parsed.inputToken && typeof parsed.inputToken === 'string')
        return parsed.inputToken
    } catch {
      // Continue to natural language extraction
    }
  }

  // Extract from natural language
  const text = message.content.text?.toLowerCase() || ''
  if (text.includes('usdc')) return 'USDC'
  if (text.includes('dai')) return 'DAI'
  if (text.includes('usdt')) return 'USDT'
  if (text.includes('eth')) return 'ETH'
  if (text.includes('wbtc')) return 'WBTC'

  return 'USDC' // Conservative default
}

/**
 * Extracts output token from both API and conversational requests (for swaps)
 */
export const extractOutputToken = (message: Memory): string => {
  // Handle direct API parameters
  if (
    message.content.outputToken &&
    typeof message.content.outputToken === 'string'
  )
    return message.content.outputToken

  // Handle JSON in text field
  if (message.content.text && isValidJSON(message.content.text)) {
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

  // Look for "swap X for Y" patterns
  const swapForMatch = text.match(
    /swap\s+\w+\s+for\s+(usdc|dai|usdt|eth|weth|wbtc)/i,
  )
  if (swapForMatch) return swapForMatch[1].toUpperCase()

  return 'ETH' // Default fallback
}

/**
 * Extracts input amount from both API and conversational requests
 */
export const extractInputAmount = (message: Memory): string => {
  // Handle new API format with usdAmount
  if (
    message.content.usdAmount &&
    typeof message.content.usdAmount === 'number'
  )
    return message.content.usdAmount.toString()

  // Handle direct API parameters (old format)
  if (
    message.content.inputAmount &&
    typeof message.content.inputAmount === 'string'
  )
    return message.content.inputAmount

  // Handle JSON in text field
  if (message.content.text && isValidJSON(message.content.text)) {
    try {
      const parsed = JSON.parse(message.content.text)
      if (parsed.inputAmount && typeof parsed.inputAmount === 'string')
        return parsed.inputAmount
    } catch {
      // Continue to natural language extraction
    }
  }

  // Extract from natural language - look for numbers
  const text = message.content.text || ''
  const numberMatch = text.match(/(\d+(?:,\d{3})*(?:\.\d+)?)/g)
  if (numberMatch && numberMatch.length > 0) {
    // Remove commas and return the first number found
    return numberMatch[0].replace(/,/g, '')
  }

  return '1000' // Default amount
}

/**
 * Extracts risk tolerance from both API and conversational requests
 */
export const extractRiskTolerance = (
  message: Memory,
): 'conservative' | 'moderate' | 'aggressive' => {
  // Handle direct API parameters
  if (
    message.content.riskTolerance &&
    typeof message.content.riskTolerance === 'string' &&
    ['conservative', 'moderate', 'aggressive'].includes(
      message.content.riskTolerance,
    )
  ) {
    return message.content.riskTolerance as
      | 'conservative'
      | 'moderate'
      | 'aggressive'
  }

  // Handle JSON in text field
  if (message.content.text && isValidJSON(message.content.text)) {
    try {
      const parsed = JSON.parse(message.content.text)
      if (
        parsed.riskTolerance &&
        (parsed.riskTolerance === 'conservative' ||
          parsed.riskTolerance === 'moderate' ||
          parsed.riskTolerance === 'aggressive')
      ) {
        return parsed.riskTolerance
      }
    } catch {
      // Continue to natural language extraction
    }
  }

  // Extract from natural language
  const text = message.content.text?.toLowerCase() || ''
  if (
    text.includes('conservative') ||
    text.includes('safe') ||
    text.includes('low risk')
  ) {
    return 'conservative'
  }
  if (
    text.includes('aggressive') ||
    text.includes('risky') ||
    text.includes('high risk') ||
    text.includes('yolo')
  ) {
    return 'aggressive'
  }

  return 'moderate' // Conservative default
}

/**
 * Extracts protocol name from both API and conversational requests
 */
export const extractProtocolName = (message: Memory): string => {
  // Handle direct API parameters
  if (message.content.protocol && typeof message.content.protocol === 'string')
    return message.content.protocol

  // Handle JSON in text field
  if (message.content.text && isValidJSON(message.content.text)) {
    try {
      const parsed = JSON.parse(message.content.text)
      if (parsed.protocol) return parsed.protocol
    } catch {
      // Continue to natural language extraction
    }
  }

  // Extract from natural language
  const text = message.content.text?.toLowerCase() || ''

  // Check for specific protocol mentions
  if (text.includes('aave')) return 'Aave'
  if (text.includes('compound')) return 'Compound'
  if (text.includes('uniswap')) return 'Uniswap'
  if (text.includes('curve')) return 'Curve'
  if (text.includes('convex')) return 'Convex'
  if (text.includes('lido')) return 'Lido'
  if (text.includes('yearn')) return 'Yearn'
  if (text.includes('makerdao') || text.includes('maker')) return 'MakerDAO'

  return '' // No specific protocol mentioned
}

/**
 * Extract wallet ID from message
 */
export const extractWalletId = (message: Memory): string | undefined => {
  // Handle direct API parameters
  if (
    message.content.walletId &&
    typeof message.content.walletId === 'string'
  ) {
    return message.content.walletId
  }

  // Handle JSON in text field
  if (message.content.text && message.content.text.includes('walletId')) {
    try {
      const parsed = JSON.parse(message.content.text)
      if (parsed.walletId && typeof parsed.walletId === 'string') {
        return parsed.walletId
      }
    } catch {
      // Continue to natural language extraction
    }
  }

  // Extract from natural language
  const text = message.content.text?.toLowerCase() || ''
  const walletMatch = text.match(/wallet[:\s]+([a-zA-Z0-9_-]+)/i)
  if (walletMatch) return walletMatch[1]

  return undefined
}

/**
 * Extract user address from message
 */
export const extractUserAddress = (message: Memory): string | undefined => {
  // Handle direct API parameters
  if (
    message.content.userAddress &&
    typeof message.content.userAddress === 'string'
  ) {
    return message.content.userAddress
  }

  // Handle JSON in text field
  if (message.content.text && message.content.text.includes('userAddress')) {
    try {
      const parsed = JSON.parse(message.content.text)
      if (parsed.userAddress && typeof parsed.userAddress === 'string') {
        return parsed.userAddress
      }
    } catch {
      // Continue to natural language extraction
    }
  }

  // Extract from natural language (Ethereum address pattern)
  const text = message.content.text || ''
  const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/i)
  if (addressMatch) return addressMatch[1]

  return undefined
}

/**
 * Extracts slippage tolerance from message (in basis points)
 */
export const extractSlippageTolerance = (message: Memory): number => {
  // Handle direct API parameters
  if (
    message.content.slippageTolerance &&
    typeof message.content.slippageTolerance === 'number'
  )
    return message.content.slippageTolerance

  // Handle JSON in text field
  if (message.content.text && isValidJSON(message.content.text)) {
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

/**
 * Comprehensive message parsing that extracts all relevant information
 */
export const parseMessage = (message: Memory): ParsedMessage => {
  return {
    requestType: detectRequestType(message),
    inputToken: extractInputToken(message),
    inputAmount: extractInputAmount(message),
    riskTolerance: extractRiskTolerance(message),
    protocolName: extractProtocolName(message),
    userAddress: extractUserAddress(message),
  }
}
