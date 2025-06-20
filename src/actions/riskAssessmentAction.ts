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
 * Risk Assessment Action - Now with real protocol risk analysis
 */
export const riskAssessmentAction: Action = {
  name: 'ASSESS_RISK',
  similes: ['CALCULATE_RISK', 'RISK_ANALYSIS', 'SAFETY_CHECK', 'PROTOCOL_RISK'],
  description:
    'Assesses risks for DeFi protocols using real TVL, audit, and market data',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || ''
    return (
      text.includes('risk') ||
      text.includes('safe') ||
      text.includes('dangerous') ||
      text.includes('audit') ||
      text.includes('secure')
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
      logger.info('Assessing DeFi risks with real data')

      // Extract protocol name from message if mentioned
      const text = message.content.text?.toLowerCase() || ''
      const protocolNames = [
        'aave',
        'compound',
        'uniswap',
        'curve',
        'convex',
        'lido',
        'makerdao',
      ]
      const mentionedProtocol = protocolNames.find((name) =>
        text.includes(name),
      )

      let riskAnalysis = ''

      if (mentionedProtocol) {
        // Analyze specific protocol
        try {
          const riskMetrics =
            await defiDataService.calculateProtocolRisk(mentionedProtocol)

          riskAnalysis =
            `🔍 **${mentionedProtocol.charAt(0).toUpperCase() + mentionedProtocol.slice(1)} Risk Analysis**\n\n` +
            `**Overall Risk Score: ${riskMetrics.overallRisk}/10** ` +
            `(${riskMetrics.overallRisk <= 4 ? 'Low' : riskMetrics.overallRisk <= 7 ? 'Medium' : 'High'})\n\n` +
            `**Risk Breakdown:**\n` +
            `• Protocol Risk: ${riskMetrics.protocolRisk}/10\n` +
            `• Smart Contract Risk: ${riskMetrics.smartContractRisk}/10\n` +
            `• Liquidity Risk: ${riskMetrics.liquidityRisk}/10\n` +
            `• Market Risk: ${riskMetrics.marketRisk}/10\n` +
            `• Composability Risk: ${riskMetrics.composabilityRisk}/10\n\n`

          if (riskMetrics.riskFactors.length > 0) {
            riskAnalysis += `⚠️ **Risk Factors:**\n${riskMetrics.riskFactors.map((f) => `• ${f}`).join('\n')}\n\n`
          }
        } catch (error) {
          logger.error(`Error analyzing ${mentionedProtocol}:`, error)
          riskAnalysis = `⚠️ Unable to analyze ${mentionedProtocol} - protocol may not be found in database.\n\n`
        }
      }

      // General risk framework
      const generalRisk =
        `🛡️ **DeFi Risk Framework** 📊\n\n` +
        `**Smart Contract Risk** (varies by protocol):\n` +
        `💡 *Mitigation:* Use audited protocols with long track records\n\n` +
        `**Impermanent Loss** (LP positions):\n` +
        `💡 *Mitigation:* Choose correlated pairs or single-sided staking\n\n` +
        `**Liquidation Risk** (leveraged positions):\n` +
        `💡 *Mitigation:* Maintain healthy collateralization ratios\n\n` +
        `**Protocol Risk** (governance/economic):\n` +
        `💡 *Mitigation:* Diversify across multiple protocols\n\n` +
        `🎯 **Best Practices:**\n` +
        `• Never invest more than you can afford to lose\n` +
        `• Start small and gradually increase exposure\n` +
        `• Diversify across protocols, chains, and strategies\n` +
        `• Monitor TVL trends and protocol news\n` +
        `• Set position limits and stop-losses`

      const responseContent: Content = {
        text: riskAnalysis + generalRisk,
        actions: ['ASSESS_RISK'],
        source: message.content.source,
      }

      await callback(responseContent)
      return responseContent
    } catch (error) {
      logger.error('Error in ASSESS_RISK action:', error)
      throw error
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'How risky is Aave?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '🔍 **Aave Risk Analysis**\n\n**Overall Risk Score: 3.2/10** (Low)...',
          actions: ['ASSESS_RISK'],
        },
      },
    ],
  ],
}
