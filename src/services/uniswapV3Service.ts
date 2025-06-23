import { formatUnits, parseUnits, type PublicClient } from 'viem'
import { computePoolAddress, FeeAmount } from '@uniswap/v3-sdk'
import {
  Token,
  TradeType,
  CurrencyAmount,
  Percent,
  ChainId,
} from '@uniswap/sdk-core'
import {
  AlphaRouter,
  SwapOptionsSwapRouter02,
  SwapRoute,
  SwapType,
} from '@uniswap/smart-order-router'
import Quoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json' assert { type: 'json' }
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json' assert { type: 'json' }
import { logger } from '@elizaos/core'
import type {
  SwapQuote,
  PoolKey,
  TransactionRequest,
  TransactionResponse,
} from '../types/interfaces.js'
import {
  createViemClients,
  SUPPORTED_TOKENS,
  UNISWAP_V3_CONFIG,
  ERC20_ABI,
  TOKEN_AMOUNT_TO_APPROVE_FOR_TRANSFER,
} from 'src/config/uniswap.js'
import { backendWalletService } from './backendWalletService.js'

export enum TransactionState {
  Failed = 'Failed',
  New = 'New',
  Rejected = 'Rejected',
  Sending = 'Sending',
  Sent = 'Sent',
}

export class UniswapV3Service {
  private quoterAddress: string
  private routerAddress: string
  private factoryAddress: string

  private publicClient: any
  private chainId: number

  constructor(chainId: number = 11155111) {
    this.chainId = chainId
    this.setupClients()
    this.setupContracts()
  }

  private setupClients() {
    const { publicClient } = createViemClients()
    this.publicClient = publicClient
  }

  private setupContracts() {
    const config = UNISWAP_V3_CONFIG.sepolia

    this.quoterAddress = config.quoter
    this.routerAddress = config.swapRouter // Use V3 SwapRouter02
    this.factoryAddress = config.poolManager

    if (
      !this.quoterAddress ||
      this.quoterAddress === '0x0000000000000000000000000000000000000000'
    ) {
      logger.warn('Quoter address not set, using placeholder')
    }
  }

  /**
   * Convert from readable amount to raw amount (with decimals)
   */
  private fromReadableAmount(amount: string, decimals: number): bigint {
    return parseUnits(amount, decimals)
  }

  /**
   * Convert from raw amount to readable amount
   */
  private toReadableAmount(rawAmount: bigint, decimals: number): string {
    return formatUnits(rawAmount, decimals)
  }

  /**
   * Get token by symbol with ETH/WETH normalization for better pool compatibility
   */
  private getToken(symbol: string): Token {
    const tokens = SUPPORTED_TOKENS.sepolia

    // Normalize WETH to ETH for better pool availability on testnet
    if (symbol === 'WETH' && this.chainId === 11155111) {
      symbol = 'ETH'
      logger.info(
        'Using ETH instead of WETH for better pool availability on Sepolia',
      )
    }

    const token = tokens[symbol as keyof typeof tokens]
    if (!token) {
      throw new Error(`Token ${symbol} not supported`)
    }
    return token
  }

  /**
   * Get pool constants (token0, token1, fee) for a token pair
   */
  private async getPoolConstants(
    tokenA: Token,
    tokenB: Token,
    fee: FeeAmount,
  ): Promise<{
    token0: string
    token1: string
    fee: number
    poolAddress: string
  }> {
    // Compute pool address
    const poolAddress = computePoolAddress({
      factoryAddress: this.factoryAddress,
      tokenA,
      tokenB,
      fee,
    })

    logger.info(
      `Checking pool at address: ${poolAddress} for ${tokenA.symbol}-${tokenB.symbol}`,
    )

    // Get pool contract data
    const poolContract = {
      address: poolAddress as `0x${string}`,
      abi: IUniswapV3PoolABI.abi,
    }

    try {
      // Batch call to get pool constants
      const [token0, token1, poolFee] = await Promise.all([
        this.publicClient.readContract({
          ...poolContract,
          functionName: 'token0',
        }),
        this.publicClient.readContract({
          ...poolContract,
          functionName: 'token1',
        }),
        this.publicClient.readContract({
          ...poolContract,
          functionName: 'fee',
        }),
      ])

      return {
        token0: token0 as string,
        token1: token1 as string,
        fee: poolFee as number,
        poolAddress,
      }
    } catch (error) {
      logger.error(
        `Failed to get pool constants for ${tokenA.symbol}-${tokenB.symbol}:`,
        error,
      )
      throw new Error(
        `Pool not found for ${tokenA.symbol}-${tokenB.symbol} with fee ${fee}`,
      )
    }
  }

