import { z } from 'zod'

/**
 * Configuration schema for the yield optimizer plugin
 */
export const configSchema = z.object({
  DEFILLAMA_API_KEY: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  DUNE_API_KEY: z.string().optional(),
  DEFAULT_SLIPPAGE: z.string().default('0.5'),
  MIN_YIELD_THRESHOLD: z.string().default('5.0'),
  MAX_RISK_SCORE: z.string().default('7.0'),
})

export type YieldOptimizerConfig = z.infer<typeof configSchema>

export const defaultConfig = {
  DEFILLAMA_API_KEY: process.env.DEFILLAMA_API_KEY,
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
  DUNE_API_KEY: process.env.DUNE_API_KEY,
  DEFAULT_SLIPPAGE: process.env.DEFAULT_SLIPPAGE || '0.5',
  MIN_YIELD_THRESHOLD: process.env.MIN_YIELD_THRESHOLD || '5.0',
  MAX_RISK_SCORE: process.env.MAX_RISK_SCORE || '7.0',
}
