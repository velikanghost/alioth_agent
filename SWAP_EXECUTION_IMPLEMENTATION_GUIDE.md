# Alioth Agent: Swap Execution Implementation Guide

## 🎯 Overview

Transform the current analysis-only Alioth AI Agent into a full swap-executing agent that performs actual token swaps and yield optimization transactions using the backend's existing Privy server wallets and Uniswap v4 integration.

## 📊 Current State Analysis

### ✅ What We Have (Analysis + Backend Infrastructure)

- **Portfolio optimization recommendations** with fixed allocation strategies
- **Real-time yield data integration** from DeFiLlama API
- **Protocol filtering** for testnet compatibility (Aave, Compound only)
- **Dual-mode API endpoints** for backend integration
- **Risk assessment algorithms** for conservative/moderate/aggressive strategies
- **Market analysis** with protocol recommendations
- **✅ Backend wallet endpoints** - Privy server wallet integration ready
- **✅ Transaction signing infrastructure** - Backend handles wallet management

### ❌ What We're Missing (Execution Layer - ~60% of Target)

- **Uniswap v4 Service** for swap route optimization and execution
- **Agent-to-backend communication** for transaction requests
- **Swap route calculation** and comparison using Uniswap v4 SDK
- **Transaction monitoring** and confirmation
- **Multi-step transaction orchestration**
- **Slippage protection** mechanisms
- **Failed transaction handling** and retries

## 🏗️ Implementation Phases

### Phase 1: Backend Communication Service (Simplified)

**Timeline: 3-4 Days**

#### 1.1 Backend Wallet Service Integration

```typescript
// src/services/backendWalletService.ts
export interface BackendWalletService {
  // Get wallet info from existing backend endpoint
  getWalletInfo(userAddress: string): Promise<WalletInfo>

  // Execute transaction via existing backend signing service
  executeTransaction(
    userAddress: string,
    transaction: TransactionRequest,
  ): Promise<TransactionResponse>

  // Execute batch transactions for optimization
  executeBatchTransactions(
    userAddress: string,
    transactions: TransactionRequest[],
  ): Promise<BatchTransactionResponse>
}

// Simplified implementation using existing backend endpoints
export class BackendWalletServiceImpl implements BackendWalletService {
  private backendUrl: string
  private apiKey: string

  constructor(backendUrl: string, apiKey: string) {
    this.backendUrl = backendUrl
    this.apiKey = apiKey
  }

  async getWalletInfo(userAddress: string): Promise<WalletInfo> {
    // Use existing backend wallet endpoint
    const response = await fetch(
      `${this.backendUrl}/api/v1/wallet/${userAddress}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to get wallet info: ${response.statusText}`)
    }

    return await response.json()
  }

  async executeTransaction(
    userAddress: string,
    transaction: TransactionRequest,
  ): Promise<TransactionResponse> {
    // Use existing backend transaction signing endpoint
    const response = await fetch(
      `${this.backendUrl}/api/v1/transactions/sign-and-send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress,
          transaction,
          source: 'alioth-agent',
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Transaction execution failed: ${response.statusText}`)
    }

    return await response.json()
  }
}
```

#### 1.2 Existing Backend API Integration

```typescript
// Utilize existing backend endpoints
interface ExistingBackendAPI {
  // ✅ Already available - Get wallet info
  'GET /api/v1/wallet/{userAddress}': WalletInfo

  // ✅ Already available - Sign and execute transaction
  'POST /api/v1/transactions/sign-and-send': TransactionResponse

  // ✅ Already available - Monitor transaction status
  'GET /api/v1/transactions/{txHash}/status': TransactionStatus

  // May need to add - Agent-specific optimization endpoint
  'POST /api/v1/agent/execute-optimization': OptimizationExecutionRequest
}
```

#### 1.3 Agent Communication Protocol

```typescript
// src/types/executionInterfaces.ts
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

export interface OptimizationExecutionRequest {
  userAddress: string
  currentAllocation: TokenAllocation[]
  targetAllocation: TokenAllocation[]
  maxSlippage: number
  gasStrategy: 'fast' | 'standard' | 'slow'
}
```

### Phase 2: Uniswap v4 Integration Service

**Timeline: 1 Week**

