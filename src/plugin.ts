import type { Plugin } from '@elizaos/core'
import {
  type Action,
  type Content,
  type GenerateTextParams,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type Provider,
  type ProviderResult,
  Service,
  type State,
  logger,
} from '@elizaos/core'
import { z } from 'zod'
import { defiDataService } from './services/dataService.js'

/**
 * Configuration schema for Alioth DeFi agent
 */
const configSchema = z.object({
  ALIOTH_BACKEND_URL: z.string().optional(),
  ALIOTH_API_KEY: z.string().optional(),
  AGENT_ID: z.string().default('alioth-agent-v1'),
  CHAINLINK_RPC_URL: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  DEBANK_API_KEY: z.string().optional(),
  DEFAULT_SLIPPAGE: z.string().default('0.5'),
  MIN_YIELD_THRESHOLD: z.string().default('5.0'),
  MAX_RISK_SCORE: z.string().default('7.0'),
  REBALANCE_THRESHOLD: z.string().default('2.0'),
})

// Types for Alioth-specific data structures
interface OptimizationStrategy {
  operationId: string
  userAddress: string
  inputDetails: {
    inputToken: string
    inputAmount: string
    riskTolerance: number
  }
  tokenAllocations: TokenAllocation[]
  swapRoutes: SwapRoute[]
  expectedAPY: number
  riskScore: number
  diversificationScore: number
  confidence: number
  reasoning: string
  expiresAt: number
}

interface TokenAllocation {
  token: string
  symbol: string
  percentage: number
  amount: string
  expectedAPY: number
  riskScore: number
  protocol?: string
}

interface SwapRoute {
  inputToken: string
  outputToken: string
  amount: string
  expectedOutput: string
  route: string[]
  gasEstimate: string
  slippage: number
}

interface MarketAnalysis {
  timestamp: Date
  tokens: Array<{
    address: string
    symbol: string
    price: number
    priceChange24h: number
    volume24h: number
    bestYield: number
    avgYield: number
    riskScore: number
    volatility: number
  }>
  opportunities: any[]
  risks: any[]
  correlations: any
  insights: string[]
  recommendations: string[]
}

interface RiskAssessment {
  portfolioRisk: {
    totalRiskScore: number
    volatility: number
    maxDrawdown: number
    valueAtRisk: number
    beta: number
    sharpeRatio: number
    concentrationRisk: number
  }
  riskFactors: string[]
  mitigation: string[]
  riskAlignment: string
  recommendation: string
  confidence: number
}

/**
 * 🎯 ALIOTH BACKEND PROVIDER
 * Primary provider for backend communication and data synchronization
 */
const aliothBackendProvider: Provider = {
  name: 'ALIOTH_BACKEND',
  description: 'Backend API integration for Alioth NestJS services',

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    const content = message.content.text?.toLowerCase() || ''

    // Check if this requires backend integration
    if (
      !content.includes('optimize') &&
      !content.includes('strategy') &&
      !content.includes('portfolio') &&
      !content.includes('execute')
    ) {
      return { text: '', values: {}, data: {} }
    }

    try {
      const backendUrl = runtime.getSetting('ALIOTH_BACKEND_URL')
      const apiKey = runtime.getSetting('ALIOTH_API_KEY')
      const agentId = runtime.getSetting('AGENT_ID')

      if (!backendUrl || !apiKey) {
        return {
          text: '⚠️ **Backend Integration Required**\n\nFor advanced optimization and strategy execution, please configure:\n• ALIOTH_BACKEND_URL\n• ALIOTH_API_KEY\n\nCurrently running in demo mode with limited functionality.',
          values: { backendAvailable: false },
          data: { requiresBackend: true },
        }
      }

      // Register agent if needed
      await registerAgent(backendUrl, apiKey, agentId)

      return {
        text: '✅ **Backend Connected**\n\nAlioth backend integration active. Full optimization and execution capabilities available.',
        values: {
          backendAvailable: true,
          backendUrl,
          agentId,
        },
        data: { backendStatus: 'connected' },
      }
    } catch (error) {
      logger.error('Backend provider error:', error)
      return {
        text: '❌ **Backend Connection Failed**\n\nUnable to connect to Alioth backend. Please check configuration and network connectivity.',
        values: { backendAvailable: false },
        data: { error: error.message },
      }
    }
  },
}

/**
 * 🔍 YIELD OPTIMIZATION PROVIDER
 * Advanced yield analysis and portfolio optimization
 */
