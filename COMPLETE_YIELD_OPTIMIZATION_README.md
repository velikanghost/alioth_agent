# Complete Yield Optimization Flow

This document describes the **complete yield optimization flow** that handles the exact workflow you specified:

`{inputTokenAddress, usdAmount, riskTolerance, walletId, userAddress}` → **analysis** → **swaps** → **protocol supply allocation response**

## 🎯 What It Does

1. **Analyzes** yield opportunities for supported tokens (AAVE, LINK, ETH, WETH, WBTC)
2. **Filters** by supported protocols (AAVE, Compound-v3)
3. **Executes swaps** via Uniswap router using Privy walletId
4. **Returns** swaps executed + final protocol allocation for backend

## 🔧 Implementation Location

**Primary Action**: `src/actions/completeYieldOptimizationAction.ts`
**API Endpoint**: `POST /api/v1/complete-yield-optimization`
**Route Handler**: `src/routes/index.ts`

## 📝 API Usage

### Request Format

```bash
curl -X POST http://localhost:3000/api/v1/complete-yield-optimization \
  -H "Content-Type: application/json" \
  -d '{
    "inputTokenAddress": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "usdAmount": 1000,
    "riskTolerance": "moderate",
    "walletId": "clm7ykw0x0000mi08u4n8hn5q",
    "userAddress": "0x742d35Cc6634C0532925a3b8D5c9E4E2d63D8A5F"
  }'
```

### Request Parameters

| Parameter           | Type   | Required | Description                              |
| ------------------- | ------ | -------- | ---------------------------------------- |
| `inputTokenAddress` | string | ✅       | Token address to start with              |
| `usdAmount`         | number | ✅       | USD amount to optimize                   |
| `riskTolerance`     | string | ✅       | `conservative`, `moderate`, `aggressive` |
| `walletId`          | string | ✅       | Privy wallet ID for signing              |
| `userAddress`       | string | ✅       | User address for transaction building    |

### Response Format

```json
{
  "success": true,
  "data": {
    "swapsExecuted": [
      {
        "inputToken": "USDC",
        "outputToken": "ETH",
        "inputAmount": "400",
        "outputAmount": "0.156789",
        "protocol": "Aave",
        "expectedAPY": 5.2,
        "riskScore": 4,
        "txHash": "0xabc123...",
        "success": true,
        "gasUsed": 150000
      }
    ],
    "finalAllocation": [
      {
        "protocol": "Aave",
        "token": "USDC",
        "amount": "400",
        "percentage": 40,
        "expectedAPY": 4.1,
        "riskScore": 2,
        "chain": "ethereum"
      },
      {
        "protocol": "Aave",
        "token": "ETH",
        "amount": "0.156789",
        "percentage": 40,
        "expectedAPY": 5.2,
        "riskScore": 4,
        "chain": "ethereum"
      },
      {
        "protocol": "Compound",
        "token": "WBTC",
        "amount": "0.00512",
        "percentage": 20,
        "expectedAPY": 6.8,
        "riskScore": 5,
        "chain": "ethereum"
      }
    ],
    "totalExpectedAPY": 5.03,
    "confidence": 85,
    "reasoning": "Based on moderate risk tolerance, allocated across aave, compound-v3 protocols...",
    "marketAnalysis": {
      "timestamp": "2024-01-15T10:30:00Z",
      "totalTvl": 45000000000,
      "averageYield": 6.2,
      "topProtocols": ["aave", "compound-v3"],
      "marketCondition": "sideways"
    },
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🏗️ Architecture

### Supported Tokens

- **AAVE** (Aave Token)
- **LINK** (Chainlink)
- **ETH** (Ethereum)
- **WETH** (Wrapped Ethereum)
- **WBTC** (Wrapped Bitcoin)

### Supported Protocols

- **AAVE** (v3 lending)
- **Compound-v3** (lending)

### Risk Tolerance Strategies

#### Conservative (70% stable, 30% ETH)

```json
{
  "stablecoins": 70,
  "eth_weth": 30,
  "alts": 0
}
```

#### Moderate (40% stable, 40% ETH, 20% alts)

```json
{
  "stablecoins": 40,
  "eth_weth": 40,
  "alts": 20
}
```

#### Aggressive (20% stable, 50% ETH, 30% alts)

```json
{
  "stablecoins": 20,
  "eth_weth": 50,
  "alts": 30
}
```

## 🔄 Flow Diagram

```
Input Parameters
       ↓
Market Analysis (filter protocols + tokens)
       ↓
Calculate Optimal Allocation
       ↓
Execute Swaps (via Uniswap + Privy)
       ↓
Return Final Strategy (for backend execution)
```

## 🧪 Testing

### 1. Local Testing

```bash
# Start the agent
npm run dev

# Test API endpoint
curl -X POST http://localhost:3000/api/v1/complete-yield-optimization \
  -H "Content-Type: application/json" \
  -d @test-request.json
```

### 2. Conversational Testing

```
"Optimize my $1000 USDC with moderate risk using wallet clm7ykw0x0000mi08u4n8hn5q"
```

### 3. Sample Test Files

**test-request.json**:

```json
{
  "inputTokenAddress": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  "usdAmount": 1000,
  "riskTolerance": "moderate",
  "walletId": "clm7ykw0x0000mi08u4n8hn5q",
  "userAddress": "0x742d35Cc6634C0532925a3b8D5c9E4E2d63D8A5F"
}
```

## 🚨 Error Handling

The action handles these scenarios:

- ❌ **Unsupported tokens**: Filters to only supported tokens
- ❌ **Unsupported protocols**: Only uses AAVE/Compound-v3
- ❌ **Swap failures**: Continues with successful swaps
- ❌ **Insufficient liquidity**: Adjusts allocation amounts
- ❌ **Gas estimation failures**: Provides fallback estimates

## 🔗 Integration with Backend

The response format is designed for direct backend consumption:

1. **swapsExecuted**: List of completed swaps with transaction hashes
2. **finalAllocation**: Protocol deposits to execute with amounts and percentages
3. **totalExpectedAPY**: Portfolio-weighted expected APY
4. **confidence**: AI confidence score (70-95%)
5. **reasoning**: Human-readable explanation for decisions

## 📊 Monitoring

Key metrics to monitor:

- Swap success rate
- Average confidence scores
- Protocol allocation distribution
- Gas usage per optimization
- APY accuracy vs. actual returns

## 🛠️ Configuration

Key configuration in `src/config/uniswap.ts`:

- Supported token addresses
- Uniswap v4 contract addresses
- Default slippage tolerances
- Gas estimation parameters

## 🔐 Security Considerations

- ✅ Input validation on all parameters
- ✅ Token address whitelisting
- ✅ Protocol filtering for security
- ✅ Slippage protection
- ✅ Transaction simulation before execution
- ✅ Maximum gas limits

---

## ⚡ Quick Start

1. **Ensure services are running**:

   ```bash
   npm run dev
   ```

2. **Test the complete flow**:

   ```bash
   curl -X POST http://localhost:3000/api/v1/complete-yield-optimization \
     -H "Content-Type: application/json" \
     -d '{
       "inputTokenAddress": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
       "usdAmount": 1000,
       "riskTolerance": "moderate",
       "walletId": "clm7ykw0x0000mi08u4n8hn5q",
       "userAddress": "0x742d35Cc6634C0532925a3b8D5c9E4E2d63D8A5F"
     }'
   ```

3. **Backend integration**: Use the returned `finalAllocation` array to execute protocol deposits.

The complete flow is now **fully implemented** and ready for testing! 🚀