#### 2.1 Uniswap v4 Swap Service

```typescript
// src/services/uniswapV4Service.ts
import { SwapExactInSingle, V4Planner, Actions } from '@uniswap/v4-sdk'
import { CommandType, RoutePlanner } from '@uniswap/universal-router-sdk'
import { Token, ChainId } from '@uniswap/sdk-core'

export class UniswapV4Service {
  private quoterContract: ethers.Contract
  private universalRouter: ethers.Contract
  private provider: ethers.providers.JsonRpcProvider

  constructor(rpcUrl: string, chainId: number) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl)
    this.setupContracts(chainId)
  }

  // Get quote for single-hop swap
  async getSwapQuote(
    inputToken: Token,
    outputToken: Token,
    inputAmount: string,
    slippageTolerance: number,
  ): Promise<SwapQuote> {
    const poolKey = {
      currency0: inputToken.address,
      currency1: outputToken.address,
      fee: 500, // 0.05%
      tickSpacing: 10,
      hooks: '0x0000000000000000000000000000000000000000',
    }

    const quotedAmountOut =
      await this.quoterContract.callStatic.quoteExactInputSingle({
        poolKey,
        zeroForOne: inputToken.address < outputToken.address,
        exactAmount: inputAmount,
        hookData: '0x00',
      })

    return {
      inputAmount,
      outputAmount: quotedAmountOut.amountOut,
      poolKey,
      slippageTolerance,
      priceImpact: this.calculatePriceImpact(
        inputAmount,
        quotedAmountOut.amountOut,
      ),
    }
  }

  // Execute single-hop swap
  async executeSingleHopSwap(
    swapConfig: SwapExactInSingle,
  ): Promise<TransactionRequest> {
    const v4Planner = new V4Planner()
    const routePlanner = new RoutePlanner()

    // Build swap actions
    v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapConfig])
    v4Planner.addAction(Actions.SETTLE_ALL, [
      swapConfig.poolKey.currency0,
      swapConfig.amountIn,
    ])
    v4Planner.addAction(Actions.TAKE_ALL, [
      swapConfig.poolKey.currency1,
      swapConfig.amountOutMinimum,
    ])

    const encodedActions = v4Planner.finalize()
    routePlanner.addCommand(CommandType.V4_SWAP, [
      v4Planner.actions,
      v4Planner.params,
    ])

    const deadline = Math.floor(Date.now() / 1000) + 3600 // 1 hour

    return {
      to: this.universalRouter.address,
      data: this.universalRouter.interface.encodeFunctionData('execute', [
        routePlanner.commands,
        [encodedActions],
        deadline,
      ]),
      value:
        swapConfig.poolKey.currency0 ===
        '0x0000000000000000000000000000000000000000'
          ? swapConfig.amountIn
          : '0',
    }
  }

  // Get multi-hop swap route
  async getMultiHopRoute(
    inputToken: Token,
    outputToken: Token,
    inputAmount: string,
    intermediateTokens: Token[],
  ): Promise<MultiHopRoute> {
    // Implementation for multi-hop routing
    const route = await this.findBestMultiHopPath(
      inputToken,
      outputToken,
      intermediateTokens,
    )

    return {
      path: route.path,
      pools: route.pools,
      expectedOutput: route.expectedOutput,
      priceImpact: route.priceImpact,
    }
  }

  // Execute multi-hop swap
  async executeMultiHopSwap(
    route: MultiHopRoute,
    inputAmount: string,
    minOutputAmount: string,
  ): Promise<TransactionRequest> {
    const v4Planner = new V4Planner()
    const routePlanner = new RoutePlanner()

    // Add multi-hop swap action
    v4Planner.addAction(Actions.SWAP_EXACT_IN, [
      {
        path: route.encodedPath,
        recipient: '0x0000000000000000000000000000000000000000', // Universal Router
        amountIn: inputAmount,
        amountOutMinimum: minOutputAmount,
      },
    ])

    const encodedActions = v4Planner.finalize()
    routePlanner.addCommand(CommandType.V4_SWAP, [
      v4Planner.actions,
      v4Planner.params,
    ])

    const deadline = Math.floor(Date.now() / 1000) + 3600

    return {
      to: this.universalRouter.address,
      data: this.universalRouter.interface.encodeFunctionData('execute', [
        routePlanner.commands,
        [encodedActions],
        deadline,
      ]),
      value: '0',
    }
  }
}
```