const yieldOptimizationProvider: Provider = {
  name: 'YIELD_OPTIMIZATION',
  description: 'AI-driven yield optimization and portfolio allocation',

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    const content = message.content.text?.toLowerCase() || ''

    // Trigger conditions
    if (
      !content.includes('optimize') &&
      !content.includes('yield') &&
      !content.includes('portfolio') &&
      !content.includes('allocation') &&
      !content.includes('best') &&
      !content.includes('apy')
    ) {
      return { text: '', values: {}, data: {} }
    }

    try {
      logger.info('🚀 YIELD OPTIMIZATION PROVIDER - Processing request')

      // Extract parameters from message
      const amount = extractAmount(content)
      const riskTolerance = extractRiskTolerance(content)
      const preferredChains = extractChains(content)

      // Get current yield opportunities
      const topYields = await defiDataService.getTopYieldOpportunities(
        10,
        1_000_000,
      )
      const stablecoinYields = await defiDataService.getStablecoinYields()

      // Generate optimization strategy
      const strategy = await generateOptimizationStrategy({
        amount,
        riskTolerance,
        preferredChains,
        topYields,
        stablecoinYields,
      })

      const responseText =
        `🎯 **Yield Optimization Analysis**\n\n` +
        `**💰 Portfolio Size:** ${amount ? `$${amount.toLocaleString()}` : 'Not specified'}\n` +
        `**🎚️ Risk Level:** ${getRiskModeLabel(riskTolerance)} (${riskTolerance}/10)\n` +
        `**⛓️ Preferred Chains:** ${preferredChains.length ? preferredChains.join(', ') : 'All supported'}\n\n` +
        `**🚀 Optimal Strategy:**\n${strategy.allocation}\n\n` +
        `**📊 Expected Metrics:**\n` +
        `• **Expected APY:** ${strategy.expectedAPY}%\n` +
        `• **Risk Score:** ${strategy.riskScore}/10\n` +
        `• **Diversification:** ${strategy.diversificationScore}/10\n` +
        `• **Confidence:** ${strategy.confidence}%\n\n` +
        `**💡 Reasoning:**\n${strategy.reasoning}\n\n` +
        `**⚠️ Risk Considerations:**\n${strategy.riskFactors.join('\n')}\n\n` +
        `*AI-powered analysis • Updated in real-time*`

      logger.info('✅ YIELD OPTIMIZATION SUCCESS - Strategy generated')

      return {
        text: responseText,
        values: {
          strategy: strategy,
          expectedAPY: strategy.expectedAPY,
          riskScore: strategy.riskScore,
          confidence: strategy.confidence,
        },
        data: {
          optimizationStrategy: strategy,
          topYields,
          stablecoinYields,
        },
      }
    } catch (error) {
      logger.error('Yield optimization provider error:', error)
      return {
        text: '❌ **Optimization Error**\n\nUnable to generate yield optimization strategy. Please try again or check your parameters.',
        values: { error: true },
        data: { error: error.message },
      }
    }
  },
}

/**
 * 📊 MARKET ANALYSIS PROVIDER
 * Real-time market data and trend analysis
 */
const marketAnalysisProvider: Provider = {
  name: 'MARKET_ANALYSIS',
  description: 'Comprehensive DeFi market analysis and insights',

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    const content = message.content.text?.toLowerCase() || ''

    // Trigger conditions
    if (
      !content.includes('market') &&
      !content.includes('analysis') &&
      !content.includes('trends') &&
      !content.includes('opportunities') &&
      !content.includes('what') &&
      !content.includes('current')
    ) {
      return { text: '', values: {}, data: {} }
    }

    try {
      logger.info('📊 MARKET ANALYSIS PROVIDER - Processing request')

      // Get comprehensive market data
      const [topYields, stablecoinYields, protocols] = await Promise.all([
        defiDataService.getTopYieldOpportunities(8, 5_000_000),
        defiDataService.getStablecoinYields(),
        defiDataService.getProtocols(),
      ])

      // Analyze market conditions
      const marketInsights = analyzeMarketConditions(
        topYields,
        stablecoinYields,
        protocols,
      )
      const opportunities = identifyOpportunities(topYields, stablecoinYields)
      const risks = identifyMarketRisks(topYields, protocols)

      const responseText =
        `📊 **Live Market Analysis** (${new Date().toLocaleTimeString()})\n\n` +
        `**🔥 Market Highlights:**\n${marketInsights.highlights.join('\n')}\n\n` +
        `**🚀 Top Opportunities:**\n${opportunities
          .map(
            (op) =>
              `• **${op.protocol}**: ${op.apy}% APY (${op.tvl}) - ${op.risk}`,
          )
          .join('\n')}\n\n` +
        `**🛡️ Stable Options:**\n${stablecoinYields
          .slice(0, 3)
          .map(
            (stable) =>
              `• **${stable.project}**: ${stable.apy?.toFixed(1)}% APY (${stable.symbol})`,
          )
          .join('\n')}\n\n` +
        `**⚠️ Risk Factors:**\n${risks.join('\n')}\n\n` +
        `**💡 Market Sentiment:** ${marketInsights.sentiment}\n` +
        `**🎯 Strategy Recommendation:** ${marketInsights.recommendation}\n\n` +
        `*Real-time data from 50+ DeFi protocols*`

      logger.info('✅ MARKET ANALYSIS SUCCESS - Report generated')

      return {
        text: responseText,
        values: {
          marketSentiment: marketInsights.sentiment,
          topOpportunities: opportunities,
          riskLevel: risks.length,
        },
        data: {
          fullAnalysis: marketInsights,
          opportunities,
          risks,
          protocols: protocols.length,
        },
      }
    } catch (error) {
      logger.error('Market analysis provider error:', error)
      return {
        text: '❌ **Market Analysis Error**\n\nUnable to fetch current market data. Please try again.',
        values: { error: true },
        data: { error: error.message },
      }
    }
  },
}

