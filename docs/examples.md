import axios, { AxiosResponse, AxiosError, AxiosInstance } from 'axios'
import { YieldPool, FilteredYieldData } from './types'

// DeFiLlama API URLs
const DEFILLAMA_YIELDS_API = 'https://yields.llama.fi'

class YieldService {
private axiosInstance: AxiosInstance

constructor() {
// Create axios instance with default configuration for DeFiLlama API
this.axiosInstance = axios.create({
baseURL: DEFILLAMA_YIELDS_API,
timeout: 30000, // 30 seconds timeout for large dataset
headers: {
'Content-Type': 'application/json',
'User-Agent': 'YieldAnalyzer/1.0.0',
},
})

    // Add request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        console.log(
          `🔄 Making ${config.method?.toUpperCase()} request to: ${config.url}`,
        )
        return config
      },
      (error) => {
        return Promise.reject(error)
      },
    )

    // Add response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        console.log(
          `✅ Response received: ${response.status} ${response.statusText}`,
        )
        return response
      },
      (error) => {
        console.error('❌ Response error:', error.message)
        return Promise.reject(error)
      },
    )

}

// Fetch all yield pools from DeFiLlama
async getAllYieldPools(): Promise<YieldPool[]> {
try {
const response: AxiosResponse<{ status: string; data: YieldPool[] }> =
await this.axiosInstance.get('/pools')

      return response.data.data || (response.data as any) // Handle different response formats
    } catch (error) {
      this.handleError(error as AxiosError)
      throw error
    }

}

// Filter pools with APY > 0
async getPoolsWithPositiveApy(): Promise<YieldPool[]> {
try {
const allPools = await this.getAllYieldPools()
const filteredPools = allPools.filter((pool) => pool.apy > 0)

      console.log(
        `📊 Found ${filteredPools.length} pools with APY > 0 out of ${allPools.length} total pools`,
      )
      return filteredPools
    } catch (error) {
      this.handleError(error as AxiosError)
      throw error
    }

}

// Get pools filtered by minimum APY threshold
async getPoolsByMinApy(minApy: number): Promise<YieldPool[]> {
try {
const allPools = await this.getAllYieldPools()
const filteredPools = allPools.filter((pool) => pool.apy >= minApy)

      console.log(
        `📊 Found ${filteredPools.length} pools with APY >= ${minApy}%`,
      )
      return filteredPools
    } catch (error) {
      this.handleError(error as AxiosError)
      throw error
    }

}

// Get pools by specific chain
async getPoolsByChain(chainName: string): Promise<YieldPool[]> {
try {
const allPools = await this.getAllYieldPools()
const filteredPools = allPools.filter(
(pool) =>
pool.chain.toLowerCase() === chainName.toLowerCase() && pool.apy > 0,
)

      console.log(
        `📊 Found ${filteredPools.length} pools on ${chainName} with APY > 0`,
      )
      return filteredPools
    } catch (error) {
      this.handleError(error as AxiosError)
      throw error
    }

}

// Get pools by specific protocol
async getPoolsByProject(projectName: string): Promise<YieldPool[]> {
try {
const allPools = await this.getAllYieldPools()
const filteredPools = allPools.filter(
(pool) =>
pool.project.toLowerCase() === projectName.toLowerCase() &&
pool.apy > 0,
)

      console.log(
        `📊 Found ${filteredPools.length} pools for ${projectName} with APY > 0`,
      )
      return filteredPools
    } catch (error) {
      this.handleError(error as AxiosError)
      throw error
    }

}

// Get comprehensive yield analytics
async getYieldAnalytics(): Promise<FilteredYieldData> {
try {
const allPools = await this.getAllYieldPools()
const positivePools = allPools.filter((pool) => pool.apy > 0)

      if (positivePools.length === 0) {
        throw new Error('No pools with positive APY found')
      }

      // Calculate average APY
      const totalApy = positivePools.reduce((sum, pool) => sum + pool.apy, 0)
      const averageApy = totalApy / positivePools.length

      // Find highest APY pool
      const highestApy = positivePools.reduce((max, pool) =>
        pool.apy > max.apy ? pool : max,
      )

      // Group by chains
      const chainStats = new Map<string, { count: number; totalApy: number }>()
      positivePools.forEach((pool) => {
        const current = chainStats.get(pool.chain) || { count: 0, totalApy: 0 }
        chainStats.set(pool.chain, {
          count: current.count + 1,
          totalApy: current.totalApy + pool.apy,
        })
      })

      const topChains = Array.from(chainStats.entries())
        .map(([chain, stats]) => ({
          chain,
          poolCount: stats.count,
          averageApy: stats.totalApy / stats.count,
        }))
        .sort((a, b) => b.poolCount - a.poolCount)
        .slice(0, 10)

      // Group by projects
      const projectStats = new Map<
        string,
        { count: number; totalApy: number }
      >()
      positivePools.forEach((pool) => {
        const current = projectStats.get(pool.project) || {
          count: 0,
          totalApy: 0,
        }
        projectStats.set(pool.project, {
          count: current.count + 1,
          totalApy: current.totalApy + pool.apy,
        })
      })

      const topProjects = Array.from(projectStats.entries())
        .map(([project, stats]) => ({
          project,
          poolCount: stats.count,
          averageApy: stats.totalApy / stats.count,
        }))
        .sort((a, b) => b.poolCount - a.poolCount)
        .slice(0, 10)

      return {
        totalPools: allPools.length,
        filteredPools: positivePools.length,
        averageApy,
        highestApy,
        topChains,
        topProjects,
      }
    } catch (error) {
      this.handleError(error as AxiosError)
      throw error
    }

}

