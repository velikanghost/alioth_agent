import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Environment & Project Structure', () => {
  it('essential project files exist', () => {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'tsconfig.build.json',
      'tsup.config.ts',
      'vitest.config.ts',
      'README.md',
    ]
    requiredFiles.forEach((f) => {
      expect(fs.existsSync(path.join(process.cwd(), f))).toBe(true)
    })
  })

  it('src directory contains main entrypoints', () => {
    const src = path.join(process.cwd(), 'src')
    expect(fs.existsSync(src)).toBe(true)
    ;['index.ts', 'plugin.ts'].forEach((f) =>
      expect(fs.existsSync(path.join(src, f))).toBe(true),
    )
  })

  it('package.json has expected metadata', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
    )
    expect(pkg).toHaveProperty('name', 'alioth_agent')
    expect(pkg).toHaveProperty('version')
    expect(pkg).toHaveProperty('type', 'module')
    expect(pkg.dependencies).toHaveProperty('@elizaos/core')
    expect(pkg.scripts).toHaveProperty('test')
  })

  it('README headline is Alioth Agent', () => {
    const readme = fs.readFileSync(
      path.join(process.cwd(), 'README.md'),
      'utf8',
    )
    expect(readme.startsWith('# Alioth Agent')).toBe(true)
  })
})
