import { ChainId, Token } from '@uniswap/sdk-core'
import { createPublicClient, http } from 'viem'
import { mainnet, sepolia } from 'viem/chains'

// Uniswap v3 contract addresses and configuration
export const UNISWAP_V3_CONFIG = {
  sepolia: {
    poolManager: '0x1F98431c8aD98523631AE4a59f267346ea31F984', // TODO: Update testnet addresses
    universalRouter: '0x3a9d48ab9751398bbfa63ad67599bb04e4bdf98b',
    swapRouter: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // V3 SwapRouter02
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c', //** */
    chainId: 11155111,
  },
}

// Supported token configurations
export const SUPPORTED_TOKENS = {
  sepolia: {
    ETH: new Token(
      ChainId.SEPOLIA,
      '0x0000000000000000000000000000000000000000',
      18,
      'ETH',
      'Ether',
    ),
    USDC: new Token(
      ChainId.SEPOLIA,
      '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
      6,
      'USDC',
      'USDC',
    ),
    LINK: new Token(
      ChainId.SEPOLIA,
      '0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5',
      18,
      'LINK',
      'LINK',
    ),
    WBTC: new Token(
      ChainId.SEPOLIA,
      '0x29f2D40B0605204364af54EC677bD022dA425d03',
      8,
      'WBTC',
      'Wrapped Bitcoin',
    ),
    WETH: new Token(
      ChainId.SEPOLIA,
      '0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c',
      18,
      'WETH',
      'Wrapped Ether',
    ),
  },
}

// Environment configuration
export const BLOCKCHAIN_CONFIG = {
  QUOTER_ADDRESS: UNISWAP_V3_CONFIG.sepolia.quoter,
  UNIVERSAL_ROUTER_ADDRESS: UNISWAP_V3_CONFIG.sepolia.universalRouter,
  POOL_MANAGER_ADDRESS: UNISWAP_V3_CONFIG.sepolia.poolManager,
  RPC_URL: process.env.SEPOLIA_RPC_URL,
  CHAIN_ID: parseInt(process.env.CHAIN_ID || '11155111'),
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3000',
  BACKEND_API_KEY: process.env.BACKEND_API_KEY || '',
}

// Viem client configurations
export const createViemClients = () => {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(BLOCKCHAIN_CONFIG.RPC_URL),
  })

  return { publicClient }
}

// ERC20 ABI for token operations
export const ERC20_ABI = [
  // Read-Only Functions
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',

  // Authenticated Functions
  'function transfer(address to, uint amount) returns (bool)',
  'function approve(address _spender, uint256 _value) returns (bool)',

  // Events
  'event Transfer(address indexed from, address indexed to, uint amount)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
]

// Transaction constants
export const MAX_FEE_PER_GAS = 100000000000n
export const MAX_PRIORITY_FEE_PER_GAS = 100000000000n
export const TOKEN_AMOUNT_TO_APPROVE_FOR_TRANSFER = '10000'

// Token symbol mapping helper
export const getTokenBySymbol = (
  symbol: string,
  chainId: number = 11155111,
): Token | null => {
  const network = 'sepolia'
  const tokens = SUPPORTED_TOKENS[network as keyof typeof SUPPORTED_TOKENS]
  return tokens[symbol as keyof typeof tokens] || null
}
