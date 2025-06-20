import type { Route } from '@elizaos/core'
import { logger } from '@elizaos/core'
import { defiDataService } from '../services/dataService.js'

export const routes: Route[] = [
  {
    name: 'yield-dashboard',
    path: '/yield-dashboard',
    type: 'GET',
    handler: async (req: any, res: any) => {
      try {
        const [topYields, protocols] = await Promise.all([
          defiDataService.getTopYieldOpportunities(10),
          defiDataService.getProtocols(),
        ])

        const dashboard = {
          title: 'YieldMaximizer Live Dashboard',
          topYields: topYields.slice(0, 5).map((pool) => ({
            project: pool.project,
            apy: `${(pool.apy || 0).toFixed(1)}%`,
            tvl: `$${(pool.tvlUsd / 1_000_000).toFixed(1)}M`,
            chain: pool.chain,
            symbol: pool.symbol,
          })),
          marketSummary: {
            totalProtocols: protocols.length,
            totalTVL: `$${(protocols.reduce((sum, p) => sum + (p.tvl || 0), 0) / 1_000_000_000).toFixed(1)}B`,
            avgTopYield: `${(topYields.slice(0, 5).reduce((sum, pool) => sum + (pool.apy || 0), 0) / 5).toFixed(1)}%`,
          },
          lastUpdated: new Date().toISOString(),
        }

        res.json(dashboard)
      } catch (error) {
        logger.error('Dashboard error:', error)
        res.status(500).json({ error: 'Unable to fetch dashboard data' })
      }
    },
  },
  {
    name: 'portfolio-analysis',
    path: '/portfolio-analysis',
    type: 'POST',
    handler: async (req: any, res: any) => {
      try {
        const { positions } = req.body

        if (!positions || !Array.isArray(positions)) {
          return res.status(400).json({ error: 'Invalid positions data' })
        }

        const analysis = await defiDataService.analyzePortfolio(positions)
        res.json(analysis)
      } catch (error) {
        logger.error('Portfolio analysis error:', error)
        res.status(500).json({
          error: 'Portfolio analysis failed',
          details: error.message,
        })
      }
    },
  },
  {
    name: 'protocol-risk',
    path: '/protocol-risk/:protocol',
    type: 'GET',
    handler: async (req: any, res: any) => {
      try {
        const { protocol } = req.params
        const riskMetrics =
          await defiDataService.calculateProtocolRisk(protocol)
        res.json(riskMetrics)
      } catch (error) {
        logger.error(`Risk analysis error for ${req.params.protocol}:`, error)
        res.status(500).json({ error: 'Risk analysis failed' })
      }
    },
  },
  {
    name: 'pool-history',
    path: '/pool-history/:poolId',
    type: 'GET',
    handler: async (req: any, res: any) => {
      try {
        const { poolId } = req.params
        const days = parseInt(req.query.days) || 30

        const [historicalData, trends] = await Promise.all([
          defiDataService.getPoolHistoricalData(poolId, days),
          defiDataService.analyzePoolTrends(poolId, days),
        ])

        if (historicalData.length === 0) {
          return res.status(404).json({
            error: 'Pool not found or no historical data available',
            poolId,
          })
        }

        res.json({
          poolId,
          dataPoints: historicalData.length,
          period: `${days} days`,
          currentMetrics: {
            apy: trends.currentApy,
            tvlUsd: historicalData[historicalData.length - 1].tvlUsd,
          },
          trends: {
            apyTrend: trends.apyTrend,
            tvlTrend: trends.tvlTrend,
            volatility: trends.volatility,
            riskScore: trends.riskScore,
            recommendation: trends.recommendation,
          },
          statistics: {
            averageApy: trends.averageApy,
            maxApy: Math.max(...historicalData.map((d) => d.apy)),
            minApy: Math.min(...historicalData.map((d) => d.apy)),
            maxTvl: Math.max(...historicalData.map((d) => d.tvlUsd)),
            minTvl: Math.min(...historicalData.map((d) => d.tvlUsd)),
          },
          historicalData: historicalData.slice(-100), // Limit to last 100 points for response size
          lastUpdated: new Date().toISOString(),
        })
      } catch (error) {
        logger.error(`Pool history error for ${req.params.poolId}:`, error)
        res.status(500).json({
          error: 'Failed to fetch pool historical data',
          details: error.message,
        })
      }
    },
  },
  {
    name: 'health',
    path: '/health',
    type: 'GET',
    handler: async (req: any, res: any) => {
      try {
        const health = await defiDataService.healthCheck()
        res.json({
          service: 'YieldMaximizer',
          timestamp: new Date().toISOString(),
          ...health,
        })
      } catch (error) {
        logger.error('Health check error:', error)
        res.status(500).json({
          service: 'YieldMaximizer',
          status: 'error',
          timestamp: new Date().toISOString(),
        })
      }
    },
  },
]