#### 2.2 Uniswap v4 Configuration

```typescript
// Uniswap v4 contract addresses and configuration
const UNISWAP_V4_CONFIG = {
  ethereum: {
    poolManager: '0x...',
    universalRouter: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af',
    quoter: '0x...',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  // Add testnet configurations
  sepolia: {
    poolManager: '0x...',
    universalRouter: '0x...',
    quoter: '0x...',
    permit2: '0x...',
  },
}

// Supported token configurations
const SUPPORTED_TOKENS = {
  ethereum: {
    ETH: new Token(
      ChainId.MAINNET,
      '0x0000000000000000000000000000000000000000',
      18,
      'ETH',
      'Ether',
    ),
    USDC: new Token(
      ChainId.MAINNET,
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      6,
      'USDC',
      'USDC',
    ),
    WETH: new Token(
      ChainId.MAINNET,
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      18,
      'WETH',
      'Wrapped Ether',
    ),
    DAI: new Token(
      ChainId.MAINNET,
      '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      18,
      'DAI',
      'Dai Stablecoin',
    ),
  },
}
```

#### 2.3 Price Impact and Slippage Protection

```typescript
// src/services/slippageProtectionService.ts
export class SlippageProtectionService {
  // Calculate minimum output amount with slippage tolerance
  calculateMinOutputAmount(
    expectedOutput: string,
    slippageTolerance: number, // in basis points (e.g., 50 = 0.5%)
  ): string {
    const expectedOutputBN = ethers.BigNumber.from(expectedOutput)
    const slippageAmount = expectedOutputBN.mul(slippageTolerance).div(10000)
    return expectedOutputBN.sub(slippageAmount).toString()
  }

  // Calculate price impact
  calculatePriceImpact(
    inputAmount: string,
    outputAmount: string,
    marketPrice: string,
  ): number {
    const expectedOutput = ethers.BigNumber.from(inputAmount).mul(marketPrice)
    const actualOutput = ethers.BigNumber.from(outputAmount)
    const impact = expectedOutput
      .sub(actualOutput)
      .mul(10000)
      .div(expectedOutput)
    return impact.toNumber() / 100 // Convert to percentage
  }

  // Validate acceptable price impact
  validatePriceImpact(
    priceImpact: number,
    maxPriceImpact: number = 3,
  ): boolean {
    return priceImpact <= maxPriceImpact
  }
}
```

### Phase 3: Swap Execution Actions

**Timeline: 1 Week**

#### 3.1 Enhanced Actions for Uniswap v4 Swap Execution

