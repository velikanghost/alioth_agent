import type { Memory } from '@elizaos/core'

// Core request/response interfaces for dual-mode functionality
export interface YieldAnalysisRequest {
  inputToken: string // "USDC" | "0xA0b86a33E6FC17036E8b9d2C33F67Df04D6DAB07"
  inputAmount: string // "1000000000" (1000 USDC in wei) | "1000"
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
  userAddress?: string // Optional for personalized analysis
}

export interface ProtocolAllocation {
  protocol: string // "aave", "compound", etc.
  percentage: number // 0-100
  expectedAPY: number // Annual percentage yield
  riskScore: number // 1-10 risk rating
  tvl: number // Total value locked
  chain: string // "ethereum", "polygon", etc.
  token: string // "USDC", "DAI", etc.
}

export interface MarketData {
  timestamp: string
  totalTvl: number
  averageYield: number
  topProtocols: string[]
  marketCondition: 'bull' | 'bear' | 'sideways'
}

export interface YieldAnalysisResponse {
  allocation: ProtocolAllocation[]
  confidence: number // 0-100
  reasoning: string
  marketAnalysis: MarketData
  timestamp: string
}

// Portfolio optimization interfaces
export interface AllocationStrategy {
  stablecoins: number
  bluechip: number
  riskAssets: number
  description: string
  targetAPY: string
}

export interface DetailedAllocation {
  stablecoins: ProtocolAllocation[]
  bluechip: ProtocolAllocation[]
  riskAssets: ProtocolAllocation[]
}

export interface PortfolioOptimizationRequest {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
  currentPortfolio?: ProtocolAllocation[]
  userAddress?: string
}

export interface PortfolioOptimizationResponse {
  strategy: string
  allocation: DetailedAllocation
  expectedAPY: number
  confidence: number
  reasoning: string
}

// Risk assessment interfaces
export interface RiskAnalysisRequest {
  protocol?: string
  allocation?: ProtocolAllocation[]
}

export interface RiskBreakdown {
  protocolRisk: number // 1-10
  smartContractRisk: number // 1-10
  liquidityRisk: number // 1-10
  marketRisk: number // 1-10
  composabilityRisk: number // 1-10
}

export interface RiskAnalysisResponse {
  protocol?: string
  overallRisk: number // 1-10
  breakdown: RiskBreakdown
  riskFactors: string[]
  mitigation: string[]
  recommendation: string
}

// Enhanced content type that supports both modes
export interface EnhancedContent {
  text: string // Human-readable response
  actions: string[] // Action names
  source?: string // Message source
  structured?: any // Machine-readable data
  apiResponse?: any // Full API format
}

// Request type detection
export type RequestType = 'conversational' | 'api'

// Utility type for message parsing
export interface ParsedMessage {
  requestType: RequestType
  inputToken?: string
  inputAmount?: string
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive'
  protocolName?: string
  userAddress?: string
}
