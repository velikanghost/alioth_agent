import axios from 'axios'
import { logger } from '@elizaos/core'
import { aaveContractService } from './aaveContractService.js'

export interface ProtocolData {
  name: string
  tvl: number
  category: string
  chains: string[]
  change_1h?: number
  change_1d?: number
  change_7d?: number
  mcap?: number
  url: string
  description?: string
  audits?: string
  audit_note?: string
  gecko_id?: string
  cmcId?: string
}

export interface PoolData {
  pool: string
  chain: string
  project: string
  symbol: string
  tvlUsd: number
  apy?: number
  apyBase?: number
  apyReward?: number
  rewardTokens?: string[]
  il7d?: number
  apyBase7d?: number
  volumeUsd1d?: number
  volumeUsd7d?: number
  poolId?: string // For historical data lookup
  ltv?: number
  liquidationThreshold?: number
  canBeCollateral?: boolean
  utilizationRate?: number
  isActive?: boolean
}

export interface HistoricalDataPoint {
  timestamp: string
  tvlUsd: number
  apy: number
  apyBase: number
  apyReward: number | null
  il7d: number | null
  apyBase7d: number | null
}

export interface TokenPrice {
  id: string
  symbol: string
  name: string
  current_price: number
  market_cap: number
  market_cap_rank: number
  price_change_percentage_24h: number
  price_change_percentage_7d_in_currency?: number
  total_volume: number
  circulating_supply: number
  total_supply: number
}

export interface RiskMetrics {
  protocolRisk: number
  smartContractRisk: number
  liquidityRisk: number
  marketRisk: number
  composabilityRisk: number
  overallRisk: number
  riskFactors: string[]
}

//https://yields.llama.fi/pools
export class DeFiDataService {
  private defillama_base = 'https://api.llama.fi'
  private yields_base = 'https://yields.llama.fi'
  private coingecko_base = 'https://api.coingecko.com/api/v3'
  private cache = new Map<string, { data: any; timestamp: number }>()
  private cacheExpiry = 5 * 60 * 1000 // 5 minutes

  constructor() {
    this.setupAxiosDefaults()
  }

  private setupAxiosDefaults() {
    // Add default headers and timeout
    axios.defaults.timeout = 15000 // Increased timeout
    axios.defaults.headers.common['Accept'] = 'application/json'
    axios.defaults.headers.common['User-Agent'] = 'YieldMaximizer/1.0'

    // Add API keys if available
    if (process.env.COINGECKO_API_KEY) {
      axios.defaults.headers.common['x-cg-demo-api-key'] =
        process.env.COINGECKO_API_KEY
    }
  }