```typescript
// src/actions/executeSwapAction.ts
import { UniswapV4Service } from '../services/uniswapV4Service.js'
import { BackendWalletService } from '../services/backendWalletService.js'
import { SlippageProtectionService } from '../services/slippageProtectionService.js'

export const executeSwapAction: Action = {
  name: 'EXECUTE_SWAP',
  description: 'Execute token swaps through Uniswap v4',

  validate: async (runtime, message, state) => {
    const text = message.content.text?.toLowerCase() || ''
    const hasSwapRequest =
      text.includes('swap') ||
      text.includes('trade') ||
      text.includes('exchange') ||
      (message.content.inputToken && message.content.outputToken)

    return hasSwapRequest
  },

  handler: async (runtime, message, state, options, callback) => {
    try {
      // 1. Parse swap request
      const swapRequest = {
        userAddress: extractUserAddress(message),
        inputToken: extractInputToken(message),
        outputToken: extractOutputToken(message),
        inputAmount: extractInputAmount(message),
        slippageTolerance: extractSlippageTolerance(message) || 50, // 0.5% default
      }

      // 2. Get tokens and validate
      const inputToken = SUPPORTED_TOKENS.ethereum[swapRequest.inputToken]
      const outputToken = SUPPORTED_TOKENS.ethereum[swapRequest.outputToken]

      if (!inputToken || !outputToken) {
        throw new Error(
          `Unsupported token pair: ${swapRequest.inputToken}/${swapRequest.outputToken}`,
        )
      }

      // 3. Get quote from Uniswap v4
      const quote = await uniswapV4Service.getSwapQuote(
        inputToken,
        outputToken,
        swapRequest.inputAmount,
        swapRequest.slippageTolerance,
      )

      // 4. Validate price impact
      if (!slippageProtection.validatePriceImpact(quote.priceImpact)) {
        throw new Error(`Price impact too high: ${quote.priceImpact}%`)
      }

      // 5. Build swap configuration
      const swapConfig: SwapExactInSingle = {
        poolKey: quote.poolKey,
        zeroForOne: inputToken.address < outputToken.address,
        amountIn: swapRequest.inputAmount,
        amountOutMinimum: slippageProtection.calculateMinOutputAmount(
          quote.outputAmount,
          swapRequest.slippageTolerance,
        ),
        hookData: '0x00',
      }

      // 6. Build transaction
      const transaction =
        await uniswapV4Service.executeSingleHopSwap(swapConfig)

      // 7. Execute via backend wallet
      const result = await backendWalletService.executeTransaction(
        swapRequest.userAddress,
        transaction,
      )

      // 8. Return structured response
      const responseContent: Content = {
        text: JSON.stringify(
          {
            success: true,
            txHash: result.txHash,
            inputAmount: swapRequest.inputAmount,
            outputAmount: quote.outputAmount,
            priceImpact: quote.priceImpact,
            gasUsed: result.gasUsed,
          },
          null,
          2,
        ),
        actions: ['EXECUTE_SWAP'],
        source: message.content.source,
      }

      await callback(responseContent)
      return responseContent
    } catch (error) {
      logger.error('Error in EXECUTE_SWAP action:', error)

      const errorContent: Content = {
        text: JSON.stringify(
          {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
        actions: ['EXECUTE_SWAP'],
        source: message.content.source,
      }

      await callback(errorContent)
      return errorContent
    }
  },
}
```

#### 3.2 Multi-Step Portfolio Optimization Execution

```typescript
// src/actions/executeOptimizationAction.ts
export const executeOptimizationAction: Action = {
  name: 'EXECUTE_OPTIMIZATION',
  description: 'Execute complete portfolio optimization with Uniswap v4 swaps',

  validate: async (runtime, message, state) => {
    const text = message.content.text?.toLowerCase() || ''
    const hasOptimizationRequest =
      text.includes('optimize') ||
      text.includes('rebalance') ||
      text.includes('portfolio') ||
      message.content.targetAllocation

    return hasOptimizationRequest
  },

  handler: async (runtime, message, state, options, callback) => {
    try {
      // 1. Parse optimization request
      const optimizationRequest = {
        userAddress: extractUserAddress(message),
        targetAllocation: extractTargetAllocation(message),
        maxSlippage: extractSlippageTolerance(message) || 100, // 1% default
        riskTolerance: extractRiskTolerance(message),
      }

      // 2. Get current portfolio from backend
      const currentPortfolio = await backendWalletService.getPortfolio(
        optimizationRequest.userAddress,
      )

      // 3. Calculate optimization steps
      const optimizationSteps = await calculateOptimizationSteps(
        currentPortfolio,
        optimizationRequest.targetAllocation,
      )

      // 4. Execute steps sequentially
      const results = []
      for (const step of optimizationSteps) {
        if (step.type === 'SWAP') {
          // Execute swap step
          const swapResult = await executeSwapStep(step, optimizationRequest)
          results.push(swapResult)

          // Wait for confirmation before next step
          await waitForTransactionConfirmation(swapResult.txHash)
        }
      }

      // 5. Get final portfolio state
      const finalPortfolio = await backendWalletService.getPortfolio(
        optimizationRequest.userAddress,
      )

      const responseContent: Content = {
        text: JSON.stringify(
          {
            success: results.every((r) => r.success),
            steps: results,
            initialPortfolio: currentPortfolio,
            finalPortfolio: finalPortfolio,
            totalGasUsed: results.reduce((sum, r) => sum + (r.gasUsed || 0), 0),
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
        actions: ['EXECUTE_OPTIMIZATION'],
        source: message.content.source,
      }

      await callback(responseContent)
      return responseContent
    } catch (error) {
      logger.error('Error in EXECUTE_OPTIMIZATION action:', error)

      const errorContent: Content = {
        text: JSON.stringify(
          {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
        actions: ['EXECUTE_OPTIMIZATION'],
        source: message.content.source,
      }

      await callback(errorContent)
      return errorContent
    }
  },
}
```

