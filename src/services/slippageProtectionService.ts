import { formatUnits, parseUnits } from 'viem'
import { logger } from '@elizaos/core'

export class SlippageProtectionService {
  // Calculate minimum output amount with slippage tolerance
  calculateMinOutputAmount(
    expectedOutput: string,
    slippageTolerance: number, // in basis points (e.g., 50 = 0.5%)
  ): string {
    try {
      const expectedOutputBN = BigInt(expectedOutput)
      const slippageAmount =
        (expectedOutputBN * BigInt(slippageTolerance)) / BigInt(10000)
      const minOutput = expectedOutputBN - slippageAmount

      return minOutput.toString()
    } catch (error) {
      logger.error('Error calculating min output amount:', error)
      throw new Error(
        `Failed to calculate minimum output amount: ${error.message}`,
      )
    }
  }

  // Calculate price impact
  calculatePriceImpact(
    inputAmount: string,
    outputAmount: string,
    marketPrice: string,
  ): number {
    try {
      const inputAmountBN = BigInt(inputAmount)
      const outputAmountBN = BigInt(outputAmount)
      const marketPriceBN = BigInt(marketPrice)

      // Expected output based on market price
      const expectedOutput = inputAmountBN * marketPriceBN

      // Avoid division by zero
      if (expectedOutput === BigInt(0)) {
        return 0
      }

      // Calculate price impact as percentage
      const impact =
        ((expectedOutput - outputAmountBN) * BigInt(10000)) / expectedOutput

      return Number(impact) / 100 // Convert to percentage
    } catch (error) {
      logger.error('Error calculating price impact:', error)
      return 0 // Return 0 impact on calculation error
    }
  }

  // Simplified price impact calculation for single swap
  calculateSimplePriceImpact(
    inputAmount: string,
    outputAmount: string,
    inputDecimals: number = 18,
    outputDecimals: number = 18,
  ): number {
    try {
      // Convert to normalized values for comparison
      const inputNormalized = Number(
        formatUnits(BigInt(inputAmount), inputDecimals),
      )
      const outputNormalized = Number(
        formatUnits(BigInt(outputAmount), outputDecimals),
      )

      // Simple price impact calculation based on AMM curve
      // This is a simplified version - real calculation would need pool reserves
      const ratio = outputNormalized / inputNormalized

      // If ratio is significantly different from 1:1, there's price impact
      // This is a placeholder - real implementation would use pool data
      const expectedRatio = 1.0 // This should be fetched from external price feed
      const impact = Math.abs(1 - ratio / expectedRatio) * 100

      return Math.min(impact, 100) // Cap at 100%
    } catch (error) {
      logger.error('Error calculating simple price impact:', error)
      return 0
    }
  }

  // Validate acceptable price impact
  validatePriceImpact(
    priceImpact: number,
    maxPriceImpact: number = 3, // 3% default max
  ): boolean {
    return priceImpact <= maxPriceImpact
  }

  // Calculate deadline timestamp
  calculateDeadline(minutesFromNow: number = 20): number {
    return Math.floor(Date.now() / 1000) + minutesFromNow * 60
  }

  // Validate slippage tolerance
  validateSlippageTolerance(slippageTolerance: number): boolean {
    // Slippage should be between 0.01% (1 basis point) and 50% (5000 basis points)
    return slippageTolerance >= 1 && slippageTolerance <= 5000
  }

  // Adjust slippage based on market conditions
  adjustSlippageForMarketConditions(
    baseSlippage: number,
    marketVolatility: 'low' | 'medium' | 'high' = 'medium',
  ): number {
    const adjustments = {
      low: 1.0, // No adjustment
      medium: 1.2, // 20% increase
      high: 1.5, // 50% increase
    }

    const adjustedSlippage = Math.round(
      baseSlippage * adjustments[marketVolatility],
    )

    // Ensure it doesn't exceed reasonable limits
    return Math.min(adjustedSlippage, 1000) // Max 10%
  }

  // Format slippage for display
  formatSlippageForDisplay(slippageBasisPoints: number): string {
    const percentage = slippageBasisPoints / 100
    return `${percentage.toFixed(2)}%`
  }
}

// Export singleton instance
export const slippageProtectionService = new SlippageProtectionService()