  private async cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data
    }

    try {
      const data = await fetcher()
      this.cache.set(key, { data, timestamp: Date.now() })
      return data
    } catch (error) {
      logger.error(`Error fetching ${key}:`, error)
      // Return cached data if available, even if expired
      if (cached) {
        logger.info(`Using expired cache for ${key}`)
        return cached.data
      }
      throw error
    }
  }

  /**
   * Get all protocols with TVL data from DeFiLlama
   */
  async getProtocols(): Promise<ProtocolData[]> {
    return this.cached('protocols', async () => {
      try {
        const response = await axios.get(`${this.defillama_base}/protocols`)
        const protocols = response.data || []

        // Filter out CEX and other non-DeFi categories
        return protocols.filter((protocol: any) => {
          const excludedCategories = ['CEX', 'Bridge', 'Chain', 'RWA Lending']
          const validCategories = [
            'Lending',
            'DEX',
            'Yield Farming',
            'Yield',
            'Liquid Staking',
            'Staking Pool',
          ]

          return (
            protocol.tvl > 0 && // Positive TVL only
            !excludedCategories.includes(protocol.category) &&
            (validCategories.includes(protocol.category) ||
              protocol.category?.includes('Yield') ||
              protocol.category?.includes('Lending'))
          )
        })
      } catch (error) {
        logger.error(error)
        return []
      }
    })
  }

  /**
   * Get specific protocol data by name
   */
  async getProtocolByName(name: string): Promise<ProtocolData | null> {
    const protocols = await this.getProtocols()
    return (
      protocols.find(
        (p) =>
          p.name.toLowerCase() === name.toLowerCase() ||
          p.name.toLowerCase().includes(name.toLowerCase()),
      ) || null
    )
  }

  /**
   * Get yield farming pools data using DeFiLlama yields API
   */
  async getYieldPools(): Promise<PoolData[]> {
    return this.cached('yield-pools', async () => {
      try {
        logger.info('🔍 Fetching real yield data from DeFiLlama API...')

        // Fetch real data from DeFiLlama yields API
        const response = await axios.get(`${this.yields_base}/pools`)
        const pools = response.data?.data || []

        // Filter for testnet-supported protocols only (Aave and Compound-v3)
        const supportedProtocols = ['aave', 'compound']
        const filteredPools = pools.filter((pool: any) => {
          const isValidPool =
            pool.tvlUsd > 1000000 && // Min $1M TVL
            pool.apy > 0 &&
            pool.apy < 500 && // Exclude unrealistic APYs
            supportedProtocols.some(
              (protocol) =>
                pool.project?.toLowerCase().includes(protocol) ||
                pool.pool?.toLowerCase().includes(protocol),
            )
          return isValidPool
        })

        // Transform to our interface
        const transformedPools = filteredPools.map((pool: any) => ({
          pool: pool.pool || `${pool.project}-${pool.symbol}`,
          chain: pool.chain || 'Ethereum',
          project: pool.project || 'Unknown',
          symbol: pool.symbol || 'Unknown',
          tvlUsd: pool.tvlUsd,
          apy: pool.apy,
          apyBase: pool.apyBase || 0,
          apyReward: pool.apyReward || 0,
          rewardTokens: pool.rewardTokens || [],
          il7d: pool.il7d,
          apyBase7d: pool.apyBase7d,
          volumeUsd1d: pool.volumeUsd1d,
          volumeUsd7d: pool.volumeUsd7d,
          poolId: pool.pool,
        }))

        // Sort by APY descending
        const sortedPools = transformedPools.sort(
          (a, b) => (b.apy || 0) - (a.apy || 0),
        )

        logger.info(
          `✅ Successfully fetched ${sortedPools.length} real yield opportunities`,
        )
        return sortedPools.slice(0, 50) // Top 50 opportunities
      } catch (error) {
        logger.error('❌ Error fetching real DeFiLlama data:', error)
        logger.info('📦 Falling back to realistic mock data...')

        // Fallback to mock data if API fails
        //return this.getMockYieldPools()
      }
    })
  }

  /**
   * Fallback mock data when API is unavailable
   */
  private getMockYieldPools(): PoolData[] {
    logger.info('Using mock data that simulates real DeFiLlama API responses')

    const mockPoolsData = [
      // High yield opportunities
      {
        pool: 'pendle-wsteth-26dec2024',
        chain: 'Ethereum',
        project: 'Pendle',
        symbol: 'PT-wstETH-26DEC2024',
        tvlUsd: 120000000,
        apy: 22.5,
        apyBase: 3.8,
        apyReward: 18.7,
        rewardTokens: ['PENDLE'],
      },
      {
        pool: 'convex-frxeth-eth',
        chain: 'Ethereum',
        project: 'Convex',
        symbol: 'frxETH-ETH',
        tvlUsd: 85000000,
        apy: 18.3,
        apyBase: 4.2,
        apyReward: 14.1,
        rewardTokens: ['CVX', 'CRV'],
      },
      {
        pool: 'gmx-v2-arbitrum-eth-usdc',
        chain: 'Arbitrum',
        project: 'GMX',
        symbol: 'ETH-USDC',
        tvlUsd: 65000000,
        apy: 16.8,
        apyBase: 12.1,
        apyReward: 4.7,
        rewardTokens: ['GMX', 'ARB'],
      },

      // Stablecoin yields
      {
        pool: 'aave-v3-usdc',
        chain: 'Ethereum',
        project: 'Aave',
        symbol: 'USDC',
        tvlUsd: 2800000000,
        apy: 8.2,
        apyBase: 8.2,
        apyReward: 0,
      },
      {
        pool: 'compound-v3-usdc',
        chain: 'Ethereum',
        project: 'Compound',
        symbol: 'USDC',
        tvlUsd: 1200000000,
        apy: 7.3,
        apyBase: 7.3,
        apyReward: 0,
      },
      {
        pool: 'curve-3pool',
        chain: 'Ethereum',
        project: 'Curve',
        symbol: '3CRV',
        tvlUsd: 1500000000,
        apy: 12.4,
        apyBase: 2.1,
        apyReward: 10.3,
        rewardTokens: ['CRV'],
      },
      {
        pool: 'curve-frax-usdc',
        chain: 'Ethereum',
        project: 'Curve',
        symbol: 'FRAX-USDC',
        tvlUsd: 450000000,
        apy: 9.7,
        apyBase: 1.8,
        apyReward: 7.9,
        rewardTokens: ['CRV', 'FXS'],
      },

      // Blue chip DeFi
      {
        pool: 'lido-steth',
        chain: 'Ethereum',
        project: 'Lido',
        symbol: 'stETH',
        tvlUsd: 32000000000,
        apy: 3.8,
        apyBase: 3.8,
        apyReward: 0,
      },
      {
        pool: 'rocketpool-reth',
        chain: 'Ethereum',
        project: 'Rocket Pool',
        symbol: 'rETH',
        tvlUsd: 8500000000,
        apy: 3.6,
        apyBase: 3.6,
        apyReward: 0,
      },
      {
        pool: 'yearn-usdc-vault',
        chain: 'Ethereum',
        project: 'Yearn',
        symbol: 'USDC',
        tvlUsd: 450000000,
        apy: 11.2,
        apyBase: 8.5,
        apyReward: 2.7,
        rewardTokens: ['YFI'],
      },

      // Layer 2 opportunities
      {
        pool: 'aave-v3-usdc-arbitrum',
        chain: 'Arbitrum',
        project: 'Aave',
        symbol: 'USDC',
        tvlUsd: 890000000,
        apy: 9.4,
        apyBase: 9.4,
        apyReward: 0,
      },
      {
        pool: 'uniswap-v3-usdc-eth-arbitrum',
        chain: 'Arbitrum',
        project: 'Uniswap',
        symbol: 'USDC-ETH',
        tvlUsd: 120000000,
        apy: 15.7,
        apyBase: 12.3,
        apyReward: 3.4,
        rewardTokens: ['ARB'],
      },
      {
        pool: 'velodrome-usdc-eth-optimism',
        chain: 'Optimism',
        project: 'Velodrome',
        symbol: 'USDC-ETH',
        tvlUsd: 85000000,
        apy: 13.9,
        apyBase: 8.2,
        apyReward: 5.7,
        rewardTokens: ['VELO', 'OP'],
      },

      // Emerging high yield
      {
        pool: 'radiant-arbitrum-usdc',
        chain: 'Arbitrum',
        project: 'Radiant',
        symbol: 'USDC',
        tvlUsd: 95000000,
        apy: 14.6,
        apyBase: 6.8,
        apyReward: 7.8,
        rewardTokens: ['RDNT', 'ARB'],
      },
      {
        pool: 'beefy-polygon-aave-usdc',
        chain: 'Polygon',
        project: 'Beefy',
        symbol: 'USDC',
        tvlUsd: 35000000,
        apy: 10.8,
        apyBase: 7.2,
        apyReward: 3.6,
        rewardTokens: ['BIFI', 'MATIC'],
      },
    ]

    // Transform to match our interface
    const transformedPools = mockPoolsData.map((pool: any) => ({
      pool: pool.pool,
      chain: pool.chain,
      project: pool.project,
      symbol: pool.symbol,
      tvlUsd: pool.tvlUsd,
      apy: pool.apy,
      apyBase: pool.apyBase,
      apyReward: pool.apyReward,
      rewardTokens: pool.rewardTokens,
      il7d: undefined,
      apyBase7d: undefined,
      volumeUsd1d: undefined,
      volumeUsd7d: undefined,
    }))

    // Sort by APY descending
    const sortedPools = transformedPools.sort(
      (a, b) => (b.apy || 0) - (a.apy || 0),
    )

    logger.info(`Processed ${sortedPools.length} mock pools for demonstration`)

    return sortedPools
  }

  /**
   * Get pools for a specific protocol
   */
  async getPoolsByProtocol(protocol: string): Promise<PoolData[]> {
    try {
      const protocolLower = protocol.toLowerCase()

      // We only support Aave now - get data from contracts
      if (protocolLower.includes('aave')) {
        logger.info(`Fetching Aave pools from contracts...`)
        const aaveReserves = await aaveContractService.getAllReserves()
        return aaveContractService.convertToLegacyFormat(aaveReserves)
      }

      // For now, we don't support other protocols
      logger.warn(
        `Protocol ${protocol} not supported. Only Aave is currently supported.`,
      )
      return []
    } catch (error) {
      logger.error(`Error fetching pools for ${protocol}:`, error)
      return []
    }
  }

  /**
   * Get token prices from CoinGecko
   */
  async getTokenPrices(tokenIds: string[]): Promise<TokenPrice[]> {
    if (tokenIds.length === 0) return []

    const cacheKey = `prices-${tokenIds.sort().join(',')}`
    return this.cached(cacheKey, async () => {
      try {
        const ids = tokenIds.join(',')
        const response = await axios.get(
          `${this.coingecko_base}/coins/markets`,
          {
            params: {
              vs_currency: 'usd',
              ids,
              order: 'market_cap_desc',
              per_page: 250,
              page: 1,
              sparkline: false,
              price_change_percentage: '24h,7d',
            },
          },
        )
        return response.data
      } catch (error) {
        logger.warn('CoinGecko API failed, returning empty prices')
        return []
      }
    })
  }

  /**
   * Get TVL for a specific chain
   */
  async getChainTVL(chain: string): Promise<number> {
    return this.cached(`chain-tvl-${chain}`, async () => {
      try {
        const response = await axios.get(`${this.defillama_base}/tvl/${chain}`)
        return response.data[response.data.length - 1]?.totalLiquidityUSD || 0
      } catch (error) {
        logger.warn(`Failed to get TVL for ${chain}`)
        return 0
      }
    })
  }

  /**
   * Calculate risk metrics for a protocol
   */
  async calculateProtocolRisk(protocolName: string): Promise<RiskMetrics> {
    try {
      const protocol = await this.getProtocolByName(protocolName)
      if (!protocol) {
        throw new Error(`Protocol ${protocolName} not found`)
      }

      // Risk factors calculation
      const riskFactors: string[] = []
      let protocolRisk = 5 // Base risk
      let smartContractRisk = 5
      let liquidityRisk = 5
      let marketRisk = 5
      let composabilityRisk = 5

      // TVL-based risk (higher TVL = lower risk)
      if (protocol.tvl > 10_000_000_000) {
        // >$10B
        protocolRisk -= 2
        liquidityRisk -= 2
      } else if (protocol.tvl > 1_000_000_000) {
        // >$1B
        protocolRisk -= 1
        liquidityRisk -= 1
      } else if (protocol.tvl < 100_000_000) {
        // <$100M
        protocolRisk += 2
        liquidityRisk += 2
        riskFactors.push('Low TVL (<$100M)')
      }

      // Audit-based risk
      if (protocol.audits && protocol.audits !== '0') {
        smartContractRisk -= 2
      } else {
        smartContractRisk += 1
        riskFactors.push('No audits found')
      }

      // Multi-chain risk
      if (protocol.chains && protocol.chains.length > 3) {
        composabilityRisk += 1
        riskFactors.push('Multi-chain complexity')
      }

      // Category-based risk
      const highRiskCategories = [
        'Derivatives',
        'Options',
        'Synthetics',
        'Leveraged Farming',
      ]
      const lowRiskCategories = ['Lending', 'Liquid Staking']

      if (highRiskCategories.includes(protocol.category)) {
        marketRisk += 2
        protocolRisk += 1
        riskFactors.push(`High-risk category: ${protocol.category}`)
      } else if (lowRiskCategories.includes(protocol.category)) {
        marketRisk -= 1
        protocolRisk -= 1
      }

      // TVL change-based risk
      if (protocol.change_7d !== undefined) {
        if (protocol.change_7d < -20) {
          liquidityRisk += 2
          riskFactors.push('Significant TVL decline (>20% in 7d)')
        } else if (protocol.change_7d < -10) {
          liquidityRisk += 1
          riskFactors.push('TVL decline (>10% in 7d)')
        }
      }

      // Clamp values between 1-10
      protocolRisk = Math.max(1, Math.min(10, protocolRisk))
      smartContractRisk = Math.max(1, Math.min(10, smartContractRisk))
      liquidityRisk = Math.max(1, Math.min(10, liquidityRisk))
      marketRisk = Math.max(1, Math.min(10, marketRisk))
      composabilityRisk = Math.max(1, Math.min(10, composabilityRisk))

      const overallRisk =
        Math.round(
          (protocolRisk * 0.25 +
            smartContractRisk * 0.25 +
            liquidityRisk * 0.2 +
            marketRisk * 0.2 +
            composabilityRisk * 0.1) *
            10,
        ) / 10

      return {
        protocolRisk,
        smartContractRisk,
        liquidityRisk,
        marketRisk,
        composabilityRisk,
        overallRisk,
        riskFactors,
      }
    } catch (error) {
      logger.error(`Error calculating risk for ${protocolName}:`, error)
      // Return default medium risk if calculation fails
      return {
        protocolRisk: 6,
        smartContractRisk: 6,
        liquidityRisk: 6,
        marketRisk: 6,
        composabilityRisk: 6,
        overallRisk: 6,
        riskFactors: ['Risk calculation unavailable'],
      }
    }
  }

  /**
   * Get top yield opportunities across all protocols
   */
  async getTopYieldOpportunities(
    limit: number = 10,
    minTvl: number = 1_000_000,
  ): Promise<PoolData[]> {
    try {
      logger.info('Fetching yield opportunities from Aave contracts only...')

      // Get Aave data from contracts - this is our only source now
      const aaveReserves = await aaveContractService.getAllReserves()
      const aaveData = aaveContractService.convertToLegacyFormat(aaveReserves)

      // Filter and rank pools intelligently
      const validPools = aaveData
        .filter((pool) => {
          return (
            pool.apy !== undefined &&
            pool.apy > 0.1 && // Must have at least 0.1% APY to be meaningful
            pool.tvlUsd > minTvl &&
            pool.apy < 200 && // Filter out unrealistic APYs
            pool.project && // Must have a project name
            pool.symbol && // Must have a symbol
            !pool.symbol.toLowerCase().includes('test') && // Filter out test pools
            !pool.symbol.toLowerCase().includes('deprecated') // Filter out deprecated pools
          )
        })
        .sort((a, b) => {
          // Sort by risk-adjusted score (APY * sqrt(TVL))
          const scoreA = (a.apy || 0) * Math.sqrt(a.tvlUsd / 1_000_000)
          const scoreB = (b.apy || 0) * Math.sqrt(b.tvlUsd / 1_000_000)
          return scoreB - scoreA
        })

      logger.info(
        `Found ${validPools.length} valid yield opportunities from Aave contracts across ${aaveReserves.length} total reserves`,
      )

      return validPools.slice(0, limit)
    } catch (error) {
      logger.error('Error in getTopYieldOpportunities:', error)
      return []
    }
  }

  /**
   * Calculate impermanent loss for a given price change
   */
  calculateImpermanentLoss(priceChangePercent: number): number {
    const priceRatio = 1 + priceChangePercent / 100
    const il = (2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1
    return Math.abs(il) * 100 // Return as percentage
  }

  /**
   * Get yields for a specific token - Aave contracts only
   */
  async getTokenYieldOpportunities(tokenSymbol: string): Promise<PoolData[]> {
    try {
      // Get Aave opportunities from contracts - our only source
      const aaveOpportunities = await aaveContractService.getTopYieldsForToken(
        tokenSymbol,
        10,
      )
      const aaveData =
        aaveContractService.convertToLegacyFormat(aaveOpportunities)

      // Filter and sort
      const validOpportunities = aaveData
        .filter((pool) => pool.apy && pool.apy > 0)
        .sort((a, b) => (b.apy || 0) - (a.apy || 0))

      logger.info(
        `Found ${validOpportunities.length} yield opportunities for ${tokenSymbol} from Aave contracts`,
      )
      return validOpportunities
    } catch (error) {
      logger.error(
        `Error fetching yield opportunities for ${tokenSymbol}:`,
        error,
      )
      return []
    }
  }

  /**
   * Get stablecoin yields (low IL risk) - Aave contracts only
   */
  async getStablecoinYields(): Promise<PoolData[]> {
    try {
      // Get Aave stablecoin data from contracts - only available stablecoins
      const stablecoinSymbols = ['GHO', 'EURS'] // Only stablecoins available on Aave testnets
      const aaveStablecoins: PoolData[] = []

      for (const symbol of stablecoinSymbols) {
        const reserves = await aaveContractService.getTopYieldsForToken(
          symbol,
          5,
        )
        const converted = aaveContractService.convertToLegacyFormat(reserves)
        aaveStablecoins.push(...converted)
      }

      // Filter and sort by APY
      return aaveStablecoins
        .filter((pool) => pool.apy && pool.apy > 0)
        .sort((a, b) => (b.apy || 0) - (a.apy || 0))
    } catch (error) {
      logger.error('Error fetching stablecoin yields:', error)
      return []
    }
  }

  /**
   * Analyze portfolio and provide real recommendations
   */
  async analyzePortfolio(positions: any[]): Promise<{
    analysis: string
    recommendations: string[]
    riskScore: number
    totalValue: number
    expectedYield: number
    riskMetrics: { [key: string]: RiskMetrics }
  }> {
    try {
      let totalValue = 0
      let weightedYield = 0
      let weightedRisk = 0
      const riskMetrics: { [key: string]: RiskMetrics } = {}
      const recommendations: string[] = []

      // Analyze each position
      for (const position of positions) {
        const { protocol, asset, amount, apy } = position
        totalValue += amount

        // Get real protocol risk
        const risk = await this.calculateProtocolRisk(protocol)
        riskMetrics[protocol] = risk

        // Calculate weighted metrics
        const weight = amount / totalValue
        weightedYield += (apy || 0) * weight
        weightedRisk += risk.overallRisk * weight
      }

      // Recalculate weights after getting total
      weightedYield = 0
      weightedRisk = 0
      for (const position of positions) {
        const weight = position.amount / totalValue
        weightedYield += (position.apy || 0) * weight
        weightedRisk += riskMetrics[position.protocol].overallRisk * weight
      }

      // Generate recommendations based on analysis
      if (weightedRisk > 7) {
        recommendations.push(
          '⚠️ Portfolio risk is high - consider reducing exposure to risky protocols',
        )
      }
      if (weightedRisk < 4) {
        recommendations.push(
          '💡 Portfolio is conservative - consider adding moderate-risk, higher-yield positions',
        )
      }

      // Check for concentration risk
      const maxPosition = Math.max(...positions.map((p) => p.amount))
      if (maxPosition / totalValue > 0.5) {
        recommendations.push(
          '📊 High concentration detected - diversify across more protocols',
        )
      }

      // Check for low yields
      if (weightedYield < 5) {
        recommendations.push(
          '📈 Consider exploring higher-yield opportunities in lending or LP positions',
        )
      }

      // Protocol-specific recommendations
      for (const [protocol, metrics] of Object.entries(riskMetrics)) {
        if (metrics.overallRisk > 8) {
          recommendations.push(
            `⚠️ ${protocol} has high risk (${metrics.overallRisk}/10) - monitor closely`,
          )
        }
        if (metrics.riskFactors.length > 0) {
          recommendations.push(
            `🔍 ${protocol} risks: ${metrics.riskFactors.join(', ')}`,
          )
        }
      }

      // Add market-based recommendations
      try {
        const topYields = await this.getTopYieldOpportunities(5)
        const avgTopYield =
          topYields.reduce((sum, pool) => sum + (pool.apy || 0), 0) /
          topYields.length

        if (weightedYield < avgTopYield * 0.7) {
          recommendations.push(
            `💰 Market opportunity: Top yields averaging ${avgTopYield.toFixed(1)}% APY`,
          )
        }
      } catch (error) {
        logger.error('Error getting market recommendations:', error)
      }

      const analysis =
        `Portfolio analyzed: $${totalValue.toLocaleString()} across ${positions.length} positions. ` +
        `Expected yield: ${weightedYield.toFixed(2)}% APY, Risk score: ${weightedRisk.toFixed(1)}/10`

      return {
        analysis,
        recommendations: recommendations.slice(0, 8), // Limit recommendations
        riskScore: Math.round(weightedRisk * 10) / 10,
        totalValue,
        expectedYield: Math.round(weightedYield * 100) / 100,
        riskMetrics,
      }
    } catch (error) {
      logger.error('Error analyzing portfolio:', error)
      throw new Error('Portfolio analysis failed')
    }
  }

  /**
   * Get historical data for a specific pool
   */
  async getPoolHistoricalData(
    poolId: string,
    days: number = 30,
  ): Promise<HistoricalDataPoint[]> {
    const cacheKey = `historical-${poolId}-${days}`
    return this.cached(cacheKey, async () => {
      try {
        const response = await axios.get(`${this.yields_base}/chart/${poolId}`)
        const data = response.data.data || response.data

        if (!Array.isArray(data)) {
          throw new Error('Invalid historical data format')
        }

        // Filter to recent data based on days parameter
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)

        return data
          .filter((point: any) => new Date(point.timestamp) >= cutoffDate)
          .map((point: any) => ({
            timestamp: point.timestamp,
            tvlUsd: point.tvlUsd || 0,
            apy: point.apy || 0,
            apyBase: point.apyBase || 0,
            apyReward: point.apyReward,
            il7d: point.il7d,
            apyBase7d: point.apyBase7d,
          }))
          .sort(
            (a: any, b: any) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          )
      } catch (error) {
        logger.error(
          `Error fetching historical data for pool ${poolId}:`,
          error,
        )
        return []
      }
    })
  }

  /**
   * Analyze historical trends for a pool
   */
  async analyzePoolTrends(
    poolId: string,
    days: number = 30,
  ): Promise<{
    averageApy: number
    currentApy: number
    apyTrend: 'increasing' | 'decreasing' | 'stable'
    tvlTrend: 'increasing' | 'decreasing' | 'stable'
    volatility: number
    riskScore: number
    recommendation: string
  }> {
    const data = await this.getPoolHistoricalData(poolId, days)

    if (data.length === 0) {
      throw new Error('No historical data available')
    }

    // Calculate trends and metrics
    const apyValues = data.map((d) => d.apy).filter((apy) => apy > 0)
    const tvlValues = data.map((d) => d.tvlUsd).filter((tvl) => tvl > 0)

    const averageApy =
      apyValues.length > 0
        ? apyValues.reduce((a, b) => a + b, 0) / apyValues.length
        : 0
    const currentApy = apyValues[apyValues.length - 1] || 0

    // Calculate APY trend (comparing last 7 days vs previous 7 days)
    const recent = apyValues.slice(-7)
    const previous = apyValues.slice(-14, -7)
    const recentAvg =
      recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0
    const previousAvg =
      previous.length > 0
        ? previous.reduce((a, b) => a + b, 0) / previous.length
        : 0

    let apyTrend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (recentAvg > previousAvg * 1.05) apyTrend = 'increasing'
    else if (recentAvg < previousAvg * 0.95) apyTrend = 'decreasing'

    // Calculate TVL trend
    const recentTvl = tvlValues.slice(-7)
    const previousTvl = tvlValues.slice(-14, -7)
    const recentTvlAvg =
      recentTvl.length > 0
        ? recentTvl.reduce((a, b) => a + b, 0) / recentTvl.length
        : 0
    const previousTvlAvg =
      previousTvl.length > 0
        ? previousTvl.reduce((a, b) => a + b, 0) / previousTvl.length
        : 0

    let tvlTrend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (recentTvlAvg > previousTvlAvg * 1.05) tvlTrend = 'increasing'
    else if (recentTvlAvg < previousTvlAvg * 0.95) tvlTrend = 'decreasing'

    // Calculate volatility (standard deviation of APY)
    const apyStdDev =
      apyValues.length > 1
        ? Math.sqrt(
            apyValues.reduce(
              (acc, val) => acc + Math.pow(val - averageApy, 2),
              0,
            ) / apyValues.length,
          )
        : 0
    const volatility = (apyStdDev / averageApy) * 100 // Coefficient of variation

    // Calculate risk score (0-10, higher = riskier)
    let riskScore = 5 // Base risk
    if (volatility > 50) riskScore += 2
    else if (volatility > 25) riskScore += 1
    if (tvlTrend === 'decreasing') riskScore += 1
    if (currentApy > averageApy * 2) riskScore += 1 // Unusually high APY
    if (tvlValues[tvlValues.length - 1] < 1_000_000) riskScore += 1 // Low TVL

    riskScore = Math.min(10, Math.max(1, riskScore))

    // Generate recommendation
    let recommendation = ''
    if (riskScore <= 3 && apyTrend !== 'decreasing') {
      recommendation = 'Low risk, good opportunity for stable yields'
    } else if (riskScore <= 6 && tvlTrend === 'increasing') {
      recommendation = 'Moderate risk, monitor closely'
    } else if (riskScore >= 7) {
      recommendation = 'High risk, consider smaller allocation or avoid'
    } else {
      recommendation = 'Mixed signals, requires careful analysis'
    }

    return {
      averageApy,
      currentApy,
      apyTrend,
      tvlTrend,
      volatility,
      riskScore,
      recommendation,
    }
  }

  /**
   * Health check method for API status
   */
  async healthCheck(): Promise<{
    status: string
    apis: { [key: string]: boolean }
  }> {
    const apis: { [key: string]: boolean } = {}

    try {
      await axios.get(`${this.defillama_base}/protocols`, { timeout: 5000 })
      apis.defillama = true
    } catch {
      apis.defillama = false
    }

    try {
      await axios.get(`${this.yields_base}/pools`, { timeout: 5000 })
      apis.yields = true
    } catch {
      apis.yields = false
    }

    try {
      await axios.get(`${this.coingecko_base}/ping`, { timeout: 5000 })
      apis.coingecko = true
    } catch {
      apis.coingecko = false
    }

    const allWorking = Object.values(apis).every((status) => status)
    return {
      status: allWorking ? 'healthy' : 'degraded',
      apis,
    }
  }
}

// Singleton instance
export const defiDataService = new DeFiDataService()