### Phase 4: Safety and Monitoring

**Timeline: Week 4**

#### 4.1 Transaction Safety Mechanisms

```typescript
// src/services/transactionSafetyService.ts
export class TransactionSafetyService {
  // Pre-execution validation
  async validateTransactionSafety(
    transaction: TransactionRequest,
  ): Promise<SafetyValidation>

  // Slippage protection
  async calculateMinOutputAmount(
    inputAmount: string,
    expectedOutput: string,
    slippageTolerance: number,
  ): Promise<string>

  // MEV protection strategies
  async applyMEVProtection(
    transaction: TransactionRequest,
  ): Promise<TransactionRequest>
}
```

#### 4.2 Transaction Monitoring Service

```typescript
// src/services/transactionMonitorService.ts
export class TransactionMonitorService {
  // Real-time transaction tracking
  async monitorTransaction(
    txHash: string,
    timeoutMs: number = 300000, // 5 minutes
  ): Promise<TransactionConfirmation>

  // Failed transaction analysis
  async analyzeFailedTransaction(txHash: string): Promise<FailureAnalysis>

  // Automatic retry with adjusted parameters
  async retryFailedTransaction(
    originalTx: TransactionRequest,
    failure: FailureAnalysis,
  ): Promise<TransactionResponse>
}
```

#### 4.3 Risk Management Integration

```typescript
// src/services/executionRiskService.ts
export class ExecutionRiskService {
  // Pre-execution risk assessment
  async assessExecutionRisk(
    optimization: OptimizationPlan,
  ): Promise<ExecutionRiskScore>

  // Position size validation
  async validatePositionSizes(
    allocations: TokenAllocation[],
  ): Promise<ValidationResult>

  // Emergency stop mechanisms
  async triggerEmergencyStop(userAddress: string, reason: string): Promise<void>
}
```

## 🔌 Backend Integration Requirements

### Privy Server Wallet Architecture

The backend already has Privy server wallets configured that can sign transactions. The agent will leverage these wallets through secure API calls:

```typescript
// Backend Privy Configuration (existing)
interface PrivyServerWallet {
  // Server-side wallet that can sign transactions
  address: string
  chainId: number
  canSign: boolean

  // Available through Privy's server SDK
  signTransaction(transaction: UnsignedTransaction): Promise<SignedTransaction>
  signMessage(message: string): Promise<string>
  getBalance(tokenAddress?: string): Promise<string>
}

// Agent will interact with these wallets through backend APIs
interface AgentWalletInterface {
  // Request transaction signing from backend
  requestTransactionSigning(
    userAddress: string,
    transaction: UnsignedTransaction,
  ): Promise<SignedTransaction>

  // Get wallet capabilities and permissions
  getWalletPermissions(userAddress: string): Promise<WalletPermissions>

  // Execute multi-step transaction sequences
  executeTransactionBatch(
    userAddress: string,
    transactions: UnsignedTransaction[],
  ): Promise<BatchExecutionResult>
}
```

### New NestJS Services Needed

#### 1. Agent Execution Service

```typescript
// backend/src/modules/agent-execution/agent-execution.service.ts
@Injectable()
export class AgentExecutionService {
  constructor(
    private readonly privyService: PrivyService,
    private readonly dexService: DEXService,
    private readonly riskService: RiskManagementService,
  ) {}

  async executeAgentSwap(
    request: AgentSwapRequest,
  ): Promise<SwapExecutionResult> {
    // 1. Validate request with risk checks
    await this.riskService.validateSwapRequest(request)

    // 2. Get user's Privy wallet
    const wallet = await this.privyService.getWalletForUser(request.userAddress)

    // 3. Execute swap through DEX
    const result = await this.dexService.executeSwap(wallet, request.swapParams)

    // 4. Log and update user portfolio
    await this.updateUserPortfolio(request.userAddress, result)

    return result
  }
}
```

#### 2. Enhanced Privy Integration

