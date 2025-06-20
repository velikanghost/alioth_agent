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
 * Helper function to format general yield response
 */
const formatGeneralYieldResponse = (yields: any[]): string => {
  let response = `🔍 **Live Yield Analysis** 📊\n\n**🚀 Top Yield Opportunities:**\n\n`

  yields.slice(0, 6).forEach((yield_, index) => {
    const riskLevel =
      yield_.symbol?.includes('USD') || yield_.symbol?.includes('stETH')
        ? 'Low'
        : 'Medium'
    response += `${index + 1}. **${yield_.project}** (${yield_.chain}): **${yield_.apy?.toFixed(1)}%** APY\n`
    response += `   • Asset: ${yield_.symbol}\n`
    response += `   • TVL: $${(yield_.tvlUsd / 1000000).toFixed(1)}M\n`
    response += `   • Risk: ${riskLevel}\n\n`
  })

  return response
}

/**
 * Yield Analysis Action - Now using real DeFi data
 */
export const analyzeYieldAction: Action = {
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

    // More specific validation for yield/supply queries
    const hasYieldTerms =
      text.includes('yield') ||
      text.includes('apy') ||
      text.includes('farming') ||
      text.includes('opportunities') ||
      text.includes('best rates')

    const hasProtocolTerms =
      text.includes('aave') ||
      text.includes('compound') ||
      text.includes('supply') ||
      text.includes('lend') ||
      text.includes('protocol')

    const hasBestTokenQuery =
      text.includes('best token') ||
      text.includes('best asset') ||
      text.includes('which token') ||
      text.includes('what token')

    const hasSupplyContext =
      text.includes('supply') ||
      text.includes('lend') ||
      text.includes('deposit')

    // Trigger if:
    // 1. Has yield terms, OR
    // 2. Has protocol terms AND supply context, OR
    // 3. Has best token query AND supply context, OR
    // 4. Specifically mentions Aave/protocols with supply intent
    return (
      hasYieldTerms ||
      (hasProtocolTerms && hasSupplyContext) ||
      (hasBestTokenQuery && hasSupplyContext) ||
      (text.includes('aave') &&
        (text.includes('best') ||
          text.includes('supply') ||
          text.includes('data')))
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
      logger.info(
        '🔍 Fetching real-time yield opportunities from DeFi protocols',
      )

      const text = message.content.text?.toLowerCase() || ''

      // Check if user specifically mentioned Aave
      const isAaveQuery = text.includes('aave')
      const isSupplyQuery = text.includes('supply') || text.includes('lend')

      let yields: any[] = []
      let responseText = ''

      if (isAaveQuery) {
        // Get specific Aave data
        logger.info('🎯 Analyzing Aave supply opportunities')

        try {
          // Get Aave-specific pools from dataService
          const aavePools = await defiDataService.getPoolsByProtocol('Aave')

          if (aavePools.length > 0) {
            // Sort by APY descending
            const sortedAave = aavePools.sort(
              (a, b) => (b.apy || 0) - (a.apy || 0),
            )

            responseText = `🎯 **Aave V3 Supply Analysis** 📊\n\n**🚀 Best Aave Supply Opportunities:**\n\n`

            sortedAave.slice(0, 5).forEach((pool, index) => {
              const riskLevel =
                pool.symbol?.includes('USDC') ||
                pool.symbol?.includes('USDT') ||
                pool.symbol?.includes('DAI')
                  ? 'Low'
                  : 'Medium'
              responseText += `${index + 1}. **${pool.symbol}**: **${pool.apy?.toFixed(2)}%** APY\n`
              responseText += `   • TVL: $${(pool.tvlUsd / 1000000).toFixed(1)}M\n`
              responseText += `   • Risk: ${riskLevel}\n`
              responseText += `   • Chain: ${pool.chain}\n\n`
            })

            // Add recommendation
            const bestToken = sortedAave[0]
            if (bestToken) {
              responseText += `💡 **Recommendation**: ${bestToken.symbol} offers the highest yield at ${bestToken.apy?.toFixed(2)}% APY. `

              if (bestToken.symbol?.includes('USD')) {
                responseText += `As a stablecoin, it provides stable returns with minimal price risk.\n\n`
              } else {
                responseText += `Consider the volatility risk of this asset in your portfolio allocation.\n\n`
              }
            }
          } else {
            // Fallback to general analysis if Aave-specific fails
            yields = await defiDataService.getTopYieldOpportunities(8, 1000000)
            responseText = formatGeneralYieldResponse(yields)
          }
        } catch (error) {
          logger.error('Error fetching Aave data:', error)
          // Fallback to general yield analysis
          yields = await defiDataService.getTopYieldOpportunities(8, 1000000)
          responseText = formatGeneralYieldResponse(yields)
        }
      } else {
        // General yield analysis
        yields = await defiDataService.getTopYieldOpportunities(8, 1000000)
        responseText = formatGeneralYieldResponse(yields)
      }

      responseText += `📊 **Data Sources:**\n`
      responseText += `• DeFiLlama API (TVL & Protocol Data)\n`
      responseText += `• CoinGecko API (Token Prices)\n`
      responseText += `• Real-time protocol monitoring\n\n`
      responseText += `⚠️ **Risk Disclaimer:** Always DYOR. Past performance doesn't guarantee future results. Consider protocol risks, smart contract risks, and market volatility.`

      const responseContent: Content = {
        text: responseText,
        actions: ['ANALYZE_YIELD'],
        source: message.content.source,
      }

      await callback(responseContent)
      return responseContent
    } catch (error) {
      logger.error('Error in ANALYZE_YIELD action:', error)

      const errorContent: Content = {
        text: '❌ **Error fetching yield data**\n\nUnable to retrieve current yield opportunities. This might be due to API rate limits or network issues. Please try again in a few minutes.',
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
        content: {
          text: 'What are the best yield opportunities right now?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '🔍 **Live Yield Analysis** 📊\n\n**🚀 Top Yield Opportunities:**\n**Aave** (Ethereum): **8.2%** APY...',
          actions: ['ANALYZE_YIELD'],
        },
      },
    ],
  ],
}
