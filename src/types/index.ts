/**
 * Alioth DeFi Agent - Type Definitions
 * Comprehensive TypeScript types for all agent operations
 */

// ========== CORE AGENT TYPES ==========

export interface AliothAgentConfig {
  agentId: string
  backendUrl?: string
  apiKey?: string
  mode: PersonalityMode
  capabilities: AgentCapability[]
  riskSettings: RiskSettings
}

export type AgentCapability =
  | 'yield_optimization'
  | 'market_analysis'
  | 'risk_assessment'
  | 'rebalance_decisions'
  | 'portfolio_management'
  | 'cross_chain_operations'

export type PersonalityMode =
  | 'conservative'
  | 'balanced'
  | 'aggressive'
  | 'yolo'

// ========== OPTIMIZATION TYPES ==========

export interface OptimizationRequest {
  userAddress: string
  inputToken: string
  inputAmount: string
  riskTolerance: number // 1-10 scale
  mode?: PersonalityMode
  preferredChains?: string[]
  blacklistedProtocols?: string[]
  maxSlippage?: number
  timeHorizon?: 'short' | 'medium' | 'long'
}

export interface OptimizationStrategy {
  operationId: string
  userAddress: string
  inputDetails: {
    inputToken: string
    inputAmount: string
    riskTolerance: number
    mode: PersonalityMode
  }
  tokenAllocations: TokenAllocation[]
  swapRoutes: SwapRoute[]
  protocolDeposits: ProtocolDeposit[]
  expectedAPY: number
  riskScore: number
  diversificationScore: number
  confidence: number
  reasoning: string
  expiresAt: number
  gasEstimate: GasEstimate
}

export interface TokenAllocation {
  token: string
  symbol: string
  name: string
  percentage: number
  amount: string
  expectedAPY: number
  riskScore: number
  protocol?: string
  chain: string
  reasoning: string
}

export interface SwapRoute {
  inputToken: string
  outputToken: string
  amount: string
  expectedOutput: string
  route: string[]
  protocol: string
  gasEstimate: string
  slippage: number
  priceImpact: number
  deadline: number
}

export interface ProtocolDeposit {
  protocol: string
  token: string
  amount: string
  expectedAPY: number
  gasEstimate: string
  contractAddress: string
  methodName: string
  parameters: any[]
}

export interface GasEstimate {
  totalGasLimit: string
  gasPrice: string
  totalCostUSD: number
  optimized: boolean
  batchable: boolean
}

// ========== MARKET ANALYSIS TYPES ==========

export interface MarketAnalysisRequest {
  tokens?: string[]
  protocols?: string[]
  chains?: string[]
  timeframe?: '1h' | '24h' | '7d' | '30d'
  includeCorrelations?: boolean
  riskAssessment?: boolean
}

export interface MarketAnalysis {
  timestamp: Date
  timeframe: string
  tokens: TokenMarketData[]
  protocols: ProtocolMarketData[]
  opportunities: YieldOpportunity[]
  risks: RiskFactor[]
  correlations?: CorrelationMatrix
  insights: MarketInsight[]
  recommendations: string[]
  sentiment: MarketSentiment
}

export interface TokenMarketData {
  address: string
  symbol: string
  name: string
  price: number
  priceChange24h: number
  priceChange7d: number
  volume24h: number
  marketCap: number
  bestYield: number
  avgYield: number
  riskScore: number
  volatility: number
  liquidityScore: number
}

export interface ProtocolMarketData {
  name: string
  tvl: number
  tvlChange24h: number
  category: string
  chains: string[]
  avgAPY: number
  riskScore: number
  auditScore: number
  governanceScore: number
}

export interface YieldOpportunity {
  protocol: string
  pool: string
  chain: string
  symbol: string
  apy: number
  tvlUsd: number
  riskLevel: 'low' | 'medium' | 'high'
  category: string
  requirements: string[]
  warnings: string[]
}

export interface MarketInsight {
  type: 'trend' | 'opportunity' | 'risk' | 'anomaly'
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  timeRelevant: boolean
  actionable: boolean
}

export type MarketSentiment = 'bullish' | 'bearish' | 'neutral' | 'volatile'

