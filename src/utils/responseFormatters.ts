import type {
  YieldAnalysisResponse,
  AllocationStrategy,
  DetailedAllocation,
  MarketData,
  RiskAnalysisResponse,
} from '../types/interfaces.js'

/**
 * Formats yield analysis response for conversational UI
 */
export const formatConversationalYieldResponse = (
  analysis: YieldAnalysisResponse,
): string => {
  const { allocation, confidence, reasoning, marketAnalysis } = analysis

  let response = `🔍 **Live Yield Analysis** 📊\n\n`
  response += `**🚀 Top Opportunities for ${allocation[0]?.token || 'your tokens'}:**\n\n`

  allocation.slice(0, 5).forEach((alloc, i) => {
    response += `${i + 1}. **${alloc.protocol}** (${alloc.chain}): **${alloc.expectedAPY.toFixed(1)}%** APY\n`
    response += `   • Allocation: ${alloc.percentage}%\n`
    response += `   • TVL: $${(alloc.tvl / 1000000).toFixed(1)}M\n`
    response += `   • Risk Score: ${alloc.riskScore}/10\n\n`
  })

  response += `💡 **Reasoning**: ${reasoning}\n`
  response += `🎯 **Confidence**: ${confidence}%\n\n`

  // Add market context
  response += `📊 **Market Context**:\n`
  response += `• Total DeFi TVL: $${(marketAnalysis.totalTvl / 1000000000).toFixed(1)}B\n`
  response += `• Average Yield: ${marketAnalysis.averageYield.toFixed(1)}%\n`
  response += `• Market Condition: ${marketAnalysis.marketCondition}\n`
  response += `• Top Protocols: ${marketAnalysis.topProtocols.slice(0, 3).join(', ')}\n\n`

  response += `⚠️ **Risk Disclaimer**: Always DYOR. Past performance doesn't guarantee future results.`

  return response
}

/**
 * Formats portfolio optimization response for conversational UI
 */
export const formatPortfolioResponse = (
  strategy: AllocationStrategy,
  allocation: DetailedAllocation,
  marketData: MarketData,
): string => {
  let response = `📊 **${strategy.description}** 🎯\n\n`

  response += `**Allocation Breakdown:**\n`
  response += `• Stablecoins: ${strategy.stablecoins}% (${allocation.stablecoins.map((p) => p.protocol).join(', ')})\n`
  response += `• Blue-chip DeFi: ${strategy.bluechip}% (${allocation.bluechip.map((p) => p.protocol).join(', ')})\n`
  response += `• Risk Assets: ${strategy.riskAssets}% (${allocation.riskAssets.map((p) => p.protocol).join(', ')})\n\n`

  response += `🎯 **Expected APY**: ${strategy.targetAPY}\n\n`

  // Detailed breakdown by category
  if (allocation.stablecoins.length > 0) {
    response += `**💰 Stablecoin Allocations:**\n`
    allocation.stablecoins.forEach((alloc) => {
      response += `• ${alloc.protocol}: ${alloc.percentage}% → ${alloc.expectedAPY.toFixed(1)}% APY\n`
    })
    response += `\n`
  }

  if (allocation.bluechip.length > 0) {
    response += `**💎 Blue-chip Allocations:**\n`
    allocation.bluechip.forEach((alloc) => {
      response += `• ${alloc.protocol}: ${alloc.percentage}% → ${alloc.expectedAPY.toFixed(1)}% APY\n`
    })
    response += `\n`
  }

  if (allocation.riskAssets.length > 0) {
    response += `**🚀 Risk Asset Allocations:**\n`
    allocation.riskAssets.forEach((alloc) => {
      response += `• ${alloc.protocol}: ${alloc.percentage}% → ${alloc.expectedAPY.toFixed(1)}% APY\n`
    })
    response += `\n`
  }

  response += formatMarketContext(marketData)

  return response
}

/**
 * Formats risk analysis response for conversational UI
 */
export const formatConversationalRiskResponse = (
  analysis: RiskAnalysisResponse,
): string => {
  let response = `🛡️ **Risk Analysis** 📊\n\n`

  if (analysis.protocol) {
    response += `**Protocol**: ${analysis.protocol}\n`
  }

  response += `**Overall Risk Score**: ${analysis.overallRisk}/10 `
  response += `(${analysis.overallRisk <= 3 ? 'Low' : analysis.overallRisk <= 6 ? 'Medium' : 'High'})\n\n`

  response += `**Risk Breakdown:**\n`
  response += `• Protocol Risk: ${analysis.breakdown.protocolRisk}/10\n`
  response += `• Smart Contract Risk: ${analysis.breakdown.smartContractRisk}/10\n`
  response += `• Liquidity Risk: ${analysis.breakdown.liquidityRisk}/10\n`
  response += `• Market Risk: ${analysis.breakdown.marketRisk}/10\n`
  response += `• Composability Risk: ${analysis.breakdown.composabilityRisk}/10\n\n`

  if (analysis.riskFactors.length > 0) {
    response += `⚠️ **Risk Factors:**\n`
    analysis.riskFactors.forEach((factor) => {
      response += `• ${factor}\n`
    })
    response += `\n`
  }

  if (analysis.mitigation.length > 0) {
    response += `💡 **Risk Mitigation:**\n`
    analysis.mitigation.forEach((mitigation) => {
      response += `• ${mitigation}\n`
    })
    response += `\n`
  }

  response += `🎯 **Recommendation**: ${analysis.recommendation}`

  return response
}

/**
 * Formats market context information
 */
export const formatMarketContext = (marketData: MarketData): string => {
  let context = `📊 **Market Context** (${new Date(marketData.timestamp).toLocaleDateString()}):\n`
  context += `• Total DeFi TVL: $${(marketData.totalTvl / 1000000000).toFixed(1)}B\n`
  context += `• Average Market Yield: ${marketData.averageYield.toFixed(1)}%\n`
  context += `• Market Condition: ${marketData.marketCondition.charAt(0).toUpperCase() + marketData.marketCondition.slice(1)}\n`
  context += `• Leading Protocols: ${marketData.topProtocols.slice(0, 3).join(', ')}\n\n`

  // Add market-specific advice
  if (marketData.marketCondition === 'bull') {
    context += `🚀 **Bull Market Strategy**: Consider higher-risk, higher-reward opportunities.\n`
  } else if (marketData.marketCondition === 'bear') {
    context += `🛡️ **Bear Market Strategy**: Focus on stable yields and capital preservation.\n`
  } else {
    context += `⚖️ **Sideways Market Strategy**: Balanced approach with steady yield generation.\n`
  }

  return context
}

/**
 * Formats a simple success response for API calls
 */
export const formatAPISuccessResponse = (data: any): string => {
  return JSON.stringify(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    null,
    2,
  )
}

/**
 * Formats an error response for API calls
 */
export const formatAPIErrorResponse = (error: string): string => {
  return JSON.stringify(
    {
      success: false,
      error,
      timestamp: new Date().toISOString(),
    },
    null,
    2,
  )
}
