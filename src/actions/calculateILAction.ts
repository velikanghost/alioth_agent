import type {
  Action,
  Content,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from '@elizaos/core'
import { logger } from '@elizaos/core'
import { defiDataService } from '../services/dataService.js'

/**
 * Enhanced Impermanent Loss Calculator
 */
export const calculateILAction: Action = {
  name: 'CALCULATE_IL',
  similes: ['IMPERMANENT_LOSS', 'IL_CALC', 'LP_RISK', 'LIQUIDITY_RISK'],
  description:
    'Calculates impermanent loss scenarios with real market examples',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || ''
    return (
      text.includes('impermanent') ||
      text.includes('il') ||
      text.includes('liquidity') ||
      text.includes('lp') ||
      text.includes('pool') ||
      text.includes('loss')
    )
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: HandlerCallback,
    responses: Memory[],
  ) => {
    try {
      logger.info('Calculating impermanent loss with real examples')

      // IL calculation scenarios
      const scenarios = [
        { priceChange: 10, il: defiDataService.calculateImpermanentLoss(10) },
        { priceChange: 25, il: defiDataService.calculateImpermanentLoss(25) },
        { priceChange: 50, il: defiDataService.calculateImpermanentLoss(50) },
        { priceChange: 100, il: defiDataService.calculateImpermanentLoss(100) },
        { priceChange: 200, il: defiDataService.calculateImpermanentLoss(200) },
      ]

      const ilTable = scenarios
        .map(
          (s) =>
            `**±${s.priceChange}%** price change: **${s.il.toFixed(2)}%** IL`,
        )
        .join('\n')

      // Try to get real pool examples
      let poolExamples = ''
      try {
        const pools = await defiDataService.getYieldPools()
        const ethPools = pools
          .filter(
            (p) =>
              p.symbol.includes('ETH') &&
              (p.symbol.includes('USDC') || p.symbol.includes('USDT')) &&
              p.tvlUsd > 5_000_000,
          )
          .slice(0, 2)

        if (ethPools.length > 0) {
          poolExamples =
            `\n\n🔍 **Real Pool Examples:**\n` +
            ethPools
              .map(
                (pool) =>
                  `• **${pool.project}** ${pool.symbol}: ${(pool.apy || 0).toFixed(1)}% APY (${pool.chain})`,
              )
              .join('\n')
        }
      } catch (error) {
        logger.error('Error fetching pool examples:', error)
      }

      const responseContent: Content = {
        text:
          `📉 **Impermanent Loss Calculator** 📊\n\n` +
          `${ilTable}\n\n` +
          `💡 **IL Mitigation Strategies:**\n` +
          `• **Correlated pairs**: ETH/stETH, USDC/USDT (minimal IL)\n` +
          `• **Stablecoin pairs**: Lower volatility = lower IL\n` +
          `• **Single-sided staking**: No IL risk (Aave, Compound)\n` +
          `• **Short-term positions**: Less time = less IL exposure\n` +
          `• **Fee tier selection**: Higher fees can offset IL\n\n` +
          `⚖️ **Break-even Analysis:**\n` +
          `LP fees + rewards must exceed IL for profitability\n` +
          `Example: 2% IL needs >2% additional yield to break even\n\n` +
          `🎯 **Pro Tips:**\n` +
          `• Monitor price ratios regularly\n` +
          `• Set IL alerts at 1-2% levels\n` +
          `• Consider IL insurance products\n` +
          `• Factor IL into total return calculations${poolExamples}`,
        actions: ['CALCULATE_IL'],
        source: message.content.source,
      }

      await callback(responseContent)
      return responseContent
    } catch (error) {
      logger.error('Error in CALCULATE_IL action:', error)
      throw error
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Calculate impermanent loss for ETH/USDC',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '📉 **Impermanent Loss Calculator** 📊\n\n**±10%** price change: **0.10%** IL...',
          actions: ['CALCULATE_IL'],
        },
      },
    ],
  ],
}
