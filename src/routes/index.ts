import type { Route } from '@elizaos/core'
import { logger } from '@elizaos/core'
import { defiDataService } from '../services/dataService.js'
import { analyzeYieldAction } from '../actions/analyzeYieldAction.js'
import { optimizePortfolioAction } from '../actions/optimizePortfolioAction.js'
import { riskAssessmentAction } from '../actions/riskAssessmentAction.js'
import { directDepositOptimizationAction } from '../actions/directDepositOptimizationAction.js'
import type {
  YieldAnalysisRequest,
  PortfolioOptimizationRequest,
  RiskAnalysisRequest,
} from '../types/interfaces.js'

export const routes: Route[] = [
  // Direct deposit optimization endpoint (no swaps)
  {
    name: 'direct-deposit-optimization',
    path: '/api/v1/direct-deposit-optimization',
    type: 'POST',
    handler: async (req: any, res: any) => {
      try {
        logger.info('API: Received direct deposit optimization request')
        const request = req.body

        // Validate request
        if (
          !request.inputTokenAddress ||
          !request.inputTokenSymbol ||
          !request.inputTokenAmount ||
          !request.usdAmount
        ) {
          return res.status(400).json({
            success: false,
            error:
              'inputTokenAddress, inputTokenSymbol, inputTokenAmount, and usdAmount are required',
            timestamp: new Date().toISOString(),
          })
        }

        // Create structured message for agent
        const message = {
          content: {
            structured: true,
            inputTokenAddress: request.inputTokenAddress,
            inputTokenSymbol: request.inputTokenSymbol,
            inputTokenAmount: request.inputTokenAmount,
            usdAmount: request.usdAmount,
            riskTolerance: request.riskTolerance || 'moderate',
          },
        }

        // Call direct deposit optimization action
        let result: any = null
        const callback = async (response: any): Promise<any[]> => {
          result = response
          return []
        }

        await directDepositOptimizationAction.handler(
          {} as any, // runtime placeholder
          message as any,
          {} as any, // state placeholder
          {},
          callback,
        )

        if (result?.content?.success) {
          logger.info('API: Direct deposit optimization completed successfully')
          res.json(result.content)
        } else if (result?.content?.error) {
          logger.error(
            'API: Direct deposit optimization failed:',
            result.content.error,
          )
          res.status(400).json({
            success: false,
            error: result.content.error,
            timestamp: new Date().toISOString(),
          })
        } else {
          logger.error('API: Unexpected response format')
          res.status(500).json({
            success: false,
            error: 'Unexpected response format from optimization action',
            timestamp: new Date().toISOString(),
          })
        }
      } catch (error) {
        logger.error('API: Error in direct deposit optimization:', error)
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        })
      }
    },
  },

  // New API endpoints for dual-mode functionality
  {
    name: 'yield-analysis-api',
    path: '/api/v1/yield-analysis',
    type: 'POST',
    handler: async (req: any, res: any) => {
      try {
        logger.info('API: Received yield analysis request')
        const request: YieldAnalysisRequest = req.body

        // Validate request
        if (!request.inputTokenAddress || !request.usdAmount) {
          return res.status(400).json({
            success: false,
            error: 'inputToken and inputAmount are required',
            timestamp: new Date().toISOString(),
          })
        }

        // Create structured message for agent
        const message = {
          content: {
            structured: true,
            inputTokenAddress: request.inputTokenAddress,
            usdAmount: request.usdAmount,
            riskTolerance: request.riskTolerance || 'moderate',
            userAddress: request.userAddress,
          },
        }

        // Call existing analyzeYieldAction
        const result = await analyzeYieldAction.handler(
          {} as any, // runtime placeholder
          message as any,
          {} as any, // state placeholder
          {},
          async () => [], // proper callback that returns empty Memory array
        )

        logger.info(
          `API: Yield analysis completed with ${(result as any)?.allocation?.length || 0} allocations`,
        )
        res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        })
      } catch (error) {
        logger.error('API: Yield analysis error:', error)
        res.status(500).json({
          success: false,
          error:
            error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        })
      }
    },
  },

  {
    name: 'portfolio-optimization-api',
    path: '/api/v1/portfolio-optimization',
    type: 'POST',
    handler: async (req: any, res: any) => {
      try {
        logger.info('API: Received portfolio optimization request')
        const request: PortfolioOptimizationRequest = req.body

        // Create structured message for agent
        const message = {
          content: {
            structured: true,
            riskTolerance: request.riskTolerance || 'moderate',
            userAddress: request.userAddress,
          },
        }

        // Call existing optimizePortfolioAction
        const result = await optimizePortfolioAction.handler(
          {} as any, // runtime placeholder
          message as any,
          {} as any, // state placeholder
          {},
          async () => [], // proper callback that returns empty Memory array
        )

        logger.info(
          `API: Portfolio optimization completed for ${request.riskTolerance} strategy`,
        )
        res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        })
      } catch (error) {
        logger.error('API: Portfolio optimization error:', error)
        res.status(500).json({
          success: false,
          error:
            error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        })
      }
    },
  },

  {
    name: 'risk-analysis-api',
    path: '/api/v1/risk-analysis',
    type: 'POST',
    handler: async (req: any, res: any) => {
      try {
        logger.info('API: Received risk analysis request')
        const request: RiskAnalysisRequest = req.body

        // Create structured message for agent
        const message = {
          content: {
            structured: true,
            protocol: request.protocol,
            allocation: request.allocation,
          },
        }

        // Call existing riskAssessmentAction
        const result = await riskAssessmentAction.handler(
          {} as any, // runtime placeholder
          message as any,
          {} as any, // state placeholder
          {},
          async () => [], // proper callback that returns empty Memory array
        )

        logger.info(
          `API: Risk analysis completed for ${request.protocol || 'portfolio'}`,
        )
        res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        })
      } catch (error) {
        logger.error('API: Risk analysis error:', error)
        res.status(500).json({
          success: false,
          error:
            error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        })
      }
    },
  },

  {
    name: 'api-health',
    path: '/api/v1/health',
    type: 'GET',
    handler: async (req: any, res: any) => {
      res.json({
        success: true,
        message: 'Alioth AI Agent API is healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        capabilities: [
          'yield-analysis',
          'portfolio-optimization',
          'risk-analysis',
        ],
      })
    },
  },

  // Existing dashboard routes (keep for backward compatibility)
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