// ========== RISK ASSESSMENT TYPES ==========

export interface RiskAssessmentRequest {
  portfolio?: Portfolio
  allocation?: TokenAllocation[]
  protocols?: string[]
  amount?: number
  riskTolerance: number
  timeHorizon?: string
}

export interface RiskAssessment {
  portfolioRisk: PortfolioRisk
  protocolRisks: ProtocolRisk[]
  marketRisks: MarketRisk[]
  riskFactors: RiskFactor[]
  mitigation: RiskMitigation[]
  riskAlignment: RiskAlignment
  recommendations: string[]
  confidence: number
  lastUpdated: Date
}

export interface PortfolioRisk {
  totalRiskScore: number // 1-10 scale
  volatility: number // annualized
  maxDrawdown: number // percentage
  valueAtRisk: number // 5% VaR
  expectedShortfall: number // conditional VaR
  beta: number // market beta
  sharpeRatio: number
  concentrationRisk: number
  correlationRisk: number
  liquidityRisk: number
}

export interface ProtocolRisk {
  protocol: string
  overallRisk: number
  smartContractRisk: number
  governanceRisk: number
  liquidityRisk: number
  operationalRisk: number
  auditHistory: AuditInfo[]
  tvlStability: number
  timeInOperation: number
  incidentHistory: SecurityIncident[]
}

export interface MarketRisk {
  type: 'systematic' | 'market' | 'liquidity' | 'operational'
  description: string
  impact: number
  probability: number
  mitigation: string[]
}

export interface RiskFactor {
  category: 'protocol' | 'market' | 'technical' | 'regulatory'
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  likelihood: number
  impact: number
  timeframe: string
}

export interface RiskMitigation {
  riskType: string
  strategy: string
  effectiveness: number
  cost: number
  timeToImplement: string
}

export interface RiskAlignment {
  score: number // how well portfolio aligns with risk tolerance
  recommendation: 'increase' | 'decrease' | 'maintain' | 'rebalance'
  reasoning: string
}

// ========== REBALANCING TYPES ==========

export interface RebalanceAnalysisRequest {
  currentPortfolio: Portfolio
  targetAllocation?: TokenAllocation[]
  marketConditions?: MarketAnalysis
  gasPrice?: number
  urgency?: 'low' | 'medium' | 'high'
}

export interface RebalanceAnalysis {
  shouldRebalance: boolean
  urgency: 'low' | 'medium' | 'high'
  yieldImprovement: number
  riskReduction: number
  gasCost: number
  breakEvenDays: number
  optimalTiming: Date
  rebalanceSteps: RebalanceStep[]
  reasoning: string
  recommendations: string[]
  considerations: string[]
  confidence: number
}

export interface RebalanceStep {
  order: number
  action: 'withdraw' | 'swap' | 'deposit'
  protocol: string
  token: string
  amount: string
  gasEstimate: string
  expectedOutcome: string
  risks: string[]
}

// ========== PORTFOLIO TYPES ==========

export interface Portfolio {
  userAddress: string
  totalValueUSD: number
  positions: Position[]
  performance: PerformanceMetrics
  lastUpdated: Date
  riskProfile: RiskProfile
}

export interface Position {
  protocol: string
  token: string
  symbol: string
  amount: string
  valueUSD: number
  apy: number
  dailyYield: number
  riskScore: number
  timeHeld: number
  unrealizedPnL: number
  fees: number
}

export interface PerformanceMetrics {
  totalReturn: number
  annualizedReturn: number
  maxDrawdown: number
  sharpeRatio: number
  volatility: number
  alpha: number
  beta: number
  winRate: number
  avgHoldingPeriod: number
}

export interface RiskProfile {
  tolerance: number // 1-10
  capacity: number // financial capacity for risk
  timeHorizon: string
  objectives: string[]
  constraints: string[]
}

// ========== BACKEND INTEGRATION TYPES ==========

export interface BackendApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
  requestId: string
}

export interface AgentRegistration {
  agentId: string
  capabilities: AgentCapability[]
  version: string
  status: 'active' | 'inactive' | 'maintenance'
  webhookUrl?: string
  metadata?: Record<string, any>
}