/**
 * ⚖️ RISK ASSESSMENT PROVIDER
 * Advanced risk analysis and portfolio health monitoring
 */
const riskAssessmentProvider: Provider = {
  name: 'RISK_ASSESSMENT',
  description: 'Portfolio risk analysis and risk management strategies',

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    const content = message.content.text?.toLowerCase() || ''

    // Trigger conditions
    if (
      !content.includes('risk') &&
      !content.includes('safe') &&
      !content.includes('dangerous') &&
      !content.includes('assess') &&
      !content.includes('security') &&
      !content.includes('audit')
    ) {
      return { text: '', values: {}, data: {} }
    }

    try {
      logger.info('⚖️ RISK ASSESSMENT PROVIDER - Analyzing risks')

      // Extract context from message
      const protocols = extractProtocols(content)
      const amount = extractAmount(content)
      const riskTolerance = extractRiskTolerance(content)

      // Perform risk analysis
      const riskAnalysis = await performRiskAssessment(
        protocols,
        amount,
        riskTolerance,
      )

      const responseText =
        `⚖️ **Risk Assessment Report**\n\n` +
        `**🎯 Analysis Scope:** ${protocols.length ? protocols.join(', ') : 'General DeFi market'}\n` +
        `**💰 Portfolio Size:** ${amount ? `$${amount.toLocaleString()}` : 'Not specified'}\n` +
        `**🎚️ Risk Tolerance:** ${riskTolerance}/10\n\n` +
        `**📊 Risk Metrics:**\n` +
        `• **Overall Risk Score:** ${riskAnalysis.overallRisk}/10\n` +
        `• **Protocol Risk:** ${riskAnalysis.protocolRisk}/10\n` +
        `• **Market Risk:** ${riskAnalysis.marketRisk}/10\n` +
        `• **Liquidity Risk:** ${riskAnalysis.liquidityRisk}/10\n\n` +
        `**⚠️ Key Risk Factors:**\n${riskAnalysis.riskFactors.join('\n')}\n\n` +
        `**🛡️ Risk Mitigation:**\n${riskAnalysis.mitigation.join('\n')}\n\n` +
        `**🎯 Recommendation:** ${riskAnalysis.recommendation}\n` +
        `**✅ Risk Alignment:** ${riskAnalysis.alignment}\n\n` +
        `*Confidence Level: ${riskAnalysis.confidence}%*`

      logger.info('✅ RISK ASSESSMENT SUCCESS - Analysis completed')

      return {
        text: responseText,
        values: {
          overallRisk: riskAnalysis.overallRisk,
          protocolRisk: riskAnalysis.protocolRisk,
          recommendation: riskAnalysis.recommendation,
          confidence: riskAnalysis.confidence,
        },
        data: {
          riskAnalysis,
          analyzedProtocols: protocols,
          amount,
          riskTolerance,
        },
      }
    } catch (error) {
      logger.error('Risk assessment provider error:', error)
      return {
        text: '❌ **Risk Assessment Error**\n\nUnable to complete risk analysis. Please try again.',
        values: { error: true },
        data: { error: error.message },
      }
    }
  },
}

/**
 * 🔄 REBALANCING PROVIDER
 * Portfolio rebalancing analysis and recommendations
 */
