import type { Plugin } from '@elizaos/core'
import { logger } from '@elizaos/core'
import { z } from 'zod'

// Import configuration
import { configSchema, defaultConfig } from './config/schema.js'

// Import providers
import {
  investmentAllocationProvider,
  protocolMonitorProvider,
  defiAnalysisProvider,
} from './providers/index.js'

// Import routes
import { routes } from './routes/index.js'

// Import services
import { YieldOptimizationService } from './services/index.js'

// Import actions - Updated to remove swap-related actions
import {
  analyzeYieldAction,
  optimizePortfolioAction,
  historicalAnalysisAction,
  calculateILAction,
  riskAssessmentAction,
  directDepositOptimizationAction,
} from './actions/index.js'

/**
 * Simplified DeFi yield optimization plugin - Direct deposits only (no swaps)
 */
const plugin: Plugin = {
  name: 'yield_optimizer',
  description:
    'Simplified DeFi yield optimization for direct token deposits without swap execution',
  priority: 2000,
  config: defaultConfig,

  async init(config: Record<string, string>) {
    logger.info(
      '*** Initializing Simplified Yield Optimizer Plugin (Direct Deposits Only) ***',
    )
    try {
      const validatedConfig = await configSchema.parseAsync(config)

      // Set environment variables
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value) process.env[key] = value
      }

      logger.info('Simplified yield optimizer plugin initialized successfully')
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid plugin configuration: ${error.errors.map((e) => e.message).join(', ')}`,
        )
      }
      throw error
    }
  },

  routes: routes,

  // Actions for yield analysis and direct deposit optimization (no swaps)
  actions: [
    analyzeYieldAction,
    optimizePortfolioAction,
    historicalAnalysisAction,
    calculateILAction,
    riskAssessmentAction,
    directDepositOptimizationAction, // New main action for direct deposits
  ],

  events: {
    MESSAGE_RECEIVED: [
      async (params) => {
        logger.info(
          'Processing yield optimization query (direct deposits only)',
        )
      },
    ],
    YIELD_OPPORTUNITY_DETECTED: [
      async (params) => {
        logger.info('New yield opportunity detected')
      },
    ],
    DEPOSIT_OPTIMIZED: [
      async (params) => {
        logger.info('Direct deposit optimization completed')
      },
    ],
  },

  services: [YieldOptimizationService],

  providers: [
    protocolMonitorProvider,
    investmentAllocationProvider,
    defiAnalysisProvider,
  ],
}

export default plugin
