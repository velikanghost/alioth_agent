import type {
  IAgentRuntime,
  Memory,
  Provider,
  ProviderResult,
  State,
} from '@elizaos/core'
import { logger } from '@elizaos/core'
import { defiDataService } from '../services/dataService.js'

/**
 * DeFi Analysis Provider - Pre-computes all DeFi analysis before REPLY action
 * This ensures REPLY has rich context without duplicate responses
 */
export const defiAnalysisProvider: Provider = {
  name: 'DEFI_ANALYSIS',
  description:
    'Pre-computes DeFi yield analysis, risk assessment, and portfolio optimization data',

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    try {
      const text = message.content.text?.toLowerCase() || ''

      // Check if this is a DeFi-related query
      const isDeFiQuery =
        text.includes('yield') ||
        text.includes('apy') ||
        text.includes('aave') ||
        text.includes('compound') ||
        text.includes('defi') ||
        text.includes('farming') ||
        text.includes('protocol') ||
        text.includes('supply') ||
        text.includes('lend') ||
        text.includes('risk') ||
        text.includes('portfolio') ||
        text.includes('allocat') ||
        text.includes('impermanent') ||
        text.includes('liquidity') ||
        text.includes('tvl') ||
        text.includes('best token') ||
        text.includes('opportunities')

      if (!isDeFiQuery) {
        return {
          text: '',
          values: {},
          data: {},
        }
      }

      logger.info('🔍 Pre-computing DeFi analysis for REPLY action')

      // 1. YIELD ANALYSIS
      let yieldAnalysis = null
      const isYieldQuery =
        text.includes('yield') ||
        text.includes('apy') ||
        text.includes('farming') ||
        text.includes('opportunities') ||
        text.includes('best rates') ||
        (text.includes('aave') &&
          (text.includes('best') ||
            text.includes('supply') ||
            text.includes('data'))) ||
        (text.includes('supply') && text.includes('protocol')) ||
        (text.includes('best token') && text.includes('supply'))

      if (isYieldQuery) {
        try {
          const isAaveQuery = text.includes('aave')

          if (isAaveQuery) {
            const aavePools = await defiDataService.getPoolsByProtocol('Aave')
            if (aavePools.length > 0) {
              const sortedAave = aavePools.sort(
                (a, b) => (b.apy || 0) - (a.apy || 0),
              )

              let responseText = `🎯 **Aave V3 Supply Analysis** 📊\n\n**🚀 Best Aave Supply Opportunities:**\n\n`

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

              const bestToken = sortedAave[0]
              if (bestToken) {
                responseText += `💡 **Recommendation**: ${bestToken.symbol} offers the highest yield at ${bestToken.apy?.toFixed(2)}% APY. `
                if (bestToken.symbol?.includes('USD')) {
                  responseText += `As a stablecoin, it provides stable returns with minimal price risk.\n\n`
                } else {
                  responseText += `Consider the volatility risk of this asset in your portfolio allocation.\n\n`
                }
              }

              yieldAnalysis = {
                type: 'aave_specific',
                content: responseText,
                pools: sortedAave.slice(0, 5),
                bestToken,
              }
            }
          }

          if (!yieldAnalysis) {
            const yields = await defiDataService.getTopYieldOpportunities(
              8,
              1000000,
            )
            let responseText = `🔍 **Live Yield Analysis** 📊\n\n**🚀 Top Yield Opportunities:**\n\n`

            yields.slice(0, 6).forEach((yield_, index) => {
              const riskLevel =
                yield_.symbol?.includes('USD') ||
                yield_.symbol?.includes('stETH')
                  ? 'Low'
                  : 'Medium'
              responseText += `${index + 1}. **${yield_.project}** (${yield_.chain}): **${yield_.apy?.toFixed(1)}%** APY\n`
              responseText += `   • Asset: ${yield_.symbol}\n`
              responseText += `   • TVL: $${(yield_.tvlUsd / 1000000).toFixed(1)}M\n`
              responseText += `   • Risk: ${riskLevel}\n\n`
            })

            yieldAnalysis = {
              type: 'general_yield',
              content: responseText,
              yields: yields.slice(0, 6),
            }
          }
        } catch (error) {
          logger.error('Error in yield analysis:', error)
        }
      }

      // 2. RISK ASSESSMENT
      let riskAnalysis = null
      const isRiskQuery =
        text.includes('risk') ||
        text.includes('safe') ||
        text.includes('dangerous') ||
        text.includes('audit') ||
        text.includes('secure')

      if (isRiskQuery) {
        try {
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

          let riskContent = ''
          if (mentionedProtocol) {
            try {
              const riskMetrics =
                await defiDataService.calculateProtocolRisk(mentionedProtocol)
              riskContent =
                `🔍 **${mentionedProtocol.charAt(0).toUpperCase() + mentionedProtocol.slice(1)} Risk Analysis**\n\n` +
                `**Overall Risk Score: ${riskMetrics.overallRisk}/10** (${riskMetrics.overallRisk <= 4 ? 'Low' : riskMetrics.overallRisk <= 7 ? 'Medium' : 'High'})\n\n` +
                `**Risk Breakdown:**\n• Protocol Risk: ${riskMetrics.protocolRisk}/10\n• Smart Contract Risk: ${riskMetrics.smartContractRisk}/10\n• Liquidity Risk: ${riskMetrics.liquidityRisk}/10\n• Market Risk: ${riskMetrics.marketRisk}/10\n• Composability Risk: ${riskMetrics.composabilityRisk}/10\n\n`
              if (riskMetrics.riskFactors.length > 0) {
                riskContent += `⚠️ **Risk Factors:**\n${riskMetrics.riskFactors.map((f) => `• ${f}`).join('\n')}\n\n`
              }

              riskAnalysis = {
                type: 'protocol_specific',
                protocol: mentionedProtocol,
                content: riskContent,
                metrics: riskMetrics,
              }
            } catch (error) {
              riskContent = `⚠️ Unable to analyze ${mentionedProtocol} - protocol may not be found in database.\n\n`
              riskAnalysis = {
                type: 'protocol_error',
                protocol: mentionedProtocol,
                content: riskContent,
              }
            }
          }

          if (!riskAnalysis) {
            const generalRisk =
              `🛡️ **DeFi Risk Framework** 📊\n\n` +
              `**Smart Contract Risk**: Use audited protocols with long track records\n` +
              `**Impermanent Loss**: Choose correlated pairs or single-sided staking\n` +
              `**Liquidation Risk**: Maintain healthy collateralization ratios\n` +
              `**Protocol Risk**: Diversify across multiple protocols\n\n` +
              `🎯 **Best Practices:**\n• Never invest more than you can afford to lose\n• Start small and gradually increase exposure\n• Diversify across protocols, chains, and strategies`

            riskAnalysis = {
              type: 'general_risk',
              content: generalRisk,
            }
          }
        } catch (error) {
          logger.error('Error in risk analysis:', error)
        }
      }

      // 3. PORTFOLIO OPTIMIZATION
      let portfolioAnalysis = null
      const isPortfolioQuery =
        (text.includes('portfolio') ||
          text.includes('allocat') ||
          text.includes('strategy')) &&
        !text.includes('aave') &&
        !text.includes('compound') // Don't interfere with specific protocols

      if (isPortfolioQuery) {
        try {
          const [topYields, stableYields] = await Promise.all([
            defiDataService.getTopYieldOpportunities(5, 10_000_000),
            defiDataService.getStablecoinYields(),
          ])

          const avgHighYield =
            topYields.length > 0
              ? topYields.reduce((sum, pool) => sum + (pool.apy || 0), 0) /
                topYields.length
              : 15
          const avgStableYield =
            stableYields.length > 0
              ? stableYields
                  .slice(0, 5)
                  .reduce((sum, pool) => sum + (pool.apy || 0), 0) /
                Math.min(5, stableYields.length)
              : 6

          const responseText =
            `📊 **Live Portfolio Optimization** 🎯\n\n*Based on current market data*\n\n` +
            `**Conservative** (${(avgStableYield * 0.7 + 4 * 0.25 + avgHighYield * 0.05).toFixed(1)}% APY target): 70% stables, 25% blue-chip, 5% risk\n` +
            `**Moderate** (${(avgStableYield * 0.5 + 6 * 0.3 + avgHighYield * 0.2).toFixed(1)}% APY target): 50% stables, 30% blue-chip, 20% risk\n` +
            `**Aggressive** (${(avgStableYield * 0.25 + 8 * 0.25 + avgHighYield * 0.5).toFixed(1)}% APY target): 25% stables, 25% blue-chip, 50% risk\n\n` +
            `💡 **Current Market:** Average stable yields: ${avgStableYield.toFixed(1)}% • Top opportunities: ${avgHighYield.toFixed(1)}%\n\n` +
            `🔄 **Tips:** Start conservative, rebalance when >15% drift, keep 10-15% for opportunities`

          portfolioAnalysis = {
            type: 'portfolio_optimization',
            content: responseText,
            marketData: {
              avgHighYield,
              avgStableYield,
              topYields: topYields.slice(0, 3),
              stableYields: stableYields.slice(0, 3),
            },
          }
        } catch (error) {
          logger.error('Error in portfolio analysis:', error)
        }
      }

      // 4. IMPERMANENT LOSS
      let ilAnalysis = null
      const isILQuery =
        text.includes('impermanent') ||
        text.includes('il') ||
        text.includes('liquidity') ||
        text.includes('lp') ||
        (text.includes('pool') && text.includes('loss'))

      if (isILQuery) {
        try {
          const scenarios = [
            {
              priceChange: 10,
              il: defiDataService.calculateImpermanentLoss(10),
            },
            {
              priceChange: 25,
              il: defiDataService.calculateImpermanentLoss(25),
            },
            {
              priceChange: 50,
              il: defiDataService.calculateImpermanentLoss(50),
            },
            {
              priceChange: 100,
              il: defiDataService.calculateImpermanentLoss(100),
            },
          ]

          const ilTable = scenarios
            .map(
              (s) =>
                `**±${s.priceChange}%** price change: **${s.il.toFixed(2)}%** IL`,
            )
            .join('\n')

          const responseText =
            `📉 **Impermanent Loss Calculator** 📊\n\n${ilTable}\n\n` +
            `💡 **IL Mitigation Strategies:**\n• **Correlated pairs**: ETH/stETH, USDC/USDT (minimal IL)\n• **Stablecoin pairs**: Lower volatility = lower IL\n• **Single-sided staking**: No IL risk (Aave, Compound)\n\n` +
            `⚖️ **Break-even Analysis:** LP fees + rewards must exceed IL for profitability\n\n` +
            `🎯 **Pro Tips:** Monitor price ratios regularly, set IL alerts at 1-2% levels, consider IL insurance products`

          ilAnalysis = {
            type: 'impermanent_loss',
            content: responseText,
            scenarios,
          }
        } catch (error) {
          logger.error('Error in IL analysis:', error)
        }
      }

      // Build the consolidated response
      const analysisResults = {
        yield: yieldAnalysis,
        risk: riskAnalysis,
        portfolio: portfolioAnalysis,
        impermanentLoss: ilAnalysis,
      }

      // Create the final text for REPLY to use
      let finalText = ''

      if (yieldAnalysis) {
        finalText += yieldAnalysis.content
        finalText += `\n\n📊 **Data Sources:**\n• DeFiLlama API (TVL & Protocol Data)\n• CoinGecko API (Token Prices)\n• Real-time protocol monitoring\n\n⚠️ **Risk Disclaimer:** Always DYOR. Past performance doesn't guarantee future results.`
      } else if (riskAnalysis) {
        finalText += riskAnalysis.content
      } else if (portfolioAnalysis) {
        finalText += portfolioAnalysis.content
      } else if (ilAnalysis) {
        finalText += ilAnalysis.content
      } else {
        finalText = `👋 **Hello! I'm Alioth, your DeFi yield optimization specialist.**\n\nI can help you with:\n• 🔍 **Yield Analysis** - Find the best earning opportunities\n• 🛡️ **Risk Assessment** - Evaluate protocol safety\n• 📊 **Portfolio Optimization** - Strategic allocation advice\n• 📉 **Impermanent Loss** - Calculate and mitigate IL risk\n\nTry asking: "What are the best Aave yields?" or "How should I allocate my DeFi portfolio?"`
      }

      logger.info(
        `✅ DeFi analysis completed: ${Object.keys(analysisResults)
          .filter((k) => analysisResults[k])
          .join(', ')}`,
      )

      return {
        text: finalText,
        values: {
          defiAnalysis: analysisResults,
          queryType: yieldAnalysis
            ? 'yield'
            : riskAnalysis
              ? 'risk'
              : portfolioAnalysis
                ? 'portfolio'
                : ilAnalysis
                  ? 'il'
                  : 'general',
          isDeFiQuery: true,
        },
        data: analysisResults,
      }
    } catch (error) {
      logger.error('Error in DeFi analysis provider:', error)
      return {
        text: '',
        values: {},
        data: {},
      }
    }
  },
}