export interface AgentRequest {
  requestId: string
  agentId: string
  requestType: string
  requestData: any
  priority: 'low' | 'medium' | 'high'
  timeout: number
}

export interface AgentResponse {
  requestId: string
  agentId: string
  success: boolean
  data?: any
  error?: string
  processingTime: number
  confidence?: number
}

export interface StrategySubmission {
  agentId: string
  userAddress: string
  strategy: OptimizationStrategy
  confidence: number
  reasoning: string
  riskAssessment: RiskAssessment
  executionPlan?: ExecutionPlan
}

export interface ExecutionResult {
  strategyId: string
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled'
  transactions: TransactionResult[]
  totalGasUsed: string
  totalCostUSD: number
  finalPositions: Position[]
  performance: ExecutionPerformance
  errors?: string[]
}

export interface TransactionResult {
  hash: string
  status: 'pending' | 'confirmed' | 'failed'
  gasUsed: string
  gasPrice: string
  costUSD: number
  blockNumber?: number
  timestamp: Date
}

export interface ExecutionPerformance {
  executionTime: number
  slippage: number
  priceImpact: number
  gasEfficiency: number
  successRate: number
}

// ========== UTILITY TYPES ==========

export interface RiskSettings {
  maxSlippage: number
  minYieldImprovement: number
  rebalanceThreshold: number
  maxPositionSize: number
  minPositionSize: number
  gasOptimization: boolean
  emergencyStops: boolean
}

export interface CorrelationMatrix {
  [tokenA: string]: {
    [tokenB: string]: number
  }
}

export interface AuditInfo {
  auditor: string
  date: Date
  report: string
  score: number
  findings: SecurityFinding[]
}

export interface SecurityFinding {
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  status: 'open' | 'acknowledged' | 'fixed'
}

export interface SecurityIncident {
  date: Date
  type: string
  description: string
  impact: number
  resolved: boolean
  patchImplemented: boolean
}

export interface ExecutionPlan {
  steps: ExecutionStep[]
  totalEstimatedTime: number
  totalGasCost: string
  dependencies: string[]
  fallbackPlan?: ExecutionPlan
}

export interface ExecutionStep {
  order: number
  description: string
  type: 'transaction' | 'wait' | 'verify'
  parameters: any
  gasEstimate?: string
  dependencies?: number[]
  timeout: number
}

// ========== PROVIDER RESULT TYPES ==========

export interface ProviderContext {
  userQuery: string
  extractedParams: ExtractedParams
  riskTolerance: number
  preferredChains: string[]
  amount?: number
}

export interface ExtractedParams {
  tokens: string[]
  protocols: string[]
  amount?: number
  riskLevel?: string
  urgency?: string
  timeframe?: string
}

// ========== ERROR TYPES ==========

export interface AliothError {
  code: string
  message: string
  details?: any
  timestamp: Date
  requestId?: string
  recoverable: boolean
}

export class OptimizationError extends Error {
  code: string
  details: any

  constructor(message: string, code: string, details?: any) {
    super(message)
    this.code = code
    this.details = details
    this.name = 'OptimizationError'
  }
}

export class BackendError extends Error {
  code: string
  statusCode: number

  constructor(message: string, code: string, statusCode: number) {
    super(message)
    this.code = code
    this.statusCode = statusCode
    this.name = 'BackendError'
  }
}

// ========== CONSTANTS ==========

export const RISK_LEVELS = {
  CONSERVATIVE: { min: 1, max: 3 },
  BALANCED: { min: 4, max: 6 },
  AGGRESSIVE: { min: 7, max: 8 },
  YOLO: { min: 9, max: 10 },
} as const

export const SUPPORTED_CHAINS = [
  'ethereum',
  'polygon',
  'arbitrum',
  'optimism',
  'base',
  'avalanche',
] as const

export const PROTOCOL_CATEGORIES = [
  'lending',
  'dex',
  'yield-farming',
  'liquid-staking',
  'derivatives',
  'insurance',
] as const

export type SupportedChain = (typeof SUPPORTED_CHAINS)[number]
export type ProtocolCategory = (typeof PROTOCOL_CATEGORIES)[number]