```typescript
// backend/src/modules/privy/privy-execution.service.ts
@Injectable()
export class PrivyExecutionService {
  // Execute transaction with proper error handling
  async executeTransaction(
    userAddress: string,
    transaction: TransactionRequest,
  ): Promise<TransactionResult>

  // Batch transaction execution
  async executeBatchTransactions(
    userAddress: string,
    transactions: TransactionRequest[],
  ): Promise<BatchTransactionResult>

  // Get signing capabilities
  async getWalletCapabilities(userAddress: string): Promise<WalletCapabilities>
}
```

### API Endpoint Extensions

#### 1. Execution Endpoints

```typescript
// POST /api/v1/agent/execute-swap
@Post('execute-swap')
async executeSwap(@Body() request: AgentSwapRequest) {
  return await this.agentExecutionService.executeAgentSwap(request)
}

// POST /api/v1/agent/execute-optimization
@Post('execute-optimization')
async executeOptimization(@Body() request: OptimizationRequest) {
  return await this.agentExecutionService.executeOptimization(request)
}

// GET /api/v1/agent/transaction/{hash}/status
@Get('transaction/:hash/status')
async getTransactionStatus(@Param('hash') hash: string) {
  return await this.transactionService.getStatus(hash)
}
```

#### 2. Wallet Management

```typescript
// GET /api/v1/agent/wallet/{address}
@Get('wallet/:address')
async getWalletInfo(@Param('address') address: string) {
  return await this.privyExecutionService.getWalletCapabilities(address)
}

// POST /api/v1/agent/wallet/{address}/balance
@Post('wallet/:address/balance')
async getWalletBalance(@Param('address') address: string) {
  return await this.privyExecutionService.getBalance(address)
}
```

## 🧪 Testing Strategy

### 1. Unit Testing

- Mock Privy wallet responses
- Test swap route calculation algorithms
- Validate gas estimation accuracy
- Test slippage protection mechanisms

### 2. Integration Testing

- End-to-end optimization flows
- Backend API communication
- Transaction monitoring reliability
- Error handling and recovery

### 3. Testnet Testing

- Real testnet token swaps
- Multi-step optimization execution
- Gas optimization effectiveness
- MEV protection validation

## 🔒 Security Considerations

### 1. Transaction Validation

- Multi-layer validation before execution
- Slippage and price impact limits
- Position size constraints
- Protocol whitelist enforcement

### 2. Wallet Security

- Secure communication with Privy wallets
- Transaction signing verification
- Rate limiting on executions
- Emergency stop mechanisms

### 3. Risk Management

- Real-time portfolio value monitoring
- Maximum loss limits per transaction
- Protocol risk scoring
- Market condition circuit breakers

## 📊 Monitoring and Analytics

### 1. Execution Metrics

- Transaction success rates
- Average gas usage
- Slippage experienced vs. expected
- Route optimization effectiveness

### 2. Performance Tracking

- Agent decision accuracy
- Optimization outcome analysis
- User portfolio performance
- Protocol utilization statistics

### 3. Risk Monitoring

- Real-time exposure tracking
- Correlation analysis
- Stress testing scenarios
- Emergency intervention triggers

## 🚀 Implementation Timeline (Revised)

### Week 1: Backend Integration (3-4 Days)

- [ ] Implement backend wallet service communication
- [ ] Create agent-backend authentication
- [ ] Set up basic transaction monitoring
- [ ] Test existing backend endpoints

### Week 2: Uniswap v4 Integration (5-7 Days)

- [ ] Install and configure Uniswap v4 SDK dependencies
- [ ] Build UniswapV4Service with quote and swap functions
- [ ] Implement slippage protection service
- [ ] Create token configuration and validation

### Week 3: Swap Execution Actions (5-7 Days)

- [ ] Implement executeSwapAction with Uniswap v4
- [ ] Create executeOptimizationAction for portfolio rebalancing
- [ ] Add comprehensive error handling and validation
- [ ] Implement transaction confirmation monitoring

### Week 4: Testing & Production (5-7 Days)

- [ ] Unit tests for all swap functions
- [ ] Integration tests with backend
- [ ] Testnet testing with real transactions
- [ ] Production deployment and monitoring setup

## 🎯 Success Metrics

### Technical Metrics

