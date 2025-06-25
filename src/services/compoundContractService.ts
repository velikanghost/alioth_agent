import { ethers } from 'ethers'
import { logger } from '@elizaos/core'

const COMET_ABI = [
  'function getUtilization() public view returns (uint)',
  'function getSupplyRate(uint) public view returns (uint)',
  'function totalSupply() external view returns (uint256)',
  'function baseTokenPriceFeed() public view returns (address)',
  'function getPrice(address) public view returns (uint128)',
]

/**
 * Network configuration for Compound-V3 (Comet)
 */
const NETWORK_CONFIG = {
  sepolia: {
    rpcUrl: process.env.SEPOLIA_RPC_URL,
    cometAddress: process.env.SEPOLIA_COMPOUND_COMET,
    chain: 'sepolia',
    decimals: 6,
  },
  baseSepolia: {
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL,
    cometAddress: process.env.BASE_SEPOLIA_COMPOUND_COMET,
    chain: 'baseSepolia',
    decimals: 6,
  },
} as const

type SupportedNetwork = keyof typeof NETWORK_CONFIG

export interface CompoundReserveData {
  symbol: string // always USDC for supply
  name: string
  supplyAPY: number
  totalLiquidity: string
  chain: string
  priceInUSD: number
}

class CompoundContractService {
  private cache = new Map<
    string,
    { data: CompoundReserveData[]; timestamp: number }
  >()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  /**
   * Fetch supply data for a given network.
   */
  async fetchNetworkReserves(
    network: SupportedNetwork,
  ): Promise<CompoundReserveData[]> {
    const cacheKey = `compound-${network}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      logger.info(`Using cached Compound data for ${network}`)
      return cached.data
    }

    try {
      const cfg = NETWORK_CONFIG[network]
      if (
        !cfg.cometAddress ||
        cfg.cometAddress === '0x0000000000000000000000000000000000000000'
      ) {
        logger.warn(
          `Comet address for ${network} is not configured – skipping fetch.`,
        )
        return []
      }

      logger.info(`Fetching Compound data for ${network}`)

      const provider = new ethers.providers.JsonRpcProvider(cfg.rpcUrl)
      const comet = new ethers.Contract(cfg.cometAddress, COMET_ABI, provider)

      // Utilisation → supply rate → APY
      const utilization: ethers.BigNumber =
        await comet.callStatic.getUtilization()
      const supplyRatePerSecond: ethers.BigNumber =
        await comet.callStatic.getSupplyRate(utilization)
      const secondsPerYear = 60 * 60 * 24 * 365
      const supplyApr = supplyRatePerSecond.mul(secondsPerYear).toString() // still scaled 1e18
      const supplyAPY = (parseFloat(supplyApr) / 1e18) * 100

      // Total supply (USDC, 6 decimals)
      const totalSupplyBN: ethers.BigNumber =
        await comet.callStatic.totalSupply()
      const totalSupply = parseFloat(
        ethers.utils.formatUnits(totalSupplyBN, cfg.decimals),
      )

      // Price in USD – assume 1 for USDC to keep things simple
      let priceUSD = 1
      try {
        const priceFeed = await comet.callStatic.baseTokenPriceFeed()
        const priceRaw: ethers.BigNumber =
          await comet.callStatic.getPrice(priceFeed)
        priceUSD = parseFloat(priceRaw.toString()) / 1e8 // Chainlink feeds are 8-decimals
      } catch (e) {
        logger.warn('Compound price feed unavailable, defaulting to $1', e)
      }

      const reserve: CompoundReserveData = {
        symbol: 'USDC',
        name: 'USD Coin',
        supplyAPY: supplyAPY,
        totalLiquidity: totalSupply.toString(),
        chain: cfg.chain,
        priceInUSD: priceUSD || 1,
      }

      this.cache.set(cacheKey, { data: [reserve], timestamp: Date.now() })
      return [reserve]
    } catch (error) {
      logger.error(`Error fetching Compound data for ${network}:`, error)
      const cached = this.cache.get(cacheKey)
      if (cached) {
        logger.warn(`Returning stale cache for ${network}`)
        return cached.data
      }
      return []
    }
  }

  /** Gather all reserves across supported networks */
  async getAllReserves(): Promise<CompoundReserveData[]> {
    const networks = Object.keys(NETWORK_CONFIG) as SupportedNetwork[]
    const results = await Promise.allSettled(
      networks.map((n) => this.fetchNetworkReserves(n)),
    )
    const all: CompoundReserveData[] = []
    results.forEach((r) => {
      if (r.status === 'fulfilled') all.push(...r.value)
    })
    return all
  }

  async getTopYieldsForToken(
    tokenSymbol: string,
    limit = 5,
  ): Promise<CompoundReserveData[]> {
    if (tokenSymbol.toUpperCase() !== 'USDC') return []
    const reserves = await this.getAllReserves()
    return reserves
      .filter((r) => r.supplyAPY > 0)
      .sort((a, b) => b.supplyAPY - a.supplyAPY)
      .slice(0, limit)
  }

  /** Convert to legacy pool format used elsewhere */
  convertToLegacyFormat(reserves: CompoundReserveData[]): any[] {
    return reserves.map((r) => ({
      project: 'compound-v3',
      symbol: r.symbol,
      chain: r.chain,
      apy: r.supplyAPY,
      tvlUsd: parseFloat(r.totalLiquidity) * r.priceInUSD,
      category: 'Lending',
      apyBase: r.supplyAPY,
      pool: `${r.symbol}-${r.chain}`,
      isActive: true,
    }))
  }
}

export const compoundContractService = new CompoundContractService()