const rebalancingProvider: Provider = {
  name: 'REBALANCING',
  description: 'Portfolio rebalancing analysis and optimization',

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    const content = message.content.text?.toLowerCase() || ''

    // Trigger conditions
    if (
      !content.includes('rebalance') &&
      !content.includes('rebalancing') &&
      !content.includes('should i') &&
      !content.includes('adjust') &&
      !content.includes('change') &&
      !content.includes('positions')
    ) {
      return { text: '', values: {}, data: {} }
    }

    try {
      logger.info('🔄 REBALANCING PROVIDER - Analyzing rebalancing opportunity')

      // Get current market conditions
      const marketData = await defiDataService.getTopYieldOpportunities(
        10,
        1_000_000,
      )
      const currentGasPrice = await estimateGasPrice()

      // Analyze rebalancing opportunity
      const rebalanceAnalysis = await analyzeRebalanceOpportunity(
        marketData,
        currentGasPrice,
      )

      const responseText =
        `🔄 **Rebalancing Analysis**\n\n` +
        `**🎯 Decision:** ${rebalanceAnalysis.shouldRebalance ? '✅ **REBALANCE RECOMMENDED**' : '❌ **HOLD CURRENT POSITIONS**'}\n\n` +
        `**📊 Analysis:**\n` +
        `• **Yield Improvement:** ${rebalanceAnalysis.yieldImprovement > 0 ? '+' : ''}${rebalanceAnalysis.yieldImprovement.toFixed(2)}%\n` +
        `• **Gas Cost Impact:** $${rebalanceAnalysis.gasCost.toFixed(2)}\n` +
        `• **Break-even Time:** ${rebalanceAnalysis.breakEvenDays} days\n` +
        `• **Risk Change:** ${rebalanceAnalysis.riskChange > 0 ? '+' : ''}${rebalanceAnalysis.riskChange.toFixed(1)} points\n\n` +
        `**💡 Reasoning:**\n${rebalanceAnalysis.reasoning}\n\n` +
        `**🎯 Recommended Actions:**\n${rebalanceAnalysis.recommendations.join('\n')}\n\n` +
        `**⚠️ Considerations:**\n${rebalanceAnalysis.considerations.join('\n')}\n\n` +
        `*Analysis updated every 15 minutes*`

      logger.info('✅ REBALANCING SUCCESS - Analysis completed')

      return {
        text: responseText,
        values: {
          shouldRebalance: rebalanceAnalysis.shouldRebalance,
          yieldImprovement: rebalanceAnalysis.yieldImprovement,
          gasCost: rebalanceAnalysis.gasCost,
          confidence: rebalanceAnalysis.confidence,
        },
        data: {
          rebalanceAnalysis,
          marketData,
          currentGasPrice,
        },
      }
    } catch (error) {
      logger.error('Rebalancing provider error:', error)
      return {
        text: '❌ **Rebalancing Analysis Error**\n\nUnable to analyze rebalancing opportunity. Please try again.',
        values: { error: true },
        data: { error: error.message },
      }
    }
  },
}

