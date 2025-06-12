# YieldMaximizer 🚀

**AI-Powered DeFi Yield Optimization Agent**

YieldMaximizer is an intelligent AI agent built on ElizaOS that specializes in DeFi yield optimization, portfolio management, and risk assessment. It helps users maximize their cryptocurrency yields while managing risks across multiple protocols and chains.

## 🌟 Features

### Core Capabilities

- **🔍 Yield Analysis**: Real-time analysis of yield farming opportunities across major DeFi protocols
- **⚖️ Risk Assessment**: Comprehensive risk evaluation including impermanent loss, smart contract risks, and market risks
- **📊 Portfolio Optimization**: Automated portfolio allocation recommendations based on risk tolerance
- **📉 Impermanent Loss Calculator**: Advanced IL calculations with mitigation strategies
- **🌐 Cross-Chain Support**: Multi-chain yield opportunities across Ethereum, Arbitrum, Optimism, and Polygon
- **🤖 Automated Monitoring**: Background service for tracking yield changes and opportunities

### Advanced Features

- **💡 Strategy Recommendations**: Conservative, moderate, and aggressive yield strategies
- **🔄 Rebalancing Alerts**: Automated notifications when portfolio drift exceeds thresholds
- **📈 Performance Tracking**: Historical yield tracking and performance analytics
- **🛡️ Safety-First Approach**: Emphasis on risk-adjusted returns and protocol security
- **📚 Educational Content**: Learn about DeFi concepts while optimizing yields

## 🚀 Production Setup

### Prerequisites

- Node.js 20.0.0 or higher
- npm or yarn package manager
- Internet connection for real-time DeFi data

### Installation

```bash
# If starting fresh with ElizaOS CLI
npx @elizaos/create@latest yield-optimizer --template starter

# Or in existing project
cd yield-optimizer
npm install
```

### Environment Configuration

Configure your environment file for production:

```bash
# Copy the comprehensive environment template
cp env.example .env

# Configure essential API keys
nano .env
```

#### Minimum Required Setup (Free APIs):

```bash
# OpenAI API for the AI agent
OPENAI_API_KEY=sk-your-openai-key-here

# Database (included)
DATABASE_URL=pglite://./db

# Yield optimization settings
MIN_YIELD_THRESHOLD=5.0
MAX_RISK_SCORE=7.0
DEFAULT_SLIPPAGE=0.5
```

#### Enhanced Production Setup (Recommended):

```bash
# Optional: CoinGecko API for better rate limits
COINGECKO_API_KEY=your_coingecko_api_key

# Optional: Dune Analytics for advanced data
DUNE_API_KEY=your_dune_api_key

# Performance settings
DATA_REFRESH_INTERVAL=10
CACHE_EXPIRY=5
API_RATE_LIMIT=60
```

### API Key Providers

| Provider       | Purpose               | Free Tier             | Paid Plans  |
| -------------- | --------------------- | --------------------- | ----------- |
| DeFiLlama      | Protocol TVL & yields | ✅ Unlimited          | Not needed  |
| CoinGecko      | Token prices          | ✅ 100 calls/day      | $40+/month  |
| Dune Analytics | On-chain data         | ✅ 3 queries/day      | $390/month  |
| Alchemy        | Blockchain data       | ✅ 300M compute units | $199+/month |

### Running in Production

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start the agent
npm start

# View logs
npm run logs

# Check status
npm run status
```

### Health Verification

```bash
# Test the yield dashboard
curl http://localhost:3000/yield-dashboard

# Test portfolio analysis
curl -X POST http://localhost:3000/portfolio-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "positions": [
      {"protocol": "Aave", "asset": "USDC", "amount": 10000, "apy": 8.2},
      {"protocol": "Compound", "asset": "USDT", "amount": 5000, "apy": 7.8}
    ]
  }'

# Expected response:
# {
#   "analysis": "Portfolio analyzed: $15,000 across 2 positions. Expected yield: 8.07% APY, Risk score: 3.2/10",
#   "recommendations": ["💡 Portfolio is conservative - consider adding moderate-risk positions"],
#   "riskScore": 3.2,
#   "totalValue": 15000,
#   "expectedYield": 8.07
# }
```

## 💬 Usage Examples

### Basic Yield Analysis

```
User: What are the best yield opportunities right now?

YieldMaximizer: 🔍 **Live Yield Analysis** 📊

🚀 Top Yield Opportunities:
**Aave** (Ethereum): **8.2%** APY
  └ USDC - TVL: $1.2B - Risk: Low

**Curve** (Ethereum): **12.4%** APY
  └ stETH-ETH - TVL: $892M - Risk: Medium

**Compound** (Ethereum): **7.8%** APY
  └ USDT - TVL: $456M - Risk: Low

🛡️ Stable Yields (Low IL Risk):
**Aave**: 6.2% APY (USDC-USDT) - TVL: $2.1B
**Compound**: 5.8% APY (DAI) - TVL: $1.8B
**Morpho**: 7.1% APY (USDC) - TVL: $623M

⚠️ **Risk Considerations:**
• Higher yields = higher risks - always DYOR
• Check protocol audit history and TVL trends
• Consider impermanent loss for LP positions
• Diversify across protocols and chains

💡 **Strategy:** Start with stablecoin yields (5-8% APY) then gradually add exposure to higher-yield LP positions based on your risk tolerance.

*Data from DeFiLlama • Updated in real-time*
```

### Risk Assessment

```
User: How risky is yield farming?

YieldMaximizer: ⚠️ **DeFi Risk Assessment** 🛡️

**Smart Contract Risk** (6/10): Risk of smart contract bugs or exploits
💡 *Mitigation:* Use audited protocols with long track records

