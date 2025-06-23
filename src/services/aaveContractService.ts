import { ethers } from 'ethers'
import { UiPoolDataProvider, ChainId } from '@aave/contract-helpers'
import * as markets from '@bgd-labs/aave-address-book'
import { formatReserves } from '@aave/math-utils'
import dayjs from 'dayjs'
import { logger } from '@elizaos/core'

// Monkey patch to handle large BigNumber values
const originalToNumber = ethers.BigNumber.prototype.toNumber
ethers.BigNumber.prototype.toNumber = function () {
  try {
    return originalToNumber.call(this)
  } catch (error: any) {
    if (error.message && error.message.includes('overflow')) {
      // Return a safe approximation or string representation
      console.warn(
        `Large number detected, using string representation: ${this.toString()}`,
      )
      return parseFloat(this.toString()) || 0
    }
    throw error
  }
}

// Configuration for testnet networks
const NETWORK_CONFIG = {
  sepolia: {
    provider: new ethers.providers.JsonRpcProvider(
      process.env.SEPOLIA_RPC_URL ||
        'https://sepolia.infura.io/v3/c7c5f43ca9bc47afa93181f412d404f5',
    ),
    chainId: ChainId.sepolia,
    poolDataProvider: markets.AaveV3Sepolia.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: markets.AaveV3Sepolia.POOL_ADDRESSES_PROVIDER,
  },
  baseSepolia: {
    provider: new ethers.providers.JsonRpcProvider(
      process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    ),
    chainId: ChainId.base_sepolia,
    poolDataProvider: markets.AaveV3BaseSepolia.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: markets.AaveV3BaseSepolia.POOL_ADDRESSES_PROVIDER,
  },
  // Note: Fuji doesn't have UI_POOL_DATA_PROVIDER, so we'll skip it for now
  // avalancheFuji: {
  //   provider: new ethers.providers.JsonRpcProvider(
  //     process.env.AVALANCHE_FUJI_RPC_URL ||
  //       'https://api.avax-test.network/ext/bc/C/rpc',
  //   ),
  //   chainId: ChainId.fuji,
  //   poolDataProvider: markets.AaveV3Fuji.AAVE_PROTOCOL_DATA_PROVIDER, // Different interface
  //   poolAddressesProvider: markets.AaveV3Fuji.POOL_ADDRESSES_PROVIDER,
  // },
}

// Supported tokens mapping - Available tokens on Aave testnets
const TOKEN_MAPPING = {
  LINK: ['LINK'],
  WBTC: ['WBTC'],
  WETH: ['WETH', 'ETH'],
  AAVE: ['AAVE'],
  GHO: ['GHO'],
  EURS: ['EURS'],
}

interface AaveReserveData {
  symbol: string
  name: string
  supplyAPY: number
  variableBorrowAPY: number
  totalLiquidity: string
  availableLiquidity: string
  utilizationRate: number
  ltv: number
  liquidationThreshold: number
  liquidationBonus: number
  reserveFactor: number
  isActive: boolean
  isFrozen: boolean
  isPaused: boolean
  canBeCollateral: boolean
  canBeBorrowed: boolean
  chain: string
  underlyingAsset: string
  aTokenAddress: string
  priceInUSD: number
}

class AaveContractService {
  private cache = new Map<
    string,
    { data: AaveReserveData[]; timestamp: number }
  >()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  /**
   * Fetch reserves data for a specific network
   */
  async fetchNetworkReserves(
    network: keyof typeof NETWORK_CONFIG,
  ): Promise<AaveReserveData[]> {
    const cacheKey = `aave-${network}`
    const cached = this.cache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      logger.info(`Using cached Aave data for ${network}`)
      return cached.data
    }