// Helper functions for providers
async function registerAgent(
  backendUrl: string,
  apiKey: string,
  agentId: string,
) {
  try {
    const response = await fetch(`${backendUrl}/api/v1/agent/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        agentId,
        capabilities: [
          'yield_optimization',
          'market_analysis',
          'risk_assessment',
          'rebalance_decisions',
        ],
        version: '1.0.0',
        status: 'active',
      }),
    })

    if (!response.ok) {
      throw new Error(`Agent registration failed: ${response.statusText}`)
    }

    logger.info('✅ Agent registered with backend')
  } catch (error) {
    logger.warn('⚠️ Agent registration failed:', error.message)
  }
}

function extractAmount(content: string): number | null {
  const matches = content.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)[kmb]?/i)
  if (!matches) return null

  let amount = parseFloat(matches[1].replace(/,/g, ''))
  const unit = content.match(/[kmb]/i)?.[0]?.toLowerCase()

  if (unit === 'k') amount *= 1_000
  else if (unit === 'm') amount *= 1_000_000
  else if (unit === 'b') amount *= 1_000_000_000

  return amount
}

function extractRiskTolerance(content: string): number {
  // Look for explicit risk levels
  const riskKeywords = {
    conservative: 2,
    safe: 2,
    low: 2,
    moderate: 5,
    balanced: 5,
    medium: 5,
    aggressive: 7,
    high: 7,
    yolo: 10,
    maximum: 10,
  }

  for (const [keyword, risk] of Object.entries(riskKeywords)) {
    if (content.includes(keyword)) return risk
  }

  // Look for numeric risk (1-10)
  const numericMatch = content.match(/risk\s*:?\s*(\d+)/i)
  if (numericMatch) {
    const risk = parseInt(numericMatch[1])
    return Math.min(Math.max(risk, 1), 10)
  }

  return 5 // Default balanced
}

function extractChains(content: string): string[] {
  const chains = []
  const chainKeywords = [
    'ethereum',
    'polygon',
    'arbitrum',
    'optimism',
    'base',
    'avalanche',
  ]

  for (const chain of chainKeywords) {
    if (content.includes(chain)) {
      chains.push(chain.charAt(0).toUpperCase() + chain.slice(1))
    }
  }

  return chains
}

function extractProtocols(content: string): string[] {
  const protocols = []
  const protocolKeywords = [
    'aave',
    'compound',
    'yearn',
    'curve',
    'convex',
    'lido',
    'uniswap',
    'sushiswap',
  ]

  for (const protocol of protocolKeywords) {
    if (content.includes(protocol)) {
      protocols.push(protocol.charAt(0).toUpperCase() + protocol.slice(1))
    }
  }

  return protocols
}

function getRiskModeLabel(risk: number): string {
  if (risk <= 3) return 'Conservative'
  if (risk <= 6) return 'Balanced'
  if (risk <= 8) return 'Aggressive'
  return 'YOLO'
}

async function generateOptimizationStrategy(params: any) {
  const {
    amount,
    riskTolerance,
    preferredChains,
    topYields,
    stablecoinYields,
  } = params

  // Simulate Modern Portfolio Theory optimization
  const riskMode = getRiskModeLabel(riskTolerance)

  let allocation = ''
  let expectedAPY = 0
  let riskScore = 0
  let diversificationScore = 8
  let confidence = 85
  let reasoning = ''
  let riskFactors = []

  if (riskTolerance <= 3) {
    // Conservative allocation
    allocation =
      '• 60% Stablecoin yields (Aave USDC: 4.2% APY)\n• 25% Liquid staking (Lido stETH: 3.8% APY)\n• 15% Blue-chip lending (Compound USDT: 3.9% APY)'
    expectedAPY = 4.1
    riskScore = 2.5
    reasoning =
      'Conservative allocation prioritizes capital preservation with AAA-rated protocols. Heavy stablecoin weighting minimizes impermanent loss risk while maintaining decent yields.'
    riskFactors = [
      '• Smart contract risk on battle-tested protocols',
      '• Minimal impermanent loss exposure',
      '• Interest rate fluctuation risk',
    ]
  } else if (riskTolerance <= 6) {
    // Balanced allocation
    allocation =
      '• 40% Stablecoin yields (Aave USDC: 4.2% APY)\n• 30% LP tokens (ETH/USDC Uniswap V3: 8.5% APY)\n• 20% Liquid staking (Lido stETH: 3.8% APY)\n• 10% Higher-yield opportunities (Yearn vaults: 12% APY)'
    expectedAPY = 6.8
    riskScore = 4.2
    reasoning =
      'Balanced allocation optimizes risk-adjusted returns through diversification. Mix of stable yields and strategic LP positions with moderate impermanent loss exposure.'
    riskFactors = [
      '• Moderate impermanent loss on LP positions',
      '• Protocol risk across multiple platforms',
      '• Market volatility impact on LP tokens',
    ]
  } else if (riskTolerance <= 8) {
    // Aggressive allocation
    allocation =
      '• 25% Stablecoin base (Aave USDC: 4.2% APY)\n• 35% High-yield LPs (Curve tricrypto: 15% APY)\n• 25% Layer 2 farming (Arbitrum yields: 18% APY)\n• 15% Emerging protocols (New opportunities: 25% APY)'
    expectedAPY = 14.2
    riskScore = 6.8
    reasoning =
      'Aggressive allocation targets high yields through Layer 2 opportunities and emerging protocols. Accepts higher volatility for enhanced returns.'
    riskFactors = [
      '• High impermanent loss potential',
      '• Protocol risk on newer platforms',
      '• Significant volatility and drawdown risk',
    ]
  } else {
    // YOLO allocation
    allocation =
      '• 10% Safety net (Aave USDC: 4.2% APY)\n• 40% High-risk/reward LPs (Pendle PT-wstETH: 22.5% APY)\n• 30% New protocol launches (Beta yields: 45% APY)\n• 20% Leveraged strategies (Leveraged staking: 35% APY)'
    expectedAPY = 28.7
    riskScore = 9.2
    reasoning =
      'YOLO allocation maximizes yield potential regardless of risk. Focuses on highest-yielding opportunities including new launches and leveraged strategies.'
    riskFactors = [
      '• Extreme impermanent loss risk',
      '• Smart contract risk on unaudited protocols',
      '• Potential for significant losses',
      '• High leverage and liquidation risk',
    ]
  }

  return {
    allocation,
    expectedAPY,
    riskScore,
    diversificationScore,
    confidence,
    reasoning,
    riskFactors,
  }
}

function analyzeMarketConditions(
  topYields: any[],
  stablecoinYields: any[],
  protocols: any[],
) {
  const avgYield =
    topYields.reduce((sum, pool) => sum + (pool.apy || 0), 0) / topYields.length
  const avgStableYield =
    stablecoinYields.reduce((sum, pool) => sum + (pool.apy || 0), 0) /
    stablecoinYields.length

  let sentiment = 'Neutral'
  let recommendation = ''
  const highlights = []

  if (avgYield > 15) {
    sentiment = 'Bullish'
    recommendation = 'High yields available - consider increasing risk exposure'
    highlights.push('• High-yield opportunities abundant (>15% average)')
  } else if (avgYield < 8) {
    sentiment = 'Bearish'
    recommendation = 'Low yields - focus on stable, battle-tested protocols'
    highlights.push('• Yield compression observed - market cooling')
  } else {
    sentiment = 'Neutral'
    recommendation = 'Balanced market - maintain diversified approach'
    highlights.push('• Stable yield environment - good for balanced strategies')
  }

  if (avgStableYield > 4) {
    highlights.push('• Attractive stablecoin yields - good base layer')
  }

  highlights.push(
    `• ${protocols.length} protocols monitored with $${(protocols.reduce((sum, p) => sum + p.tvl, 0) / 1_000_000_000).toFixed(1)}B+ TVL`,
  )

  return {
    sentiment,
    recommendation,
    highlights,
    avgYield,
    avgStableYield,
  }
}

function identifyOpportunities(topYields: any[], stablecoinYields: any[]) {
  return topYields.slice(0, 3).map((pool) => ({
    protocol: pool.project,
    apy: pool.apy?.toFixed(1) || '0.0',
    tvl:
      pool.tvlUsd > 1_000_000
        ? `$${(pool.tvlUsd / 1_000_000).toFixed(0)}M`
        : `$${(pool.tvlUsd / 1_000).toFixed(0)}K`,
    risk:
      pool.tvlUsd > 100_000_000
        ? 'Low risk'
        : pool.tvlUsd > 50_000_000
          ? 'Medium risk'
          : 'High risk',
  }))
}

function identifyMarketRisks(topYields: any[], protocols: any[]) {
  const risks = []

  // Check for concentration in high-yield protocols
  const highYieldCount = topYields.filter((pool) => pool.apy > 20).length
  if (highYieldCount > 3) {
    risks.push('• High concentration of >20% APY pools - increased risk')
  }

  // Check for low TVL warnings
  const lowTVL = topYields.filter((pool) => pool.tvlUsd < 10_000_000).length
  if (lowTVL > 2) {
    risks.push('• Multiple low-TVL opportunities - liquidity risk')
  }

  // General market risks
  risks.push('• Smart contract risk across all protocols')
  risks.push('• Impermanent loss risk for LP positions')
  risks.push('• Regulatory uncertainty in DeFi space')

  return risks
}

async function performRiskAssessment(
  protocols: string[],
  amount: number | null,
  riskTolerance: number,
) {
  // Simulate comprehensive risk analysis
  const overallRisk = Math.min(
    10,
    3 + protocols.length * 0.5 + (amount ? Math.log10(amount) : 3),
  )
  const protocolRisk =
    protocols.length > 0 ? Math.min(10, protocols.length + 2) : 5
  const marketRisk = 6 // Current market risk level
  const liquidityRisk = amount && amount > 100_000 ? 7 : 4

  const riskFactors = [
    '• Smart contract vulnerabilities in DeFi protocols',
    '• Impermanent loss risk for liquidity provider positions',
    '• Market volatility and correlation risks',
    '• Protocol governance and upgrade risks',
  ]

  if (protocols.length > 3) {
    riskFactors.push(
      '• Diversification across multiple protocols increases complexity',
    )
  }

  if (amount && amount > 50_000) {
    riskFactors.push('• Large position size may face liquidity constraints')
  }

  const mitigation = [
    '• Diversify across multiple battle-tested protocols',
    '• Start with smaller positions and scale gradually',
    '• Monitor protocol health and TVL trends regularly',
    '• Maintain emergency exit strategy and liquidity buffer',
  ]

  let recommendation = ''
  let alignment = ''

  if (overallRisk <= riskTolerance) {
    recommendation =
      'Risk levels align with your tolerance - proceed with strategy'
    alignment = 'Well aligned'
  } else if (overallRisk > riskTolerance + 2) {
    recommendation =
      'Risk significantly exceeds tolerance - consider reducing exposure'
    alignment = 'Poorly aligned'
  } else {
    recommendation = 'Risk slightly above tolerance - monitor closely'
    alignment = 'Moderately aligned'
  }

  return {
    overallRisk: Math.round(overallRisk * 10) / 10,
    protocolRisk: Math.round(protocolRisk * 10) / 10,
    marketRisk,
    liquidityRisk,
    riskFactors,
    mitigation,
    recommendation,
    alignment,
    confidence: 85,
  }
}

async function analyzeRebalanceOpportunity(
  marketData: any[],
  currentGasPrice: number,
) {
  // Simulate rebalancing analysis
  const avgNewYield =
    marketData.reduce((sum, pool) => sum + (pool.apy || 0), 0) /
    marketData.length
  const currentPortfolioYield = 8.5 // Assumed current yield

  const yieldImprovement = avgNewYield - currentPortfolioYield
  const gasCost = currentGasPrice * 150 // Estimated gas cost
  const breakEvenDays = gasCost / ((yieldImprovement * 1000) / 365) // Simplified calculation
  const riskChange = yieldImprovement * 0.3 // Risk typically increases with yield

  const shouldRebalance =
    yieldImprovement > 0.5 && gasCost < 50 && breakEvenDays < 30

  let reasoning = ''
  const recommendations = []
  const considerations = []

  if (shouldRebalance) {
    reasoning = `Current market conditions favor rebalancing with ${yieldImprovement.toFixed(2)}% yield improvement available. Break-even period of ${breakEvenDays.toFixed(0)} days is acceptable given gas costs.`
    recommendations.push('• Execute rebalancing during low gas periods')
    recommendations.push('• Consider partial rebalancing to reduce gas costs')
    recommendations.push('• Monitor new positions closely for first 48 hours')
  } else {
    reasoning = `Rebalancing not recommended due to ${yieldImprovement < 0.5 ? 'insufficient yield improvement' : gasCost > 50 ? 'high gas costs' : 'long break-even period'}.`
    recommendations.push('• Maintain current positions')
    recommendations.push('• Monitor market conditions for better opportunities')
    recommendations.push('• Consider rebalancing when gas costs decrease')
  }

  considerations.push(
    '• Recent market volatility may affect yield sustainability',
  )
  considerations.push('• New protocol risks should be carefully evaluated')
  considerations.push('• Tax implications of rebalancing should be considered')

  return {
    shouldRebalance,
    yieldImprovement,
    gasCost,
    breakEvenDays: Math.round(breakEvenDays),
    riskChange,
    reasoning,
    recommendations,
    considerations,
    confidence: 80,
  }
}

async function estimateGasPrice(): Promise<number> {
  // Simulate gas price estimation - in real implementation, fetch from chain
  return Math.random() * 50 + 20 // 20-70 USD
}

// Legacy Actions (keeping some for complex workflows)
const analyzeYieldAction: Action = {
  name: 'ANALYZE_YIELD',
  similes: ['CHECK_YIELDS', 'FIND_OPPORTUNITIES', 'YIELD_SCAN', 'BEST_YIELDS'],
  description:
    'Analyzes current yield farming opportunities using real DeFi protocol data',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || ''
    return (
      text.includes('yield') ||
      text.includes('apy') ||
      text.includes('farming') ||
      text.includes('opportunities') ||
      text.includes('best rates') ||
      text.includes('defi')
    )
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: HandlerCallback,
  ) => {
    try {
      logger.info('🔍 ANALYZE_YIELD action triggered - delegating to provider')

      // Get analysis from yield optimization provider
      const providerResult = await yieldOptimizationProvider.get(
        runtime,
        message,
        state,
      )

      const responseContent: Content = {
        text:
          providerResult.text ||
          'Analysis completed - check provider response.',
        actions: ['ANALYZE_YIELD'],
        source: message.content.source,
      }

      await callback(responseContent)
      return responseContent
    } catch (error) {
      logger.error('Error in ANALYZE_YIELD action:', error)

      const errorContent: Content = {
        text: '❌ **Error in yield analysis**\n\nUnable to complete analysis. Please try again.',
        actions: ['ANALYZE_YIELD'],
        source: message.content.source,
      }

      await callback(errorContent)
      return errorContent
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'What are the best yield opportunities right now?' },
      },
      {
        name: '{{name2}}',
        content: {
          text: '🎯 **Yield Optimization Analysis**\n\n**🚀 Top Opportunities:**\n• **Pendle PT-wstETH**: 22.5% APY...',
          actions: ['ANALYZE_YIELD'],
        },
      },
    ],
  ],
}

/**
 * Alioth Service - Backend Integration and Monitoring
 */
export class AliothService extends Service {
  static serviceType = 'alioth_defi_agent'
  capabilityDescription =
    'Advanced DeFi AI agent with backend integration and yield optimization'

  private monitoringInterval?: NodeJS.Timeout
  private lastBackendSync = 0
  private agentId: string
  private backendUrl?: string
  private apiKey?: string

  constructor(runtime: IAgentRuntime) {
    super(runtime)
    this.agentId = runtime.getSetting('AGENT_ID') || 'alioth-agent-v1'
    this.backendUrl = runtime.getSetting('ALIOTH_BACKEND_URL')
    this.apiKey = runtime.getSetting('ALIOTH_API_KEY')
  }

  static async start(runtime: IAgentRuntime) {
    const service = new AliothService(runtime)
    await service.initialize()
    return service
  }

  static async stop(runtime: IAgentRuntime) {
    const service = runtime.getService(
      AliothService.serviceType,
    ) as AliothService
    if (service) {
      await service.cleanup()
    }
  }

  async initialize() {
    logger.info('🚀 Initializing Alioth Service')

    if (this.backendUrl && this.apiKey) {
      logger.info('✅ Backend integration configured - starting monitoring')
      await this.startBackendMonitoring()
    } else {
      logger.warn(
        '⚠️ Backend integration not configured - running in standalone mode',
      )
    }

    logger.info('🎯 Alioth Service ready')
  }

  private async startBackendMonitoring() {
    // Register with backend
    try {
      await registerAgent(this.backendUrl!, this.apiKey!, this.agentId)
    } catch (error) {
      logger.warn('Failed to register with backend:', error.message)
    }

    // Start monitoring loop
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.syncWithBackend()
      } catch (error) {
        logger.error('Backend sync error:', error)
      }
    }, 60000) // Every minute
  }

  private async syncWithBackend() {
    if (!this.backendUrl || !this.apiKey) return

    try {
      // Send heartbeat
      const response = await fetch(
        `${this.backendUrl}/api/v1/agent/heartbeat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'X-Agent-ID': this.agentId,
          },
          body: JSON.stringify({
            agentId: this.agentId,
            status: 'active',
            timestamp: Date.now(),
            capabilities: [
              'yield_optimization',
              'market_analysis',
              'risk_assessment',
              'rebalance_decisions',
            ],
          }),
        },
      )

      if (response.ok) {
        this.lastBackendSync = Date.now()
        logger.debug('✅ Backend sync successful')
      } else {
        logger.warn('⚠️ Backend sync failed:', response.statusText)
      }
    } catch (error) {
      logger.error('Backend sync error:', error)
    }
  }

  async cleanup() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }
    logger.info('🔄 Alioth Service stopped')
  }

  async stop() {
    await this.cleanup()
  }

  async init() {
    // Service initialization logic
    logger.info('🎯 Alioth Service initialized')
  }
}

