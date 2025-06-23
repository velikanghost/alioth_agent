import { logger } from '@elizaos/core'
import { PrivyClient } from '@privy-io/server-auth'
import type {
  WalletInfo,
  TransactionRequest,
  TransactionResponse,
  BatchTransactionResponse,
} from '../types/interfaces.js'

// Initialize Privy client
const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID || '',
  process.env.PRIVY_APP_SECRET || '',
)

export interface BackendWalletService {
  // Execute transaction directly via Privy
  executeTransaction(
    walletId: string,
    transaction: TransactionRequest,
  ): Promise<TransactionResponse>

  // Execute batch transactions
  executeBatchTransactions(
    walletId: string,
    transactions: TransactionRequest[],
  ): Promise<BatchTransactionResponse>
}

// Implementation using Privy's server SDK
export class PrivyWalletService implements BackendWalletService {
  private privy: PrivyClient
  private chainId: number

  constructor(privyClient: PrivyClient, chainId: number = 1) {
    this.privy = privyClient
    this.chainId = chainId
  }

  async executeTransaction(
    walletId: string,
    transaction: TransactionRequest,
  ): Promise<TransactionResponse> {
    try {
      logger.info(`Executing transaction for Privy wallet: ${walletId}`)
      logger.info(`Transaction details:`, {
        to: transaction.to,
        value: transaction.value,
        dataLength: transaction.data?.length || 0,
      })

      // Execute directly via Privy's wallet API - using your exact syntax
      const data = await this.privy.walletApi.ethereum.sendTransaction({
        walletId,
        caip2: `eip155:${this.chainId}`,
        transaction: {
          to: transaction.to as `0x${string}`,
          //value: transaction.value || '0x0',
          data: transaction.data as `0x${string}`,
          chainId: this.chainId,
        },
      })

      const { hash } = data

      return {
        success: true,
        txHash: hash,
        gasUsed: undefined, // Privy doesn't return gas used immediately
        error: undefined,
      }
    } catch (error) {
      logger.error('Error executing transaction via Privy:', error)
      return {
        success: false,
        txHash: '',
        error: error.message,
      }
    }
  }

  async executeBatchTransactions(
    walletId: string,
    transactions: TransactionRequest[],
  ): Promise<BatchTransactionResponse> {
    try {
      logger.info(
        `Executing batch of ${transactions.length} transactions for Privy wallet: ${walletId}`,
      )

      const results: TransactionResponse[] = []

      // Execute transactions sequentially to avoid nonce issues
      for (const [index, transaction] of transactions.entries()) {
        logger.info(`Executing transaction ${index + 1}/${transactions.length}`)

        const result = await this.executeTransaction(walletId, transaction)
        results.push(result)

        // If a transaction fails, stop the batch
        if (!result.success) {
          logger.error(
            `Transaction ${index + 1} failed, stopping batch execution`,
          )
          break
        }

        // Wait a bit between transactions to ensure proper ordering
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      const allSuccessful = results.every((r) => r.success)

      return {
        success: allSuccessful,
        results,
        totalGasUsed: 0, // Would need to query receipts for actual gas used
      }
    } catch (error) {
      logger.error('Error executing batch transactions via Privy:', error)
      return {
        success: false,
        results: [],
        totalGasUsed: 0,
      }
    }
  }
}

// Export initialized instance with real Privy client
export const backendWalletService = new PrivyWalletService(privyClient)
