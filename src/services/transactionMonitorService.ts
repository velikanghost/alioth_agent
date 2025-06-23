import { logger } from '@elizaos/core'
import { createPublicClient, http, formatUnits } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import type {
  TransactionConfirmation,
  FailureAnalysis,
  TransactionRequest,
  TransactionResponse,
} from '../types/interfaces.js'
import { BLOCKCHAIN_CONFIG, createViemClients } from '../config/uniswap.js'

export class TransactionMonitorService {
  private publicClient: any

  constructor() {
    this.setupClients()
  }

  private setupClients() {
    const { publicClient } = createViemClients()
    this.publicClient = publicClient
  }

  // Real-time transaction tracking
  async monitorTransaction(
    txHash: string,
    timeoutMs: number = 300000, // 5 minutes
  ): Promise<TransactionConfirmation> {
    try {
      logger.info(`Monitoring transaction: ${txHash}`)

      const startTime = Date.now()

      while (Date.now() - startTime < timeoutMs) {
        try {
          // Get transaction receipt using viem
          const receipt = await this.publicClient.getTransactionReceipt({
            hash: txHash as `0x${string}`,
          })

          if (receipt) {
            const confirmation: TransactionConfirmation = {
              success: receipt.status === 'success',
              txHash,
              blockNumber: Number(receipt.blockNumber),
              gasUsed: Number(receipt.gasUsed),
              error:
                receipt.status === 'reverted'
                  ? 'Transaction reverted'
                  : undefined,
            }

            logger.info(
              `Transaction ${txHash} ${confirmation.success ? 'confirmed' : 'failed'}`,
            )
            return confirmation
          }
        } catch (error) {
          // Transaction might not be mined yet, continue polling
          logger.debug(
            `Transaction ${txHash} not yet mined, continuing to poll...`,
          )
        }

        // Wait 5 seconds before next check
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }

      // Timeout reached
      throw new Error(`Transaction monitoring timeout after ${timeoutMs}ms`)
    } catch (error) {
      logger.error('Error monitoring transaction:', error)
      return {
        success: false,
        txHash,
        blockNumber: 0,
        gasUsed: 0,
        error: error.message,
      }
    }
  }

  // Failed transaction analysis
  async analyzeFailedTransaction(txHash: string): Promise<FailureAnalysis> {
    try {
      logger.info(`Analyzing failed transaction: ${txHash}`)

      // Get transaction receipt
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      })

      if (!receipt) {
        return {
          reason: 'Transaction not found or not mined',
          gasIssue: false,
          slippageIssue: false,
          liquidityIssue: false,
          suggestedFix: 'Check if transaction was properly submitted',
        }
      }

      // Get original transaction
      const transaction = await this.publicClient.getTransaction({
        hash: txHash as `0x${string}`,
      })

      const analysis: FailureAnalysis = {
        reason: 'Unknown failure',
        gasIssue: false,
        slippageIssue: false,
        liquidityIssue: false,
        suggestedFix: 'Review transaction parameters and try again',
      }

      // Analyze failure reasons
      if (receipt.status === 'reverted') {
        // Check for common failure patterns

        // Gas issues
        if (Number(receipt.gasUsed) >= Number(transaction.gas) * 0.95) {
          analysis.gasIssue = true
          analysis.reason = 'Transaction ran out of gas'
          analysis.suggestedFix = 'Increase gas limit by 20-30%'
        }

        // Try to get revert reason (simplified)
        try {
          // This would normally decode the revert reason from logs
          // For now, provide generic analysis
          if (transaction.to && transaction.input?.includes('swapExact')) {
            analysis.slippageIssue = true
            analysis.reason = 'Likely slippage or insufficient output amount'
            analysis.suggestedFix =
              'Increase slippage tolerance or reduce trade size'
          }
        } catch (decodeError) {
          logger.warn('Could not decode revert reason:', decodeError)
        }

        // Check for potential liquidity issues based on gas usage patterns
        if (Number(receipt.gasUsed) < Number(transaction.gas) * 0.5) {
          analysis.liquidityIssue = true
          analysis.reason = 'Possible insufficient liquidity'
          analysis.suggestedFix =
            'Check pool liquidity or try smaller trade size'
        }
      }

      logger.info(`Analysis complete: ${analysis.reason}`)
      return analysis
    } catch (error) {
      logger.error('Error analyzing failed transaction:', error)
      return {
        reason: `Analysis failed: ${error.message}`,
        gasIssue: false,
        slippageIssue: false,
        liquidityIssue: false,
        suggestedFix: 'Manual investigation required',
      }
    }
  }

  // Automatic retry with adjusted parameters
  async retryFailedTransaction(
    originalTx: TransactionRequest,
    failure: FailureAnalysis,
  ): Promise<TransactionRequest> {
    try {
      logger.info('Generating retry transaction with adjusted parameters')

      const retryTx: TransactionRequest = { ...originalTx }

      // Adjust based on failure analysis
      if (failure.gasIssue) {
        // Increase gas limit by 30%
        const originalGas = Number(originalTx.gasLimit || '200000')
        retryTx.gasLimit = Math.round(originalGas * 1.3).toString()
        logger.info(
          `Increased gas limit from ${originalGas} to ${retryTx.gasLimit}`,
        )
      }

      if (failure.slippageIssue) {
        // This would require rebuilding the transaction with higher slippage
        // For now, just log the recommendation
        logger.info(
          'Slippage issue detected - transaction needs to be rebuilt with higher slippage tolerance',
        )
      }

      if (failure.liquidityIssue) {
        // This would require reducing the trade size
        // For now, just log the recommendation
        logger.info('Liquidity issue detected - consider reducing trade size')
      }

      // Increase gas price for faster mining
      if (originalTx.gasPrice) {
        const originalPrice = Number(originalTx.gasPrice)
        retryTx.gasPrice = Math.round(originalPrice * 1.2).toString()
      } else if (originalTx.maxFeePerGas) {
        const originalMaxFee = Number(originalTx.maxFeePerGas)
        retryTx.maxFeePerGas = Math.round(originalMaxFee * 1.2).toString()
      }

      return retryTx
    } catch (error) {
      logger.error('Error generating retry transaction:', error)
      throw new Error(`Failed to generate retry transaction: ${error.message}`)
    }
  }

  // Check if transaction is likely to succeed
  async validateTransactionWillSucceed(
    transaction: TransactionRequest,
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      // Basic validation
      if (!transaction.to || !transaction.data) {
        return { valid: false, reason: 'Invalid transaction structure' }
      }

      // In a full implementation, this would simulate the transaction
      // using eth_call to check if it would succeed
      // For now, return basic validation
      return { valid: true }
    } catch (error) {
      logger.error('Error validating transaction:', error)
      return { valid: false, reason: `Validation failed: ${error.message}` }
    }
  }

  // Get current network gas prices
  async getCurrentGasPrices(): Promise<{
    slow: string
    standard: string
    fast: string
  }> {
    try {
      // Get current gas price using viem
      const gasPrice = await this.publicClient.getGasPrice()
      const basePrice = Number(gasPrice)

      return {
        slow: Math.round(basePrice * 0.8).toString(),
        standard: basePrice.toString(),
        fast: Math.round(basePrice * 1.2).toString(),
      }
    } catch (error) {
      logger.error('Error getting gas prices:', error)
      // Return default gas prices
      return {
        slow: '20000000000', // 20 gwei
        standard: '25000000000', // 25 gwei
        fast: '30000000000', // 30 gwei
      }
    }
  }
}

// Export singleton instance
export const transactionMonitorService = new TransactionMonitorService()
