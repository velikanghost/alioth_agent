# Alioth ElizaOS Agent - Implementation Guide

This document provides detailed technical specifications for implementing the Alioth AI Agent using ElizaOS to replace the embedded AI functionality in the NestJS backend.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Agent Configuration](#agent-configuration)
3. [Actions Implementation](#actions-implementation)
4. [Providers Implementation](#providers-implementation)
5. [Backend API Changes](#backend-api-changes)
6. [Database Schema Updates](#database-schema-updates)
7. [Security Implementation](#security-implementation)
8. [Testing Strategy](#testing-strategy)
9. [Deployment Guide](#deployment-guide)

## Project Structure

### ElizaOS Agent Project Setup

```
alioth-eliza-agent/
├── src/
│   ├── character/
│   │   ├── character.ts          # Main character definition
│   │   ├── personality.ts        # Personality modes
│   │   └── knowledge.ts          # DeFi knowledge base
│   ├── actions/
│   │   ├── optimize-yield.ts     # Yield optimization logic
│   │   ├── analyze-market.ts     # Market analysis
│   │   ├── assess-risk.ts        # Risk assessment
│   │   ├── decide-rebalance.ts   # Rebalancing decisions
│   │   └── index.ts              # Actions export
│   ├── providers/
│   │   ├── alioth-backend.ts     # Backend API provider
│   │   ├── defi-protocols.ts     # DeFi protocols data
│   │   ├── market-data.ts        # Market data provider
│   │   └── index.ts              # Providers export
│   ├── plugins/
│   │   ├── defi-plugin.ts        # Custom DeFi plugin
│   │   └── alioth-plugin.ts      # Alioth-specific plugin
│   ├── types/
│   │   ├── agent.types.ts        # Agent-specific types
│   │   ├── defi.types.ts         # DeFi-related types
│   │   └── api.types.ts          # API interface types
│   ├── utils/
│   │   ├── calculations.ts       # Mathematical utilities
│   │   ├── validation.ts         # Input validation
│   │   └── formatters.ts         # Response formatting
│   ├── config/
│   │   ├── environment.ts        # Environment configuration
│   │   └── constants.ts          # DeFi constants
│   └── index.ts                  # Main entry point
├── tests/
│   ├── actions/                  # Action tests
│   ├── providers/                # Provider tests
│   └── integration/              # Integration tests
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Agent Configuration

### Character Definition (`src/character/character.ts`)

```typescript
import { Character } from '@elizaos/core';

export const aliothCharacter: Character = {
  name: 'Alioth',
  description:
    'Advanced AI-driven DeFi yield optimization specialist with expertise in cross-chain portfolio management',

  personality: {
    adjectives: [
      'analytical',
      'precise',
      'risk-aware',
      'strategic',
      'data-driven',
      'professional',
    ],

    traits: [
      'Always provides quantitative analysis',
      'Considers multiple risk scenarios',
      'Explains reasoning clearly',
      'Adapts to user risk tolerance',
      'Stays updated with market conditions',
    ],
  },

  knowledge: [
    'Deep understanding of 50+ DeFi protocols across Ethereum, Polygon, Arbitrum, and Optimism',
    'Advanced portfolio optimization using Modern Portfolio Theory',
    'Cross-chain yield farming strategies and risks',
    'Smart contract security assessment',
    'Gas optimization techniques',
    'Market correlation analysis',
    'Risk-adjusted return calculations',
  ],

  expertise: [
    'yield optimization',
    'portfolio management',
    'risk assessment',
    'market analysis',
    'cross-chain strategies',
    'gas optimization',
    'protocol evaluation',
  ],

  modes: {
    conservative: {
      riskTolerance: 2,
      targetAPY: '3-8%',
      preferredProtocols: ['Aave V3', 'Compound V3', 'Lido'],
      description: 'Focus on capital preservation with AAA-rated protocols',
    },

    balanced: {
      riskTolerance: 5,
      targetAPY: '5-15%',
      preferredProtocols: ['Aave', 'Compound', 'Yearn', 'Curve'],
      description: 'Optimal risk-reward balance with diversification',
    },

    aggressive: {
      riskTolerance: 7,
      targetAPY: '8-25%',
      preferredProtocols: ['Layer 2 farms', 'Emerging protocols'],
      description: 'Higher yields with calculated risks',
    },

    yolo: {
      riskTolerance: 10,
      targetAPY: '15-100%+',
      preferredProtocols: ['New launches', 'High-risk opportunities'],
      description: 'Maximum yield hunting regardless of risk',
    },
  },
};
```

### Personality Modes (`src/character/personality.ts`)

```typescript
export interface PersonalityMode {
  name: string;
  riskTolerance: number; // 1-10 scale
  maxSlippage: number; // basis points
  minYieldImprovement: number; // basis points
  rebalanceThreshold: number; // percentage
  gasOptimization: boolean;
  protocolWhitelist?: string[];
  protocolBlacklist?: string[];
}

export const personalityModes: Record<string, PersonalityMode> = {
  conservative: {
    name: 'Conservative',
    riskTolerance: 2,
    maxSlippage: 50, // 0.5%
    minYieldImprovement: 25, // 0.25%
    rebalanceThreshold: 5, // 5%
    gasOptimization: true,
    protocolWhitelist: ['aave-v3', 'compound-v3', 'lido'],
  },

  balanced: {
    name: 'Balanced',
    riskTolerance: 5,
    maxSlippage: 100, // 1%
    minYieldImprovement: 50, // 0.5%
    rebalanceThreshold: 3, // 3%
    gasOptimization: true,
  },

  aggressive: {
    name: 'Aggressive',
    riskTolerance: 7,
    maxSlippage: 200, // 2%
    minYieldImprovement: 100, // 1%
    rebalanceThreshold: 2, // 2%
    gasOptimization: false,
  },

  yolo: {
    name: 'YOLO',
    riskTolerance: 10,
    maxSlippage: 500, // 5%
    minYieldImprovement: 200, // 2%
    rebalanceThreshold: 1, // 1%
    gasOptimization: false,
    protocolBlacklist: [], // No restrictions
  },
};
```

## Actions Implementation

### 1. Yield Optimization Action (`src/actions/optimize-yield.ts`)

```typescript
import { Action, HandlerCallback } from '@elizaos/core';
import { OptimizationStrategy, TokenAllocation } from '../types/defi.types';

export const optimizeYieldAction: Action = {
  name: 'OPTIMIZE_YIELD',
  description:
    'Generate optimal cross-token allocation strategy for maximum yield',

  validate: async (runtime, message) => {
    const content = message.content;
    return !!(
      content.inputToken &&
      content.inputAmount &&
      content.userAddress &&
      content.riskTolerance >= 1 &&
      content.riskTolerance <= 10
    );
  },

  handler: async (runtime, message, state, callback) => {
    try {
      const { inputToken, inputAmount, userAddress, riskTolerance, mode } =
        message.content;

      // Get personality mode settings
      const personality = personalityModes[mode || 'balanced'];

      // Fetch market data from backend
      const marketData = await runtime.providers.aliothBackend.getMarketData([
        inputToken,
      ]);

      // Get supported tokens based on mode
      const supportedTokens = await getSupportedTokens(personality);

      // Calculate optimal allocation using Modern Portfolio Theory
      const allocation = await calculateOptimalAllocation({
        inputToken,
        inputAmount: BigInt(inputAmount),
        supportedTokens,
        marketData,
        riskTolerance: personality.riskTolerance,
        minYieldImprovement: personality.minYieldImprovement,
      });

      // Find optimal swap routes
      const swapRoutes = await findOptimalSwapRoutes(inputToken, allocation);

      // Calculate strategy metrics
      const metrics = await calculateStrategyMetrics(allocation, marketData);

      // Generate AI reasoning
      const reasoning = generateOptimizationReasoning(
        allocation,
        metrics,
        personality,
      );

      const strategy: OptimizationStrategy = {
        operationId: generateOperationId(),
        userAddress,
        inputDetails: { inputToken, inputAmount, riskTolerance },
        tokenAllocations: allocation,
        swapRoutes,
        expectedAPY: metrics.expectedAPY,
        riskScore: metrics.riskScore,
        diversificationScore: metrics.diversificationScore,
        confidence: metrics.confidence,
        reasoning,
        expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
      };

      // Submit strategy to backend for validation
      await runtime.providers.aliothBackend.submitOptimization(strategy);

      return {
        success: true,
        strategy,
        message: `Generated optimization strategy with ${metrics.expectedAPY.toFixed(2)}% expected APY`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to generate optimization strategy',
      };
    }
  },
};

// Helper functions
async function calculateOptimalAllocation(
  params: OptimizationParams,
): Promise<TokenAllocation[]> {
  const {
    inputToken,
    inputAmount,
    supportedTokens,
    marketData,
    riskTolerance,
  } = params;

  // Modern Portfolio Theory implementation
  const correlationMatrix = buildCorrelationMatrix(supportedTokens, marketData);
  const expectedReturns = calculateExpectedReturns(supportedTokens, marketData);
  const riskMatrix = buildRiskMatrix(supportedTokens, marketData);

  // Optimize for maximum Sharpe ratio given risk tolerance
  const weights = optimizePortfolio({
    expectedReturns,
    riskMatrix,
    correlationMatrix,
    riskTolerance,
    constraints: {
      maxPositionSize: 0.4, // Maximum 40% in any single token
      minPositionSize: 0.05, // Minimum 5% if included
    },
  });

  // Convert weights to token allocations
  return weights.map((weight, index) => ({
    token: supportedTokens[index],
    symbol: getTokenSymbol(supportedTokens[index]),
    percentage: weight * 100,
    amount: (
      (BigInt(inputAmount) * BigInt(Math.floor(weight * 10000))) /
      BigInt(10000)
    ).toString(),
    expectedAPY: expectedReturns[index],
    riskScore: calculateTokenRisk(supportedTokens[index], marketData),
  }));
}
```

### 2. Market Analysis Action (`src/actions/analyze-market.ts`)

```typescript
import { Action } from '@elizaos/core';
import { MarketAnalysis, TokenData } from '../types/defi.types';

export const analyzeMarketAction: Action = {
  name: 'ANALYZE_MARKET',
  description: 'Perform comprehensive market analysis for DeFi opportunities',

  validate: async (runtime, message) => {
    return !!(message.content.tokens && Array.isArray(message.content.tokens));
  },

  handler: async (runtime, message, state, callback) => {
    try {
      const {
        tokens,
        timeframe = '24h',
        includeCorrelations = true,
      } = message.content;

      // Fetch comprehensive market data
      const [priceData, yieldData, volumeData, riskMetrics] = await Promise.all(
        [
          runtime.providers.marketData.getPriceData(tokens, timeframe),
          runtime.providers.defiProtocols.getYieldData(tokens),
          runtime.providers.marketData.getVolumeData(tokens, timeframe),
          runtime.providers.marketData.getRiskMetrics(tokens, timeframe),
        ],
      );

      // Calculate correlations if requested
      let correlations = null;
      if (includeCorrelations && tokens.length > 1) {
        correlations = await calculateCorrelationMatrix(tokens, timeframe);
      }

      // Identify opportunities and risks
      const opportunities = identifyYieldOpportunities(yieldData, riskMetrics);
      const risks = assessMarketRisks(priceData, volumeData, riskMetrics);

      // Generate market insights
      const insights = generateMarketInsights({
        tokens,
        priceData,
        yieldData,
        opportunities,
        risks,
        correlations,
      });

      const analysis: MarketAnalysis = {
        timestamp: new Date(),
        tokens: tokens.map((token) => ({
          address: token,
          symbol: getTokenSymbol(token),
          price: priceData[token].current,
          priceChange24h: priceData[token].change24h,
          volume24h: volumeData[token],
          bestYield: Math.max(...yieldData[token].yields),
          avgYield:
            yieldData[token].yields.reduce((a, b) => a + b) /
            yieldData[token].yields.length,
          riskScore: riskMetrics[token].score,
          volatility: riskMetrics[token].volatility,
        })),
        opportunities,
        risks,
        correlations,
        insights,
        recommendations: generateRecommendations(
          opportunities,
          risks,
          correlations,
        ),
      };

      return {
        success: true,
        analysis,
        message: `Market analysis complete. Found ${opportunities.length} opportunities with ${risks.length} risk factors.`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to analyze market conditions',
      };
    }
  },
};
```

### 3. Risk Assessment Action (`src/actions/assess-risk.ts`)

```typescript
import { Action } from '@elizaos/core';
import { RiskAssessment, PortfolioRisk } from '../types/defi.types';

export const assessRiskAction: Action = {
  name: 'ASSESS_RISK',
  description: 'Comprehensive portfolio risk analysis and scoring',

  validate: async (runtime, message) => {
    return !!(message.content.allocation && message.content.marketData);
  },

  handler: async (runtime, message, state, callback) => {
    try {
      const { allocation, marketData, userRiskTolerance = 5 } = message.content;

      // Calculate various risk metrics
      const riskMetrics = await calculateRiskMetrics(allocation, marketData);

      // Portfolio-level risk calculations
      const portfolioRisk: PortfolioRisk = {
        totalRiskScore: calculatePortfolioRiskScore(allocation, riskMetrics),
        volatility: calculatePortfolioVolatility(allocation, riskMetrics),
        maxDrawdown: estimateMaxDrawdown(allocation, riskMetrics),
        valueAtRisk: calculateVaR(allocation, riskMetrics, 0.05), // 5% VaR
        beta: calculatePortfolioBeta(allocation, riskMetrics),
        sharpeRatio: calculateSharpeRatio(allocation, riskMetrics),
        concentrationRisk: calculateConcentrationRisk(allocation),
      };

      // Identify specific risk factors
      const riskFactors = identifyRiskFactors(allocation, marketData);

      // Generate risk mitigation suggestions
      const mitigation = generateRiskMitigation(
        portfolioRisk,
        riskFactors,
        userRiskTolerance,
      );

      // Risk tolerance alignment check
      const riskAlignment = assessRiskAlignment(
        portfolioRisk,
        userRiskTolerance,
      );

      const assessment: RiskAssessment = {
        portfolioRisk,
        riskFactors,
        mitigation,
        riskAlignment,
        recommendation: generateRiskRecommendation(
          portfolioRisk,
          userRiskTolerance,
        ),
        confidence: calculateRiskConfidence(riskMetrics, marketData),
      };

      return {
        success: true,
        assessment,
        message: `Risk assessment complete. Portfolio risk score: ${portfolioRisk.totalRiskScore}/100`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to assess portfolio risk',
      };
    }
  },
};

// Risk calculation functions
function calculatePortfolioRiskScore(
  allocation: TokenAllocation[],
  riskMetrics: any,
): number {
  return allocation.reduce((totalRisk, token) => {
    const weight = token.percentage / 100;
    const tokenRisk = riskMetrics[token.token].score;
    return totalRisk + weight * tokenRisk;
  }, 0);
}

function calculatePortfolioVolatility(
  allocation: TokenAllocation[],
  riskMetrics: any,
): number {
  // Calculate weighted average volatility with correlation adjustments
  let portfolioVariance = 0;

  for (let i = 0; i < allocation.length; i++) {
    for (let j = 0; j < allocation.length; j++) {
      const weightI = allocation[i].percentage / 100;
      const weightJ = allocation[j].percentage / 100;
      const volI = riskMetrics[allocation[i].token].volatility;
      const volJ = riskMetrics[allocation[j].token].volatility;
      const correlation =
        i === j
          ? 1
          : riskMetrics.correlations[allocation[i].token][allocation[j].token];

      portfolioVariance += weightI * weightJ * volI * volJ * correlation;
    }
  }

  return Math.sqrt(portfolioVariance);
}
```

## Providers Implementation

### Backend API Provider (`src/providers/alioth-backend.ts`)

```typescript
import { Provider } from '@elizaos/core';

export const aliothBackendProvider: Provider = {
  name: 'alioth-backend',
  description: 'Alioth backend API integration for data and execution',

  async initialize(runtime) {
    this.backendUrl = runtime.environment.ALIOTH_BACKEND_URL;
    this.apiKey = runtime.environment.ALIOTH_API_KEY;
    this.agentId = runtime.environment.AGENT_ID;

    // Register agent with backend
    await this.registerAgent();
  },

  methods: {
    async getMarketData(tokens: string[]) {
      const response = await fetch(
        `${this.backendUrl}/api/v1/agent/market-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'X-Agent-ID': this.agentId,
          },
          body: JSON.stringify({ tokens }),
        },
      );

      if (!response.ok) {
        throw new Error(`Market data fetch failed: ${response.statusText}`);
      }

      return response.json();
    },

    async getUserPortfolio(userAddress: string) {
      const response = await fetch(
        `${this.backendUrl}/api/v1/agent/portfolio/${userAddress}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'X-Agent-ID': this.agentId,
          },
        },
      );

      return response.json();
    },

    async submitOptimization(strategy: OptimizationStrategy) {
      const response = await fetch(
        `${this.backendUrl}/api/v1/agent/submit-strategy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'X-Agent-ID': this.agentId,
          },
          body: JSON.stringify(strategy),
        },
      );

      if (!response.ok) {
        throw new Error(`Strategy submission failed: ${response.statusText}`);
      }

      return response.json();
    },

    async submitExecutionFeedback(feedback: ExecutionFeedback) {
      await fetch(`${this.backendUrl}/api/v1/agent/execution-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'X-Agent-ID': this.agentId,
        },
        body: JSON.stringify(feedback),
      });
    },
  },

  async registerAgent() {
    const registration = {
      agentId: this.agentId,
      capabilities: [
        'yield_optimization',
        'market_analysis',
        'risk_assessment',
        'rebalance_decisions',
      ],
      version: '1.0.0',
      status: 'active',
    };

    await fetch(`${this.backendUrl}/api/v1/agent/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(registration),
    });
  },
};
```

## Backend API Changes

### Agent Communication Service (`src/modules/agents/services/agent-communication.service.ts`)

```typescript
@Injectable()
export class AgentCommunicationService {
  private readonly logger = new Logger(AgentCommunicationService.name);
  private registeredAgents = new Map<string, AgentRegistration>();

  constructor(
    @InjectModel(AgentRegistry.name)
    private agentModel: Model<AgentRegistryDocument>,
    @InjectModel(AgentRequest.name)
    private requestModel: Model<AgentRequestDocument>,
    private configService: ConfigService,
  ) {}

  async registerAgent(registration: AgentRegistrationDto): Promise<void> {
    const agent = new this.agentModel({
      agentId: registration.agentId,
      capabilities: registration.capabilities,
      version: registration.version,
      status: 'active',
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
    });

    await agent.save();
    this.registeredAgents.set(registration.agentId, registration);

    this.logger.log(
      `Agent ${registration.agentId} registered with capabilities: ${registration.capabilities.join(', ')}`,
    );
  }

  async requestOptimization(
    request: OptimizationRequestDto,
  ): Promise<OptimizationStrategy> {
    const agentId = this.selectOptimizationAgent();

    if (!agentId) {
      throw new BadRequestException('No optimization agents available');
    }

    // Create request record
    const agentRequest = new this.requestModel({
      requestId: uuidv4(),
      agentId,
      requestType: 'optimization',
      requestData: request,
      status: 'pending',
      createdAt: new Date(),
    });

    await agentRequest.save();

    // Send request to agent (implementation depends on communication method)
    const strategy = await this.sendToAgent(agentId, 'OPTIMIZE_YIELD', request);

    // Update request status
    agentRequest.status = 'completed';
    agentRequest.response = strategy;
    agentRequest.completedAt = new Date();
    await agentRequest.save();

    return strategy;
  }

  async receiveStrategy(submission: StrategySubmissionDto): Promise<void> {
    // Validate strategy
    await this.validateStrategy(submission.strategy);

    // Store strategy for execution
    await this.storeAgentStrategy(submission);

    this.logger.log(
      `Received strategy ${submission.strategy.operationId} from agent ${submission.agentId}`,
    );
  }

  private selectOptimizationAgent(): string | null {
    const optimizationAgents = Array.from(this.registeredAgents.entries())
      .filter(([_, agent]) => agent.capabilities.includes('yield_optimization'))
      .map(([agentId]) => agentId);

    return optimizationAgents.length > 0 ? optimizationAgents[0] : null;
  }

  private async sendToAgent(
    agentId: string,
    action: string,
    data: any,
  ): Promise<any> {
    // Implementation depends on communication protocol (HTTP, WebSocket, etc.)
    // This is a placeholder for the actual communication logic
    throw new Error('Agent communication not implemented');
  }
}
```

### Modified AI Optimization Controller

```typescript
@Controller('ai-optimization')
@ApiTags('AI Optimization')
@UseGuards(JwtAuthGuard)
export class AIOptimizationController {
  constructor(
    private readonly agentCommunicationService: AgentCommunicationService,
    private readonly executionService: OptimizationExecutionService,
  ) {}

  @Post('optimize-deposit')
  @ApiOperation({
    summary: 'Generate AI-optimized deposit strategy via ElizaOS agent',
  })
  async optimizeDeposit(
    @Body() request: OptimizeDepositDto,
  ): Promise<OptimizationStrategy> {
    // Delegate to ElizaOS agent instead of internal service
    return await this.agentCommunicationService.requestOptimization(request);
  }

  @Post('agent-strategy')
  @ApiOperation({ summary: 'Receive strategy from ElizaOS agent' })
  async receiveAgentStrategy(
    @Body() submission: StrategySubmissionDto,
  ): Promise<ExecutionResult> {
    await this.agentCommunicationService.receiveStrategy(submission);

    // Execute the strategy
    return await this.executionService.executeStrategy(submission.strategy);
  }

  @Post('agent-feedback')
  @ApiOperation({ summary: 'Receive execution feedback from agent' })
  async receiveExecutionFeedback(
    @Body() feedback: ExecutionFeedbackDto,
  ): Promise<void> {
    await this.agentCommunicationService.processFeedback(feedback);
  }
}
```

## Database Schema Updates

### Agent Registry Schema

```typescript
@Schema()
export class AgentRegistry {
  @Prop({ required: true, unique: true })
  agentId: string;

  @Prop({ type: [String], required: true })
  capabilities: string[];

  @Prop({ required: true })
  version: string;

  @Prop({ enum: ['active', 'inactive', 'maintenance'], default: 'active' })
  status: string;

  @Prop({ default: Date.now })
  registeredAt: Date;

  @Prop({ default: Date.now })
  lastHeartbeat: Date;

  @Prop({ type: Object })
  metadata: Record<string, any>;
}
```

### Agent Request Schema

```typescript
@Schema()
export class AgentRequest {
  @Prop({ required: true, unique: true })
  requestId: string;

  @Prop({ required: true })
  agentId: string;

  @Prop({ required: true })
  requestType: string;

  @Prop({ type: Object, required: true })
  requestData: Record<string, any>;

  @Prop({ type: Object })
  response: Record<string, any>;

  @Prop({ enum: ['pending', 'completed', 'failed'], default: 'pending' })
  status: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop()
  completedAt: Date;

  @Prop()
  errorMessage: string;
}
```

## Security Implementation

### Agent Authentication Middleware

```typescript
@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(
    private agentService: AgentCommunicationService,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    const agentId = this.extractAgentIdFromHeader(request);

    if (!token || !agentId) {
      throw new UnauthorizedException('Missing agent credentials');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      const isValidAgent = await this.agentService.validateAgent(
        agentId,
        payload,
      );

      if (!isValidAgent) {
        throw new UnauthorizedException('Invalid agent credentials');
      }

      request.agentId = agentId;
      request.agentPayload = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid agent token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private extractAgentIdFromHeader(request: Request): string | undefined {
    return request.headers['x-agent-id'] as string;
  }
}
```

## Testing Strategy

### Agent Action Tests

```typescript
describe('OptimizeYieldAction', () => {
  let action: Action;
  let mockRuntime: jest.Mocked<Runtime>;

  beforeEach(() => {
    mockRuntime = createMockRuntime();
    action = optimizeYieldAction;
  });

  it('should generate valid optimization strategy', async () => {
    const message = createMockMessage({
      inputToken: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      inputAmount: '1000000000000000000',
      userAddress: '0x742F35Cc8635C0532C81b1e3a7b5CCc0B14A6e86',
      riskTolerance: 5,
    });

    const result = await action.handler(mockRuntime, message, {}, jest.fn());

    expect(result.success).toBe(true);
    expect(result.strategy).toBeDefined();
    expect(result.strategy.expectedAPY).toBeGreaterThan(0);
    expect(result.strategy.tokenAllocations).toHaveLength(
      jasmine.greaterThan(0),
    );
  });

  it('should reject invalid inputs', async () => {
    const message = createMockMessage({
      inputToken: '',
      inputAmount: '0',
      userAddress: '',
      riskTolerance: 15, // Invalid risk tolerance
    });

    const isValid = await action.validate(mockRuntime, message);
    expect(isValid).toBe(false);
  });
});
```

### Integration Tests

```typescript
describe('Agent-Backend Integration', () => {
  let app: INestApplication;
  let agentClient: AgentClient;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    agentClient = new AgentClient({
      baseUrl: `http://localhost:${app.get('PORT')}`,
      agentId: 'test-agent',
      apiKey: 'test-key',
    });
  });

  it('should complete full optimization flow', async () => {
    // 1. Register agent
    await agentClient.register();

    // 2. Request optimization
    const request = {
      inputToken: DAI_ADDRESS,
      inputAmount: '1000000000000000000',
      userAddress: TEST_USER_ADDRESS,
      riskTolerance: 5,
    };

    const strategy = await agentClient.requestOptimization(request);
    expect(strategy).toBeDefined();

    // 3. Submit strategy back to backend
    const submission = {
      agentId: 'test-agent',
      userAddress: TEST_USER_ADDRESS,
      strategy,
      confidence: 85,
      reasoning: 'Test optimization',
    };

    const result = await agentClient.submitStrategy(submission);
    expect(result.success).toBe(true);
  });
});
```

## Deployment Guide

### Environment Configuration

```bash
# ElizaOS Agent Environment (.env)
AGENT_ID=alioth-agent-prod
ALIOTH_BACKEND_URL=https://api.alioth.finance
ALIOTH_API_KEY=your_agent_api_key
AGENT_JWT_SECRET=your_jwt_secret
LOG_LEVEL=info
NODE_ENV=production

# Market Data Sources
CHAINLINK_RPC_URL=your_chainlink_rpc
COINGECKO_API_KEY=your_coingecko_key
DEBANK_API_KEY=your_debank_key

# Performance Monitoring
SENTRY_DSN=your_sentry_dsn
METRICS_ENDPOINT=your_metrics_endpoint
```

### Docker Configuration

```dockerfile
# Dockerfile for ElizaOS Agent
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY tsconfig.json ./

RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
```

### Deployment Commands

```bash
# Build and deploy agent
docker build -t alioth-eliza-agent .
docker run -d \
  --name alioth-agent \
  --env-file .env \
  -p 3001:3001 \
  alioth-eliza-agent

# Backend deployment with agent support
# Update backend environment variables
AGENT_COMMUNICATION_ENABLED=true
AGENT_JWT_SECRET=your_jwt_secret
AGENT_RATE_LIMIT_TTL=60
AGENT_RATE_LIMIT_MAX=100
```

This comprehensive implementation guide provides everything needed to separate the AI functionality from your NestJS backend into a standalone ElizaOS agent while maintaining seamless integration and all existing capabilities.
