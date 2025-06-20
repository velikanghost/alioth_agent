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

/**
 * Production-ready DeFi yield optimization plugin with unified response handling
 */
const plugin: Plugin = {
  name: 'yield_optimizer',
  description:
    'Production-ready DeFi yield optimization with unified response handling to prevent duplicates',
  priority: 2000,
  config: defaultConfig,

  async init(config: Record<string, string>) {
    logger.info('*** Initializing Unified Yield Optimizer Plugin ***')
    try {
      const validatedConfig = await configSchema.parseAsync(config)

      // Set environment variables
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value) process.env[key] = value
      }

      logger.info('Unified yield optimizer plugin initialized successfully')
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

  events: {
    MESSAGE_RECEIVED: [
      async (params) => {
        logger.info('Processing unified yield optimization query')
      },
    ],
    YIELD_OPPORTUNITY_DETECTED: [
      async (params) => {
        logger.info('New yield opportunity detected')
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