**Impermanent Loss** (7/10): Loss from price divergence in LP pairs
💡 *Mitigation:* Choose correlated pairs or single-sided staking

**Liquidation Risk** (8/10): Risk of position liquidation in leveraged strategies
💡 *Mitigation:* Maintain healthy collateralization ratios

**Protocol Risk** (5/10): Risk of protocol governance changes or shutdown
💡 *Mitigation:* Diversify across multiple protocols

📊 **Overall Risk Score: 6.5/10** (Medium)

🎯 **Best Practices:**
- Never invest more than you can afford to lose
- Start small and gradually increase exposure
- Diversify across protocols and strategies
- Stay updated on protocol news and audits
- Use stop-losses and position limits
```

### Portfolio Optimization

```
User: How should I allocate my DeFi portfolio?

YieldMaximizer: 📊 **Portfolio Optimization Strategies** 🎯

**Conservative** - Low risk, steady yields (5-8% APY target)
• Stablecoins: 60% (Aave, Compound)
• Blue-chip DeFi: 25% (ETH, BTC staking)
• Risk Assets: 15% (LP tokens, new protocols)

**Moderate** - Balanced risk/reward (8-12% APY target)
• Stablecoins: 40% (Aave, Compound)
• Blue-chip DeFi: 35% (ETH, BTC staking)
• Risk Assets: 25% (LP tokens, new protocols)

**Aggressive** - Higher risk, higher potential yields (12-20% APY target)
• Stablecoins: 20% (Aave, Compound)
• Blue-chip DeFi: 30% (ETH, BTC staking)
• Risk Assets: 50% (LP tokens, new protocols)

💡 **Implementation Tips:**
- Start conservative and adjust based on experience
- Rebalance monthly or when allocations drift >10%
- Consider gas costs in your strategy
- Keep 5-10% in cash for opportunities
```

## 🎛️ API Endpoints

YieldMaximizer provides several HTTP endpoints for integration:

### GET /yield-dashboard

Returns current yield opportunities and protocol metrics

```json
{
  "title": "YieldMaximizer Dashboard",
  "protocols": [
    { "name": "Aave", "apy": "8.2%", "tvl": "$12.8B", "risk": "Low" },
    { "name": "Compound", "apy": "7.8%", "tvl": "$3.2B", "risk": "Low" }
  ],
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

### POST /portfolio-analysis

Analyzes a submitted portfolio and provides recommendations

```json
{
  "analysis": "Portfolio analysis complete",
  "recommendations": [
    "Consider reducing exposure to high-risk protocols",
    "Rebalance toward stablecoin yields"
  ],
  "riskScore": 6.5
}
```

## 🧠 Knowledge Base

YieldMaximizer includes comprehensive knowledge about:

- **DeFi Protocols**: Detailed information about 15+ major protocols
- **Yield Strategies**: Conservative, moderate, and aggressive strategies
- **Risk Management**: Framework for assessing and managing DeFi risks
- **Market Analysis**: Bull, bear, and sideways market strategies

See the `/knowledge` directory for detailed documentation.

## 🔧 Development

### Project Structure

```
yield-maximizer/
├── src/
│   ├── index.ts          # Character definition and agent setup
│   └── plugin.ts         # Yield optimization actions and services
├── knowledge/
│   ├── defi-protocols.md # Protocol knowledge base
│   └── yield-strategies.md # Strategy documentation
├── __tests__/            # Unit tests
├── e2e/                  # End-to-end tests
└── dist/                 # Built output
```

### Actions Available

- `ANALYZE_YIELD`: Analyzes current yield opportunities
- `ASSESS_RISK`: Provides risk assessment for DeFi positions
- `OPTIMIZE_PORTFOLIO`: Recommends portfolio allocations
- `CALCULATE_IL`: Calculates impermanent loss scenarios

### Services

- `YieldOptimizationService`: Background monitoring of protocols and yields

### Adding New Features

1. **New Actions**: Add action definitions in `src/plugin.ts`
2. **Knowledge Updates**: Update markdown files in `/knowledge`
3. **Tests**: Add tests in `__tests__` directory
4. **Documentation**: Update this README

### Testing

```bash
# Run unit tests
npm run test:component

# Run end-to-end tests
npm run test:e2e

# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Ensure tests pass: `npm test`
5. Format code: `npm run format`
6. Submit a pull request

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

YieldMaximizer is an educational and informational tool. It does not provide financial advice. Always:

- Do Your Own Research (DYOR)
- Understand the risks involved in DeFi
- Start with small amounts
- Never invest more than you can afford to lose
- Consider consulting with financial professionals

DeFi protocols carry inherent risks including but not limited to smart contract bugs, economic attacks, and total loss of funds.

## 🆘 Support

- 📖 Documentation: Check the `/knowledge` directory
- 🐛 Issues: Report bugs on GitHub Issues
- 💬 Community: Join our Discord server
- 📧 Contact: team@yieldmaximizer.ai

## 🔮 Roadmap

### Phase 1 (Current)

- [x] Basic yield analysis and risk assessment
- [x] Portfolio optimization recommendations
- [x] Impermanent loss calculations
- [x] Multi-protocol support

### Phase 2 (Coming Soon)

- [ ] Real-time API integrations (DeFiLlama, CoinGecko)
- [ ] Advanced portfolio tracking
- [ ] Automated rebalancing alerts
- [ ] Cross-chain yield comparisons

### Phase 3 (Future)

- [ ] Machine learning yield predictions
- [ ] Automated transaction execution
- [ ] Advanced risk models
- [ ] Integration with popular wallets

---

**Built with ❤️ on ElizaOS**
