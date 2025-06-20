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
 * Historical Pool Analysis Action - Analyzes pool trends and historical data
 */
export const historicalAnalysisAction: Action = {
  name: 'ANALYZE_POOL_HISTORY',
  similes: [
    'POOL_TRENDS',
    'HISTORICAL_DATA',
    'POOL_ANALYSIS',
    'TREND_ANALYSIS',
    'HISTORICAL_YIELD',
  ],
  description:
    'Analyzes historical yield and TVL trends for specific pools using real DeFiLlama data',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || ''
    return (
      text.includes('historical') ||
      text.includes('trend') ||
      text.includes('history') ||
      text.includes('past performance') ||
      text.includes('chart') ||
      text.includes('pool analysis') ||
      (text.includes('pool') && text.includes('747c1d2a')) // Specific pool ID
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
      logger.info('Analyzing pool historical data')

      // Extract pool ID from message if provided
      const text = message.content.text || ''
      const poolIdMatch = text.match(/([a-f0-9-]{36})/) // UUID pattern
      let poolId = poolIdMatch
        ? poolIdMatch[1]
        : '747c1d2a-c668-4682-b9f9-296708a3dd90' // Default example

      try {
        // Fetch historical data and analyze trends
        const [historicalData, trends] = await Promise.all([
          defiDataService.getPoolHistoricalData(poolId, 30),
          defiDataService.analyzePoolTrends(poolId, 30),
        ])

        if (historicalData.length === 0) {
          const noDataContent: Content = {
            text:
              `⚠️ **No Historical Data Found**\n\n` +
              `Pool ID: \`${poolId}\`\n\n` +
              `This could mean:\n` +
              `• Pool ID doesn't exist or is incorrect\n` +
              `• Pool is too new (less than 30 days)\n` +
              `• Data temporarily unavailable\n\n` +
              `💡 Try analyzing a different pool or ask about "top yield opportunities" instead.`,
            actions: ['ANALYZE_POOL_HISTORY'],
            source: message.content.source,
          }
          await callback(noDataContent)
          return noDataContent
        }

        // Format trends analysis
        const apyTrendIcon =
          trends.apyTrend === 'increasing'
            ? '📈'
            : trends.apyTrend === 'decreasing'
              ? '📉'
              : '➡️'
        const tvlTrendIcon =
          trends.tvlTrend === 'increasing'
            ? '📈'
            : trends.tvlTrend === 'decreasing'
              ? '📉'
              : '➡️'

        const riskColor =
          trends.riskScore <= 3 ? '🟢' : trends.riskScore <= 6 ? '🟡' : '🔴'

        // Calculate key metrics
        const latestData = historicalData[historicalData.length - 1]
        const oldestData = historicalData[0]
        const apyChange =
          ((latestData.apy - oldestData.apy) / oldestData.apy) * 100
        const tvlChange =
          ((latestData.tvlUsd - oldestData.tvlUsd) / oldestData.tvlUsd) * 100

        const responseContent: Content = {
          text:
            `📊 **Pool Historical Analysis** (30 days)\n\n` +
            `**🔗 Pool ID:** \`${poolId}\`\n\n` +
            `**📈 Current Metrics:**\n` +
            `• APY: **${trends.currentApy.toFixed(2)}%** (${apyChange >= 0 ? '+' : ''}${apyChange.toFixed(1)}% vs 30d ago)\n` +
            `• TVL: **$${(latestData.tvlUsd / 1_000_000).toFixed(1)}M** (${tvlChange >= 0 ? '+' : ''}${tvlChange.toFixed(1)}% vs 30d ago)\n\n` +
            `**📊 Trend Analysis:**\n` +
            `• APY Trend: ${apyTrendIcon} **${trends.apyTrend.toUpperCase()}** (30d avg: ${trends.averageApy.toFixed(2)}%)\n` +
            `• TVL Trend: ${tvlTrendIcon} **${trends.tvlTrend.toUpperCase()}**\n` +
            `• Volatility: **${trends.volatility.toFixed(1)}%** ${trends.volatility > 25 ? '(High)' : trends.volatility > 10 ? '(Medium)' : '(Low)'}\n\n` +
            `**⚖️ Risk Assessment:**\n` +
            `• Risk Score: ${riskColor} **${trends.riskScore}/10**\n` +
            `• Recommendation: **${trends.recommendation}**\n\n` +
            `**📊 Data Summary:**\n` +
            `• Data Points: ${historicalData.length} days\n` +
            `• Highest APY: ${Math.max(...historicalData.map((d) => d.apy)).toFixed(2)}%\n` +
            `• Lowest APY: ${Math.min(...historicalData.map((d) => d.apy)).toFixed(2)}%\n` +
            `• Peak TVL: $${(Math.max(...historicalData.map((d) => d.tvlUsd)) / 1_000_000).toFixed(1)}M\n\n` +
            `**💡 Investment Insights:**\n` +
            `• **Stability:** ${trends.volatility < 10 ? 'High' : trends.volatility < 25 ? 'Medium' : 'Low'} (based on APY volatility)\n` +
            `• **Growth:** ${trends.tvlTrend === 'increasing' ? 'Expanding' : trends.tvlTrend === 'decreasing' ? 'Contracting' : 'Stable'} TVL indicates ${trends.tvlTrend === 'increasing' ? 'growing confidence' : trends.tvlTrend === 'decreasing' ? 'declining interest' : 'stable interest'}\n` +
            `• **Timing:** ${trends.apyTrend === 'increasing' ? 'Good entry point' : trends.apyTrend === 'decreasing' ? 'Consider waiting' : 'Neutral timing'}\n\n` +
            `*Historical data from DeFiLlama • Updated in real-time*`,
          actions: ['ANALYZE_POOL_HISTORY'],
          source: message.content.source,
        }

        await callback(responseContent)
        return responseContent
      } catch (dataError) {
        logger.error('Error fetching pool historical data:', dataError)

        const errorContent: Content = {
          text:
            `❌ **Error Analyzing Pool History**\n\n` +
            `Pool ID: \`${poolId}\`\n\n` +
            `Unable to fetch historical data. This could be due to:\n` +
            `• Invalid or non-existent pool ID\n` +
            `• API rate limiting\n` +
            `• Temporary service issues\n\n` +
            `💡 **Try:**\n` +
            `• Using a different pool ID\n` +
            `• Asking for "top yield opportunities" to find valid pools\n` +
            `• Checking the DeFiLlama website for valid pool identifiers`,
          actions: ['ANALYZE_POOL_HISTORY'],
          source: message.content.source,
        }

        await callback(errorContent)
        return errorContent
      }
    } catch (error) {
      logger.error('Error in ANALYZE_POOL_HISTORY action:', error)

      const errorContent: Content = {
        text:
          '❌ **Historical Analysis Unavailable**\n\n' +
          'Unable to perform historical analysis at this time. Please try again later or ask about current yield opportunities.',
        actions: ['ANALYZE_POOL_HISTORY'],
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
          text: 'Analyze historical data for pool 747c1d2a-c668-4682-b9f9-296708a3dd90',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '📊 **Pool Historical Analysis** (30 days)\n\n**🔗 Pool ID:** `747c1d2a-c668-4682-b9f9-296708a3dd90`...',
          actions: ['ANALYZE_POOL_HISTORY'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Show me the trend analysis for this pool',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '📊 **Pool Historical Analysis** (30 days)...',
          actions: ['ANALYZE_POOL_HISTORY'],
        },
      },
    ],
  ],
}