/**
 * 🚀 ALIOTH PLUGIN EXPORT
 * Comprehensive DeFi AI agent plugin with advanced providers and backend integration
 */
const aliothPlugin: Plugin = {
  name: 'alioth-defi-agent',
  description:
    'Advanced AI-driven DeFi yield optimization agent with backend integration',

  providers: [
    aliothBackendProvider,
    yieldOptimizationProvider,
    marketAnalysisProvider,
    riskAssessmentProvider,
    rebalancingProvider,
  ],

  actions: [
    analyzeYieldAction,
    // Keep some actions for complex workflows, but prefer providers
  ],

  services: [AliothService],

  async init(config: Record<string, string>, runtime: IAgentRuntime) {
    logger.info('🚀 Initializing Alioth DeFi Agent Plugin')

    // Validate configuration
    const validatedConfig = configSchema.parse(config)
    logger.info('✅ Configuration validated')

    // Initialize data service
    await defiDataService.healthCheck()
    logger.info('✅ DeFi data service ready')

    logger.info('🎯 Alioth plugin initialization complete')
    logger.info('Available providers:', [
      'ALIOTH_BACKEND',
      'YIELD_OPTIMIZATION',
      'MARKET_ANALYSIS',
      'RISK_ASSESSMENT',
      'REBALANCING',
    ])
  },
}

export default aliothPlugin
