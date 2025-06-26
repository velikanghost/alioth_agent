// Core request/response interfaces for dual-mode functionality
export interface YieldAnalysisRequest {
  inputTokenAddress?: string // "0xA0b86a33E6FC17036E8b9d2C33F67Df04D6DAB07"
  usdAmount: number // 1000 (USD amount as number)
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
  userAddress?: string // Optional for personalized analysis
}

// New interface for direct deposit optimization (backend format)
export interface DirectDepositOptimizationRequest {
  inputTokenAddress: string // Token contract address
  inputTokenSymbol: string // Token symbol (AAVE, LINK, ETH, WETH, WBTC)
  inputTokenAmount: string // Amount of tokens to deposit (as string to preserve precision)
  usdAmount: number // USD value of the deposit
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive' // Optional, defaults to 'moderate'
}

export interface DirectDepositOptimizationResponse {
  success: boolean
  data: {
    inputToken: {
      address: string
      symbol: string
      amount: string
      usdValue: number
    }
    optimization: {
      strategy: string
      recommendations: ProtocolAllocation[]
      expectedAPY: number
      confidence: number
      reasoning: string
    }
    marketAnalysis: MarketData
    timestamp: string
  }
  timestamp: string
}

export interface ProtocolAllocation {
  protocol: string // "aave", "compound", etc.
  percentage: number // 0-100
  expectedAPY: number // Annual percentage yield
  riskScore: number // 1-10 risk rating
  tvl: number // Total value locked
  chain: string // "ethereum", "polygon", etc.
  token: string // "USDC", "DAI", etc.
  amount?: string // Optional amount for final allocations
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

// ==========================
// SWAP EXECUTION INTERFACES
// ==========================

// Backend wallet service interfaces
export interface WalletInfo {
  address: string
  chainId: number
  balance: string
  canSign: boolean
}

export interface TransactionRequest {
  to: string
  data: string
  value?: string
  gasLimit?: string
  gasPrice?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
}

export interface TransactionResponse {
  success: boolean
  txHash: string
  gasUsed?: number
  error?: string
}

export interface BatchTransactionResponse {
  success: boolean
  results: TransactionResponse[]
  totalGasUsed: number
}

// Swap execution interfaces
export interface SwapExecutionRequest {
  userAddress: string
  inputTokenAddress: string
  outputTokenAddress: string
  inputAmount: string
  minOutputAmount: string
  slippageTolerance: number
  deadline: number
  routeStrategy: 'best_price' | 'lowest_gas' | 'fastest'
}

export interface SwapQuote {
  inputAmount: string
  outputAmount: string
  poolKey: PoolKey
  slippageTolerance: number
  priceImpact: number
  gasEstimate?: string
}

export interface PoolKey {
  currency0: string
  currency1: string
  fee: number
  tickSpacing: number
  hooks: string
}

export interface MultiHopRoute {
  path: string[]
  pools: PoolKey[]
  expectedOutput: string
  priceImpact: number
  encodedPath?: string
}

// Token allocation interfaces for optimization
export interface TokenAllocation {
  token: string
  amount: string
  percentage: number
}

export interface OptimizationExecutionRequest {
  userAddress: string
  currentAllocation: TokenAllocation[]
  targetAllocation: TokenAllocation[]
  maxSlippage: number
  gasStrategy: 'fast' | 'standard' | 'slow'
}

export interface OptimizationStep {
  type: 'SWAP' | 'DEPOSIT' | 'WITHDRAW'
  inputToken: string
  outputToken: string
  amount: string
  protocol?: string
}

// Safety and monitoring interfaces
export interface SafetyValidation {
  isValid: boolean
  warnings: string[]
  riskScore: number
}

export interface TransactionConfirmation {
  success: boolean
  txHash: string
  blockNumber: number
  gasUsed: number
  outputAmount?: string
  error?: string
}

export interface FailureAnalysis {
  reason: string
  gasIssue: boolean
  slippageIssue: boolean
  liquidityIssue: boolean
  suggestedFix: string
}

export interface ExecutionRiskScore {
  score: number // 1-10
  factors: string[]
  recommendation: 'proceed' | 'caution' | 'abort'
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}