  /**
   * Get a quote for exact input single swap
   */
  async getQuote(
    inputTokenSymbol: string,
    outputTokenSymbol: string,
    inputAmount: string,
    fee: FeeAmount = FeeAmount.MEDIUM,
  ): Promise<SwapQuote> {
    try {
      const inputToken = this.getToken(inputTokenSymbol)
      const outputToken = this.getToken(outputTokenSymbol)

      logger.info(
        `Getting V3 quote: ${inputAmount} ${inputToken.symbol} -> ${outputToken.symbol}`,
      )

      // Get pool constants
      const poolConstants = await this.getPoolConstants(
        inputToken,
        outputToken,
        fee,
      )

      // Convert input amount to raw format
      const rawInputAmount = this.fromReadableAmount(
        inputAmount,
        inputToken.decimals,
      )

      // Get quote using Quoter contract
      const quotedAmountOut = await this.publicClient.simulateContract({
        address: this.quoterAddress as `0x${string}`,
        abi: Quoter.abi,
        functionName: 'quoteExactInputSingle',
        args: [
          poolConstants.token0,
          poolConstants.token1,
          poolConstants.fee,
          rawInputAmount.toString(),
          0, // sqrtPriceLimitX96 (0 = no limit)
        ],
      })

      const outputAmount = quotedAmountOut.result as bigint
      const readableOutputAmount = this.toReadableAmount(
        outputAmount,
        outputToken.decimals,
      )

      // Calculate price impact (simplified)
      const inputValue = parseFloat(inputAmount)
      const outputValue = parseFloat(readableOutputAmount)
      const priceImpact = ((inputValue - outputValue) / inputValue) * 100

      const quote: SwapQuote = {
        inputAmount: rawInputAmount.toString(),
        outputAmount: outputAmount.toString(),
        poolKey: {
          currency0: poolConstants.token0,
          currency1: poolConstants.token1,
          fee: poolConstants.fee,
          tickSpacing: this.getTickSpacing(poolConstants.fee),
          hooks: '0x0000000000000000000000000000000000000000',
        } as PoolKey,
        slippageTolerance: 50, // 0.5% default
        priceImpact,
        gasEstimate: '200000', // Rough estimate for V3 swap
      }

      logger.info(
        `V3 Quote: ${inputAmount} ${inputToken.symbol} -> ${readableOutputAmount} ${outputToken.symbol} (${priceImpact.toFixed(2)}% impact)`,
      )

      return quote
    } catch (error) {
      logger.error('Failed to get V3 quote:', error)
      throw new Error(
        `Failed to get quote: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get tick spacing for fee tier
   */
  private getTickSpacing(fee: number): number {
    switch (fee) {
      case 100: // 0.01%
        return 1
      case 500: // 0.05%
        return 10
      case 3000: // 0.3%
        return 60
      case 10000: // 1%
        return 200
      default:
        return 60 // Default to medium fee tick spacing
    }
  }

  /**
   * Get supported tokens for this chain
   */
  getSupportedTokens(): string[] {
    const tokens = SUPPORTED_TOKENS.sepolia
    return Object.keys(tokens)
  }

  /**
   * Get available fee tiers
   */
  getFeeTiers(): FeeAmount[] {
    return [FeeAmount.LOWEST, FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH]
  }

  /**
   * Generate smart swap route using AlphaRouter (Viem compatible)
   */
  async generateSmartRoute(
    inputToken: Token,
    outputToken: Token,
    inputAmount: string,
    recipient: string,
    slippageToleranceBps: number = 50,
  ): Promise<SwapRoute | null> {
    try {
      logger.info(
        `Generating smart route: ${inputAmount} ${inputToken.symbol} -> ${outputToken.symbol}`,
      )

      // Create AlphaRouter with Viem-compatible setup
      const router = new AlphaRouter({
        chainId: ChainId.SEPOLIA,
        provider: this.publicClient, // Use our Viem public client
      })

      const options: SwapOptionsSwapRouter02 = {
        recipient,
        slippageTolerance: new Percent(slippageToleranceBps, 10_000),
        deadline: Math.floor(Date.now() / 1000 + 1800), // 30 minutes
        type: SwapType.SWAP_ROUTER_02,
      }

      // Convert input amount to raw format
      const rawInputAmount = this.fromReadableAmount(
        inputAmount,
        inputToken.decimals,
      )

      const route = await router.route(
        CurrencyAmount.fromRawAmount(inputToken, rawInputAmount.toString()),
        outputToken,
        TradeType.EXACT_INPUT,
        options,
      )

      if (route) {
        logger.info(
          `Generated route with ${route.route.length} hops, expected output: ${route.quote.toFixed()}`,
        )
      }

      return route
    } catch (error) {
      logger.error('Failed to generate smart route:', error)
      return null
    }
  }

  /**
   * Execute smart swap route using backendWalletService (Viem compatible)
   */
  async executeSmartRoute(
    route: SwapRoute,
    walletId: string,
    inputToken: Token,
    aliothAddress: string,
  ): Promise<TransactionResponse> {
    try {
      if (!route.methodParameters) {
        throw new Error('Route does not have method parameters')
      }

      logger.info(`Executing smart route for wallet: ${walletId}`)

      // Check if token approval is needed
      //const userAddress = '0x0000000000000000000000000000000000000000' // This should be retrieved from walletId
      const approvalTx = await this.getTokenApprovalTransaction(
        inputToken,
        aliothAddress,
      )

      // Execute approval if needed
      if (approvalTx) {
        logger.info(`Executing token approval for ${inputToken.symbol}`)
        const approvalResult = await backendWalletService.executeTransaction(
          walletId,
          approvalTx,
        )

        if (!approvalResult.success) {
          logger.error('Token approval failed:', approvalResult.error)
          return approvalResult
        }

        // Wait for approval confirmation
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      // Build swap transaction
      const swapTransaction: TransactionRequest = {
        to: this.routerAddress,
        data: route.methodParameters.calldata,
        value: route.methodParameters.value || '0x0',
        gasLimit: '500000', // Conservative gas limit for smart router
      }

      logger.info('Executing swap transaction...')
      const result = await backendWalletService.executeTransaction(
        walletId,
        swapTransaction,
      )

      if (result.success) {
        logger.info(`Swap executed successfully: ${result.txHash}`)
      } else {
        logger.error('Swap execution failed:', result.error)
      }

      return result
    } catch (error) {
      logger.error('Failed to execute smart route:', error)
      return {
        success: false,
        txHash: '',
        error: error.message,
      }
    }
  }

  /**
   * Complete smart swap execution (generate route + execute)
   */
  async executeSmartSwap(
    inputToken: Token,
    outputToken: Token,
    inputAmount: string,
    slippageToleranceBps: number = 50,
    recipient: string,
    walletId: string,
    aliothAddress: string,
  ): Promise<TransactionResponse> {
    try {
      logger.info(
        `Starting smart swap: ${inputAmount} ${inputToken.symbol} -> ${outputToken.symbol}`,
      )

      // Generate route
      const route = await this.generateSmartRoute(
        inputToken,
        outputToken,
        inputAmount,
        recipient,
        slippageToleranceBps,
      )

      if (!route) {
        throw new Error('Failed to generate swap route')
      }

      // Execute route
      const result = await this.executeSmartRoute(
        route,
        walletId,
        inputToken,
        aliothAddress,
      )

      return result
    } catch (error) {
      logger.error('Failed to execute smart swap:', error)
      return {
        success: false,
        txHash: '',
        error: error.message,
      }
    }
  }

  /**
   * Get token approval transaction
   */
  async getTokenApprovalTransaction(
    token: Token,
    owner: string,
    amount?: string,
  ): Promise<TransactionRequest | null> {
    try {
      // ETH doesn't need approval
      if (token.symbol === 'ETH' || token.isNative) {
        return null
      }

      const approvalAmount = amount || TOKEN_AMOUNT_TO_APPROVE_FOR_TRANSFER
      const rawAmount = this.fromReadableAmount(approvalAmount, token.decimals)

      // Check current allowance
      const currentAllowance = await this.publicClient.readContract({
        address: token.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner as `0x${string}`, this.routerAddress as `0x${string}`],
      })

      // If allowance is sufficient, no approval needed
      if (currentAllowance >= rawAmount) {
        logger.info(`Token ${token.symbol} already has sufficient allowance`)
        return null
      }

      // Build approval transaction
      const { request } = await this.publicClient.simulateContract({
        address: token.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [this.routerAddress as `0x${string}`, rawAmount],
        account: owner as `0x${string}`,
      })

      return {
        to: request.address,
        data: request.data,
        value: '0x0',
        gasLimit: '50000', // Standard gas for approval
      }
    } catch (error) {
      logger.error('Failed to get token approval transaction:', error)
      throw error
    }
  }
}

// Export singleton instances
export const uniswapV3Service = new UniswapV3Service(11155111) // Sepolia by default