- **Transaction Success Rate**: >95%
- **Gas Optimization**: 15-25% savings vs. naive execution
- **Slippage Control**: Within 0.5% of target
- **Execution Time**: <60 seconds for complex optimizations

### Business Metrics

- **Portfolio Performance**: Measurable yield improvement
- **User Adoption**: Successful autonomous optimizations
- **Risk Management**: Zero critical failures
- **Cost Efficiency**: Gas costs < 2% of transaction value

## 📋 Next Steps (Updated)

### Immediate Actions (This Week)

1. **Backend Integration Verification**:

   - ✅ Confirm existing wallet endpoints are accessible
   - ✅ Test transaction signing capabilities
   - Establish agent authentication for backend API access
   - Verify transaction status monitoring endpoints

2. **Uniswap v4 SDK Setup**:

   - Install required dependencies: `@uniswap/v4-sdk`, `@uniswap/sdk-core`, `@uniswap/universal-router-sdk`
   - Create `src/services/uniswapV4Service.ts` with quote and swap functions
   - Set up token configurations for supported networks
   - Implement basic slippage protection service

3. **Initial Service Implementation**:
   - Create `src/services/backendWalletService.ts` for backend communication
   - Implement basic swap quote functionality
   - Test Uniswap v4 quoter integration
   - Create token validation and configuration

### Development Milestones (Revised)

1. **Week 1: Backend Integration (3-4 Days)**

   - [ ] Implement BackendWalletService with existing endpoints
   - [ ] Create agent authentication mechanism
   - [ ] Test basic transaction flow with backend
   - [ ] Set up transaction monitoring

2. **Week 2: Uniswap v4 Integration (5-7 Days)**

   - [ ] Build UniswapV4Service with SDK integration
   - [ ] Implement quote and swap functions
   - [ ] Create slippage protection service
   - [ ] Add token configuration and validation

3. **Week 3: Execution Actions (5-7 Days)**

   - [ ] Implement executeSwapAction for single swaps
   - [ ] Create executeOptimizationAction for portfolio rebalancing
   - [ ] Add comprehensive error handling
   - [ ] Implement transaction confirmation monitoring

4. **Week 4: Testing & Production (5-7 Days)**
   - [ ] Unit tests for all services and actions
   - [ ] Integration tests with backend
   - [ ] Testnet testing with real Uniswap v4 transactions
   - [ ] Production deployment preparation

### Technical Prerequisites

1. **✅ Backend Infrastructure**: Wallet endpoints already available
2. **Agent Dependencies**: Install Uniswap v4 SDK packages
3. **Testing Environment**: Set up testnet configuration
4. **Token Configuration**: Define supported token list for initial release

## 📦 Required Dependencies

### NPM Package Installation

```bash
# Uniswap v4 SDK packages
npm install @uniswap/v4-sdk@latest
npm install @uniswap/sdk-core@latest
npm install @uniswap/universal-router-sdk@latest

# Ethereum utilities
npm install ethers@^5.7.2

# Additional utilities
npm install bignumber.js
```

### Package.json Updates

```json
{
  "dependencies": {
    "@uniswap/v4-sdk": "^1.0.0",
    "@uniswap/sdk-core": "^4.0.0",
    "@uniswap/universal-router-sdk": "^1.0.0",
    "ethers": "^5.7.2",
    "bignumber.js": "^9.1.2"
  }
}
```

### Environment Configuration

```typescript
// src/config/uniswap.ts
export const UNISWAP_CONFIG = {
  QUOTER_ADDRESS: process.env.UNISWAP_V4_QUOTER_ADDRESS,
  UNIVERSAL_ROUTER_ADDRESS: process.env.UNISWAP_V4_UNIVERSAL_ROUTER_ADDRESS,
  POOL_MANAGER_ADDRESS: process.env.UNISWAP_V4_POOL_MANAGER_ADDRESS,
  RPC_URL: process.env.ETHEREUM_RPC_URL,
  CHAIN_ID: parseInt(process.env.CHAIN_ID || '1'),
}
```

---

_This guide transforms the current analysis-only Alioth agent into a full swap-executing system that can autonomously optimize DeFi portfolios using the backend's existing Privy server wallets and Uniswap v4 for secure transaction execution._
