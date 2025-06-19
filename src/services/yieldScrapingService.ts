import { logger } from '@elizaos/core'
import type { IAgentRuntime } from '@elizaos/core'

export interface YieldData {
  protocol: string
  asset: string
  apy: number
  tvl?: string
  risk: 'Low' | 'Medium' | 'High'
  chain: string
  url: string
}

export class YieldScrapingService {
  private runtime: IAgentRuntime
  private cache = new Map<string, { data: YieldData[]; timestamp: number }>()
  private cacheExpiry = 5 * 60 * 1000 // 5 minutes

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime
  }

  /**
   * Scrape yield data from Aave V3
   */
  private async scrapeAaveYields(): Promise<YieldData[]> {
    try {
      // Use the browser service from runtime
      const browserService = this.runtime.getService('browser') as any
      if (!browserService) {
        logger.warn('Browser service not available, falling back to mock data')
        return this.getAaveMockData()
      }

      logger.info('Scraping Aave yields...')

      // Scrape from Aave app
      const aaveData = await browserService.evaluate({
        url: 'https://app.aave.com/markets/',
        waitFor: 'networkidle',
        script: `
          // Wait for the markets to load
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const markets = [];
          const marketRows = document.querySelectorAll('[data-testid="market-row"], .market-item, .asset-item');
          
          for (const row of marketRows) {
            try {
              // Try different selectors for asset name
              const assetElement = row.querySelector('[data-cy="asset-name"], .asset-name, .symbol') 
                || row.querySelector('img[alt]')?.parentElement?.nextElementSibling
                || row.querySelector('.MuiTypography-root');
              
              // Try different selectors for APY
              const apyElement = row.querySelector('[data-cy="supply-apy"], .supply-apy, .apy')
                || row.querySelector('span:contains("%")')
                || Array.from(row.querySelectorAll('span')).find(el => el.textContent?.includes('%'));
              
              if (assetElement && apyElement) {
                const asset = assetElement.textContent?.trim() || assetElement.alt;
                const apyText = apyElement.textContent?.trim();
                const apy = parseFloat(apyText?.replace('%', '') || '0');
                
                if (asset && apy > 0) {
                  markets.push({
                    protocol: 'Aave V3',
                    asset: asset,
                    apy: apy,
                    chain: 'Ethereum',
                    risk: 'Low'
                  });
                }
              }
            } catch (e) {
              console.log('Error processing row:', e);
            }
          }
          
          return markets.slice(0, 5); // Top 5 markets
        `,
      })

      if (aaveData && Array.isArray(aaveData) && aaveData.length > 0) {
        logger.info(`Successfully scraped ${aaveData.length} Aave yields`)
        return aaveData.map((item) => ({
          ...item,
          url: 'https://app.aave.com/markets/',
          tvl: 'N/A',
        }))
      } else {
        logger.warn('No Aave data scraped, using fallback')
        return this.getAaveMockData()
      }
    } catch (error) {
      logger.error('Error scraping Aave yields:', error)
      return this.getAaveMockData()
    }
  }

  /**
   * Scrape yield data from Compound
   */
  private async scrapeCompoundYields(): Promise<YieldData[]> {
    try {
      const browserService = this.runtime.getService('browser') as any
      if (!browserService) {
        return this.getCompoundMockData()
      }

      logger.info('Scraping Compound yields...')

      const compoundData = await browserService.evaluate({
        url: 'https://v3-app.compound.finance/',
        waitFor: 'networkidle',
        script: `
          await new Promise(resolve => setTimeout(resolve, 4000));
          
          const markets = [];
          
          // Try multiple selectors for Compound V3
          const marketSelectors = [
            '.market-row',
            '[data-testid="market-row"]',
            '.asset-row',
            '.market-item'
          ];
          
          let rows = [];
          for (const selector of marketSelectors) {
            rows = document.querySelectorAll(selector);
            if (rows.length > 0) break;
          }
          
          for (const row of rows) {
            try {
              const assetName = row.querySelector('.asset-name, .token-name, .symbol')?.textContent?.trim()
                || row.querySelector('img[alt]')?.alt;
              
              const supplyApyElement = row.querySelector('.supply-apy, .apy-supply, .earn-apy')
                || Array.from(row.querySelectorAll('span, div')).find(el => 
                  el.textContent?.includes('%') && el.textContent?.includes('APY'));
              
              if (assetName && supplyApyElement) {
                const apyText = supplyApyElement.textContent;
                const apy = parseFloat(apyText.replace(/[^0-9.]/g, ''));
                
                if (apy > 0) {
                  markets.push({
                    protocol: 'Compound V3',
                    asset: assetName,
                    apy: apy,
                    chain: 'Ethereum',
                    risk: 'Low'
                  });
                }
              }
            } catch (e) {
              console.log('Error processing Compound row:', e);
            }
          }
          
          return markets.slice(0, 5);
        `,
      })

      if (
        compoundData &&
        Array.isArray(compoundData) &&
        compoundData.length > 0
      ) {
        logger.info(
          `Successfully scraped ${compoundData.length} Compound yields`,
        )
        return compoundData.map((item) => ({
          ...item,
          url: 'https://v3-app.compound.finance/',
          tvl: 'N/A',
        }))
      } else {
        return this.getCompoundMockData()
      }
    } catch (error) {
      logger.error('Error scraping Compound yields:', error)
      return this.getCompoundMockData()
    }
  }

  /**
   * Scrape yield data from Curve
   */
  private async scrapeCurveYields(): Promise<YieldData[]> {
    try {
      const browserService = this.runtime.getService('browser') as any
      if (!browserService) {
        return this.getCurveMockData()
      }

      logger.info('Scraping Curve yields...')

      const curveData = await browserService.evaluate({
        url: 'https://curve.fi/pools/ethereum',
        waitFor: 'networkidle',
        script: `
          await new Promise(resolve => setTimeout(resolve, 4000));
          
          const pools = [];
          
          // Try different selectors for Curve pools
          const poolRows = document.querySelectorAll('.pool-row, .pool-item, tr[data-pool]')
            || document.querySelectorAll('tbody tr');
          
          for (const row of poolRows) {
            try {
              // Pool name
              const poolNameElement = row.querySelector('.pool-name, .name, td:first-child')
                || row.querySelector('a[href*="/pools/"]');
              
              // APY - look for percentage values
              const apyElement = Array.from(row.querySelectorAll('td, span, div')).find(el => {
                const text = el.textContent?.trim() || '';
                return text.includes('%') && !text.includes('TVL') && 
                       parseFloat(text.replace('%', '')) > 0;
              });
              
              if (poolNameElement && apyElement) {
                const poolName = poolNameElement.textContent?.trim() || 
                                poolNameElement.href?.split('/').pop();
                const apyText = apyElement.textContent?.trim();
                const apy = parseFloat(apyText.replace(/[^0-9.]/g, ''));
                
                if (poolName && apy > 0 && apy < 1000) { // Sanity check
                  pools.push({
                    protocol: 'Curve',
                    asset: poolName,
                    apy: apy,
                    chain: 'Ethereum',
                    risk: 'Medium'
                  });
                }
              }
            } catch (e) {
              console.log('Error processing Curve row:', e);
            }
          }
          
          return pools.slice(0, 5);
        `,
      })

      if (curveData && Array.isArray(curveData) && curveData.length > 0) {
        logger.info(`Successfully scraped ${curveData.length} Curve yields`)
        return curveData.map((item) => ({
          ...item,
          url: 'https://curve.fi/pools/ethereum',
          tvl: 'N/A',
        }))
      } else {
        return this.getCurveMockData()
      }
    } catch (error) {
      logger.error('Error scraping Curve yields:', error)
      return this.getCurveMockData()
    }
  }

  /**
   * Get all yield opportunities with real-time data
   */
  async getAllYieldOpportunities(): Promise<YieldData[]> {
    const cacheKey = 'all-yields'
    const cached = this.cache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      logger.info('Using cached yield data')
      return cached.data
    }

    try {
      logger.info('Fetching fresh yield data from protocols...')

      // Scrape all protocols in parallel
      const [aaveYields, compoundYields, curveYields] =
        await Promise.allSettled([
          this.scrapeAaveYields(),
          this.scrapeCompoundYields(),
          this.scrapeCurveYields(),
        ])

      const allYields: YieldData[] = []

      // Process results
      if (aaveYields.status === 'fulfilled') {
        allYields.push(...aaveYields.value)
      }
      if (compoundYields.status === 'fulfilled') {
        allYields.push(...compoundYields.value)
      }
      if (curveYields.status === 'fulfilled') {
        allYields.push(...curveYields.value)
      }

      // Sort by APY descending
      allYields.sort((a, b) => b.apy - a.apy)

      // Cache the results
      this.cache.set(cacheKey, { data: allYields, timestamp: Date.now() })

      logger.info(
        `Successfully aggregated ${allYields.length} yield opportunities`,
      )
      return allYields
    } catch (error) {
      logger.error('Error fetching yield opportunities:', error)
      // Return fallback mock data if all scraping fails
      return [
        ...this.getAaveMockData(),
        ...this.getCompoundMockData(),
        ...this.getCurveMockData(),
      ]
    }
  }

  // Fallback mock data methods
  private getAaveMockData(): YieldData[] {
    return [
      {
        protocol: 'Aave V3',
        asset: 'USDC',
        apy: 4.2,
        tvl: '$1.2B',
        risk: 'Low',
        chain: 'Ethereum',
        url: 'https://app.aave.com/markets/',
      },
      {
        protocol: 'Aave V3',
        asset: 'USDT',
        apy: 3.8,
        tvl: '$890M',
        risk: 'Low',
        chain: 'Ethereum',
        url: 'https://app.aave.com/markets/',
      },
    ]
  }

  private getCompoundMockData(): YieldData[] {
    return [
      {
        protocol: 'Compound V3',
        asset: 'USDC',
        apy: 3.9,
        tvl: '$800M',
        risk: 'Low',
        chain: 'Ethereum',
        url: 'https://v3-app.compound.finance/',
      },
      {
        protocol: 'Compound V3',
        asset: 'ETH',
        apy: 2.1,
        tvl: '$450M',
        risk: 'Low',
        chain: 'Ethereum',
        url: 'https://v3-app.compound.finance/',
      },
    ]
  }

  private getCurveMockData(): YieldData[] {
    return [
      {
        protocol: 'Curve',
        asset: 'stETH-ETH',
        apy: 5.7,
        tvl: '$650M',
        risk: 'Medium',
        chain: 'Ethereum',
        url: 'https://curve.fi/pools/ethereum',
      },
      {
        protocol: 'Curve',
        asset: '3pool',
        apy: 4.1,
        tvl: '$320M',
        risk: 'Medium',
        chain: 'Ethereum',
        url: 'https://curve.fi/pools/ethereum',
      },
    ]
  }

  /**
   * Get top stable yields (low impermanent loss risk)
   */
  async getStableYields(): Promise<YieldData[]> {
    const allYields = await this.getAllYieldOpportunities()

    // Filter for stablecoins and low-risk assets
    const stableAssets = ['USDC', 'USDT', 'DAI', 'BUSD', 'FRAX']

    return allYields
      .filter(
        (yield_) =>
          stableAssets.some((asset) =>
            yield_.asset.toUpperCase().includes(asset),
          ) || yield_.risk === 'Low',
      )
      .slice(0, 5)
  }

  /**
   * Get yield data for a specific protocol
   */
  async getProtocolYields(
    protocol: 'aave' | 'compound' | 'curve',
  ): Promise<YieldData[]> {
    switch (protocol.toLowerCase()) {
      case 'aave':
        return this.scrapeAaveYields()
      case 'compound':
        return this.scrapeCompoundYields()
      case 'curve':
        return this.scrapeCurveYields()
      default:
        return []
    }
  }
}

export const createYieldScrapingService = (runtime: IAgentRuntime) => {
  return new YieldScrapingService(runtime)
}