    try {
      logger.info(`Fetching fresh Aave data for ${network}...`)

      const config = NETWORK_CONFIG[network]

      // Create contract instance
      const poolDataProviderContract = new UiPoolDataProvider({
        uiPoolDataProviderAddress: config.poolDataProvider,
        provider: config.provider,
        chainId: config.chainId,
      })

      // Fetch reserves data
      const reserves = await poolDataProviderContract.getReservesHumanized({
        lendingPoolAddressProvider: config.poolAddressesProvider,
      })

      const reservesArray = reserves.reservesData
      const baseCurrencyData = reserves.baseCurrencyData
      const currentTimestamp = dayjs().unix()

      // Log raw data before formatting
      logger.info(`Raw reserves data for ${network}:`, {
        reservesCount: reservesArray.length,
        baseCurrencyData,
        sampleReserve: reservesArray[0]
          ? {
              symbol: reservesArray[0].symbol,
              isActive: reservesArray[0].isActive,
              liquidityRate: reservesArray[0].liquidityRate,
            }
          : null,
      })

      // Format reserves using Aave's math utils
      const formattedPoolReserves = formatReserves({
        reserves: reservesArray,
        currentTimestamp,
        marketReferenceCurrencyDecimals:
          baseCurrencyData.marketReferenceCurrencyDecimals,
        marketReferencePriceInUsd:
          baseCurrencyData.marketReferenceCurrencyPriceInUsd,
      })

      // Log formatted data
      logger.info(`Formatted reserves for ${network}:`, {
        formattedCount: formattedPoolReserves.length,
        sampleFormatted: formattedPoolReserves[0]
          ? {
              symbol: formattedPoolReserves[0].symbol,
              supplyAPY: formattedPoolReserves[0].supplyAPY,
              isActive: formattedPoolReserves[0].isActive,
              isFrozen: formattedPoolReserves[0].isFrozen,
              isPaused: formattedPoolReserves[0].isPaused,
            }
          : null,
      })

      // Transform to our standard format
      const transformedReserves: AaveReserveData[] = formattedPoolReserves
        .filter((reserve: any) => {
          // Log all available reserves before filtering
          logger.info(`Reserve found on ${network}:`, {
            symbol: reserve.symbol,
            isActive: reserve.isActive,
            isFrozen: reserve.isFrozen,
            isPaused: reserve.isPaused,
            supplyAPY: reserve.supplyAPY,
          })

          // Filter for supported tokens only (ignore all status flags)
          const isSupported = Object.keys(TOKEN_MAPPING).some((token) =>
            TOKEN_MAPPING[token as keyof typeof TOKEN_MAPPING].includes(
              reserve.symbol,
            ),
          )

          // Only filter by token support, ignore all status flags
          const isValid = isSupported

          if (!isValid) {
            logger.info(
              `Filtering out reserve ${reserve.symbol} on ${network}:`,
              {
                isSupported,
                note: 'Not in supported token list',
              },
            )
          } else {
            logger.info(`Including reserve ${reserve.symbol} on ${network}:`, {
              isSupported,
              isActive: reserve.isActive,
              isPaused: reserve.isPaused,
              isFrozen: reserve.isFrozen,
              note: 'Using despite all status flags',
            })
          }

          return isValid
        })
        .map((reserve: any) => {
          const transformed = {
            symbol: reserve.symbol,
            name: reserve.name,
            supplyAPY: parseFloat(reserve.supplyAPY) || 0,
            variableBorrowAPY: parseFloat(reserve.variableBorrowAPY) || 0,
            totalLiquidity: reserve.formattedAvailableLiquidity || '0',
            availableLiquidity: reserve.formattedAvailableLiquidity || '0',
            utilizationRate: parseFloat(reserve.borrowUsageRatio) || 0,
            ltv: parseFloat(reserve.formattedBaseLTVasCollateral) || 0,
            liquidationThreshold:
              parseFloat(reserve.formattedReserveLiquidationThreshold) || 0,
            liquidationBonus:
              parseFloat(reserve.formattedReserveLiquidationBonus) || 0,
            reserveFactor: parseFloat(reserve.reserveFactor) || 0,
            isActive: reserve.isActive || false,
            isFrozen: reserve.isFrozen || false,
            isPaused: reserve.isPaused || false,
            canBeCollateral: reserve.usageAsCollateralEnabled || false,
            canBeBorrowed: reserve.borrowingEnabled || false,
            chain: network,
            underlyingAsset: reserve.underlyingAsset,
            aTokenAddress: reserve.aTokenAddress,
            priceInUSD: this.safePriceConversion(reserve.priceInUSD) || 1,
          }

          logger.info(`Transformed reserve for ${network}:`, transformed)
          return transformed
        })

      // Cache the results
      this.cache.set(cacheKey, {
        data: transformedReserves,
        timestamp: Date.now(),
      })

      logger.info(
        `Successfully fetched ${transformedReserves.length} Aave reserves for ${network}`,
      )
      return transformedReserves
    } catch (error) {
      logger.error(`Error fetching Aave data for ${network}:`, error)
      // Return cached data if available, even if expired
      const cached = this.cache.get(cacheKey)
      if (cached) {
        logger.warn(`Using expired cache for ${network} due to fetch error`)
        return cached.data
      }
      return []
    }
  }

  /**
   * Safely convert price to number, handling large BigNumber values
   */
  private safePriceConversion(priceValue: any): number {
    if (!priceValue) return 1

    try {
      // Handle string prices
      if (typeof priceValue === 'string') {
        const num = parseFloat(priceValue)
        // If price seems inflated (>1000 for most tokens), try to normalize
        if (num > 1000) {
          return 1 // Use $1 as fallback for stablecoins
        }
        return num
      }

      // Handle number prices
      if (typeof priceValue === 'number') {
        if (priceValue > 1000) {
          return 1 // Use $1 as fallback
        }
        return priceValue
      }

      return 1 // Safe fallback
    } catch (error) {
      logger.warn('Error converting price, using fallback:', error)
      return 1
    }
  }

  /**
   * Get all Aave reserves across supported networks
   */
  async getAllReserves(): Promise<AaveReserveData[]> {
    const networks = Object.keys(
      NETWORK_CONFIG,
    ) as (keyof typeof NETWORK_CONFIG)[]
    const allReserves: AaveReserveData[] = []

    // Fetch from all networks in parallel
    const results = await Promise.allSettled(
      networks.map((network) => this.fetchNetworkReserves(network)),
    )

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allReserves.push(...result.value)
      } else {
        logger.error(
          `Failed to fetch data for ${networks[index]}:`,
          result.reason,
        )
      }
    })

    return allReserves
  }

  /**
   * Get reserves for a specific token across all networks
   */
  async getTokenReserves(tokenSymbol: string): Promise<AaveReserveData[]> {
    logger.info(`Getting reserves for token: ${tokenSymbol}`)

    const allReserves = await this.getAllReserves()
    logger.info(`Total reserves fetched: ${allReserves.length}`)

    // Log all available symbols
    const allSymbols = allReserves.map((r) => r.symbol)
    logger.info(`Available symbols: ${allSymbols.join(', ')}`)

    const mappedTokens = TOKEN_MAPPING[
      tokenSymbol as keyof typeof TOKEN_MAPPING
    ] || [tokenSymbol]

    logger.info(
      `Looking for symbols: ${mappedTokens.join(', ')} for token ${tokenSymbol}`,
    )

    const filteredReserves = allReserves.filter((reserve) => {
      const matches = mappedTokens.includes(reserve.symbol)
      if (matches) {
        logger.info(`Found matching reserve:`, {
          symbol: reserve.symbol,
          chain: reserve.chain,
          supplyAPY: reserve.supplyAPY,
          isActive: reserve.isActive,
        })
      }
      return matches
    })

    logger.info(`Found ${filteredReserves.length} reserves for ${tokenSymbol}`)
    return filteredReserves
  }

  /**
   * Get top yield opportunities for a specific token
   */
  async getTopYieldsForToken(
    tokenSymbol: string,
    limit: number = 5,
  ): Promise<AaveReserveData[]> {
    const tokenReserves = await this.getTokenReserves(tokenSymbol)

    return tokenReserves
      .filter((reserve) => reserve.supplyAPY > 0)
      .sort((a, b) => b.supplyAPY - a.supplyAPY)
      .slice(0, limit)
  }

  /**
   * Get market overview statistics
   */
  async getMarketOverview() {
    const allReserves = await this.getAllReserves()

    const totalTVL = allReserves.reduce((sum, reserve) => {
      const tvl = parseFloat(reserve.totalLiquidity) || 0
      return sum + tvl * reserve.priceInUSD
    }, 0)

    const avgSupplyAPY =
      allReserves.reduce((sum, reserve) => sum + reserve.supplyAPY, 0) /
      allReserves.length

    const topProtocols = Array.from(
      new Set(allReserves.map((r) => `aave-v3 (${r.chain})`)),
    )

    return {
      totalTvl: totalTVL,
      averageYield: avgSupplyAPY,
      topProtocols: topProtocols.slice(0, 3),
      totalReserves: allReserves.length,
      activeNetworks: Object.keys(NETWORK_CONFIG).length,
    }
  }

  /**
   * Convert to legacy format for backward compatibility with existing code
   */
  convertToLegacyFormat(reserves: AaveReserveData[]): any[] {
    return reserves.map((reserve) => ({
      project: 'aave-v3',
      symbol: reserve.symbol,
      chain: reserve.chain,
      apy: reserve.supplyAPY,
      tvlUsd: parseFloat(reserve.totalLiquidity) * reserve.priceInUSD,
      category: 'Lending',
      apyBase: reserve.supplyAPY,
      pool: `${reserve.symbol}-${reserve.chain}`,
      // Additional Aave-specific data
      ltv: reserve.ltv,
      liquidationThreshold: reserve.liquidationThreshold,
      canBeCollateral: reserve.canBeCollateral,
      utilizationRate: reserve.utilizationRate,
      isActive: reserve.isActive,
    }))
  }
}

// Export singleton instance
export const aaveContractService = new AaveContractService()