// Get top yield pools by APY
async getTopPoolsByApy(limit: number = 10): Promise<YieldPool[]> {
try {
const positivePools = await this.getPoolsWithPositiveApy()
const sortedPools = positivePools
.sort((a, b) => b.apy - a.apy)
.slice(0, limit)

      console.log(`🏆 Top ${limit} pools by APY:`)
      sortedPools.forEach((pool, index) => {
        console.log(
          `${index + 1}. ${pool.symbol} on ${pool.chain} - ${pool.apy.toFixed(
            2,
          )}% APY`,
        )
      })

      return sortedPools
    } catch (error) {
      this.handleError(error as AxiosError)
      throw error
    }

}

// Error handling helper
private handleError(error: AxiosError): void {
if (error.response) {
// Server responded with error status
console.error(
`❌ Error ${error.response.status}: ${error.response.statusText}`,
)
console.error('Response data:', error.response.data)
} else if (error.request) {
// Request was made but no response received
console.error('❌ No response received:', error.request)
} else {
// Something else happened
console.error('❌ Error:', error.message)
}
}
}

// Demo function to showcase the DeFiLlama yield analytics
async function demo(): Promise<void> {
const yieldService = new YieldService()

try {
console.log('🚀 === DeFiLlama Yield Pool Analytics ===\n')

    // 1. Get comprehensive analytics
    console.log('📈 1. Fetching comprehensive yield analytics...')
    const analytics = await yieldService.getYieldAnalytics()
    console.log(`📊 Total Pools: ${analytics.totalPools}`)
    console.log(`✅ Pools with APY > 0: ${analytics.filteredPools}`)
    console.log(`📈 Average APY: ${analytics.averageApy.toFixed(2)}%`)
    console.log(
      `🏆 Highest APY: ${analytics.highestApy.apy.toFixed(2)}% (${
        analytics.highestApy.symbol
      } on ${analytics.highestApy.chain})`,
    )
    console.log()

    // 2. Show top chains
    console.log('🌐 2. Top chains by pool count:')
    analytics.topChains.slice(0, 5).forEach((chain: any, index: number) => {
      console.log(
        `${index + 1}. ${chain.chain}: ${
          chain.poolCount
        } pools, avg APY: ${chain.averageApy.toFixed(2)}%`,
      )
    })
    console.log()

    // 3. Show top protocols
    console.log('🔥 3. Top protocols by pool count:')
    analytics.topProjects.slice(0, 5).forEach((project: any, index: number) => {
      console.log(
        `${index + 1}. ${project.project}: ${
          project.poolCount
        } pools, avg APY: ${project.averageApy.toFixed(2)}%`,
      )
    })
    console.log()

    // 4. Get top pools by APY
    console.log('🏆 4. Top 10 pools by APY:')
    const topPools = await yieldService.getTopPoolsByApy(10)
    console.log()

    // 5. Filter by specific criteria
    console.log('🎯 5. High-yield opportunities (APY > 50%):')
    const highYieldPools = await yieldService.getPoolsByMinApy(50)
    highYieldPools.slice(0, 5).forEach((pool, index) => {
      console.log(
        `${index + 1}. ${pool.symbol} on ${pool.chain} (${
          pool.project
        }) - ${pool.apy.toFixed(2)}% APY`,
      )
    })
    console.log()

    // 6. Example: Get Ethereum pools
    console.log('⚡ 6. Ethereum yield pools sample:')
    const ethereumPools = await yieldService.getPoolsByChain('Ethereum')
    ethereumPools.slice(0, 3).forEach((pool, index) => {
      console.log(
        `${index + 1}. ${pool.symbol} (${pool.project}) - ${pool.apy.toFixed(
          2,
        )}% APY`,
      )
    })

    console.log('\n🎉 === Analysis completed successfully! ===')

} catch (error) {
console.error('💥 Demo failed:', error)
}
}

// Run the demo if this file is executed directly
if (require.main === module) {
demo()
}

export { YieldService, YieldPool, FilteredYieldData }
