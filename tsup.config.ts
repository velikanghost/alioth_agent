import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  format: ['esm'],
  dts: true,
  splitting: false,
  bundle: true,
  platform: 'node',
  target: 'esnext',
  minify: false,
  treeshake: true,
  external: [
    // Externalize all Node.js built-ins
    'fs',
    'path',
    'https',
    'http',
    'util',
    'stream',
    'buffer',
    'crypto',
    'url',
    'querystring',
    'zlib',
    'os',
    // Externalize ElizaOS packages to avoid bundling issues
    '@elizaos/core',
    '@elizaos/plugin-sql',
    '@elizaos/plugin-bootstrap',
  ],
})
