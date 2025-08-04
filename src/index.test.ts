import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePatterns, isPatternArray, processMultiplePatterns, generateMarkdownDoc } from './index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Multiple Pattern Support', () => {
  const testDir = path.join(__dirname, '..', 'test-fixtures')

  beforeEach(async () => {
    // Create test directory structure
    await fs.mkdir(testDir, { recursive: true })
    await fs.mkdir(path.join(testDir, 'src'), { recursive: true })
    await fs.mkdir(path.join(testDir, 'docs'), { recursive: true })

    // Create test files
    await fs.writeFile(path.join(testDir, 'src', 'index.ts'), 'export default "test"')
    await fs.writeFile(path.join(testDir, 'src', 'utils.js'), 'export const utils = "multiple patterns";')
    await fs.writeFile(path.join(testDir, 'docs', 'readme.md'), '# Test')
    await fs.writeFile(path.join(testDir, 'package.json'), '{"name": "test"}')
  })

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('Pattern Normalization', () => {
    it('should handle single pattern as string', () => {
      const result = normalizePatterns('**/*.ts')
      expect(result).toEqual(['**/*.ts'])
    })

    it('should handle multiple patterns as array', () => {
      const patterns = ['**/*.ts', '**/*.js', '**/*.md']
      const result = normalizePatterns(patterns)
      expect(result).toEqual(['**/*.ts', '**/*.js', '**/*.md'])
    })

    it('should filter out empty patterns', () => {
      const patterns = ['**/*.ts', '', '   ', '**/*.js']
      const result = normalizePatterns(patterns)
      expect(result).toEqual(['**/*.ts', '**/*.js'])
    })

    it('should handle empty array', () => {
      const result = normalizePatterns([])
      expect(result).toEqual([])
    })
  })

  describe('Type Guards', () => {
    it('should identify string arrays correctly', () => {
      expect(isPatternArray(['**/*.ts'])).toBe(true)
      expect(isPatternArray('**/*.ts')).toBe(false)
      expect(isPatternArray([])).toBe(true)
    })
  })

  describe('File Processing', () => {
    it('should process single pattern correctly', async () => {
      const files = await processMultiplePatterns(
        ['src/*.ts'],
        testDir,
        [],
        'output.md'
      )
      expect(files).toContain('src/index.ts')
      expect(files).not.toContain('src/utils.js')
    })

    it('should process multiple patterns correctly', async () => {
      const files = await processMultiplePatterns(
        ['src/*.ts', 'src/*.js'],
        testDir,
        [],
        'output.md'
      )
      expect(files).toContain('src/index.ts')
      expect(files).toContain('src/utils.js')
      expect(files).not.toContain('docs/readme.md')
    })

    it('should deduplicate files from overlapping patterns', async () => {
      const files = await processMultiplePatterns(
        ['src/*', 'src/*.ts'],
        testDir,
        [],
        'output.md'
      )
      // Should contain each file only once
      const indexTsCount = files.filter(f => f === 'src/index.ts').length
      expect(indexTsCount).toBe(1)
    })

    it('should exclude specified patterns', async () => {
      const files = await processMultiplePatterns(
        ['**/*'],
        testDir,
        ['src/*.js'],
        'output.md'
      )
      expect(files).toContain('src/index.ts')
      expect(files).not.toContain('src/utils.js')
    })
  })

  describe('Command String Generation', () => {
    it('should generate correct command string for single pattern', async () => {
      const testOutput = 'test-output.md'
      await generateMarkdownDoc(
        testDir,
        '**/*.ts',
        [],
        testOutput,
        { pattern: '**/*.ts', exclude: [], output: testOutput }
      )

      const content = await fs.readFile(testOutput, 'utf-8')
      expect(content).toContain('prompt-fs-to-ai')
      expect(content).toContain('-p "**/*.ts"')
      await fs.rm(testOutput, { force: true })
    })

    it('should generate correct command string for multiple patterns', async () => {
      const testOutput = 'test-multi-output.md'
      await generateMarkdownDoc(
        testDir,
        ['**/*.ts', '**/*.js'],
        [],
        testOutput,
        { pattern: ['**/*.ts', '**/*.js'], exclude: [], output: testOutput }
      )

      const content = await fs.readFile(testOutput, 'utf-8')
      expect(content).toContain('prompt-fs-to-ai')
      expect(content).toContain('-p "**/*.ts" -p "**/*.js"')
      await fs.rm(testOutput, { force: true })
    })

    it('should skip default pattern in command string', async () => {
      const testOutput = 'test-default-output.md'
      await generateMarkdownDoc(
        testDir,
        '**/*',
        [],
        testOutput,
        { pattern: '**/*', exclude: [], output: 'output.md' }
      )

      const content = await fs.readFile(testOutput, 'utf-8')
      expect(content).toContain('prompt-fs-to-ai')
      expect(content).not.toContain('-p "**/*"')
      await fs.rm(testOutput, { force: true })
    })
  })

  describe('CLI Integration', () => {
    it('should accept single pattern via CLI', async () => {
      // Test that single pattern is properly handled
      const result = normalizePatterns('**/*.ts')
      expect(result).toEqual(['**/*.ts'])
      expect(isPatternArray(result)).toBe(true)
    })

    it('should accept multiple patterns via CLI', async () => {
      // Test that multiple patterns are properly handled
      const result = normalizePatterns(['**/*.ts', '**/*.js', '**/*.md'])
      expect(result).toEqual(['**/*.ts', '**/*.js', '**/*.md'])
      expect(result.length).toBe(3)
    })

    it('should work with mixed pattern types', async () => {
      // Test various pattern combinations
      expect(normalizePatterns('single')).toEqual(['single'])
      expect(normalizePatterns(['multiple', 'patterns'])).toEqual(['multiple', 'patterns'])
      expect(normalizePatterns([])).toEqual([])
      expect(normalizePatterns(['', 'valid', '  '])).toEqual(['valid'])
    })


  })

  describe('Full Integration Tests', () => {
    it('should generate complete markdown document with single pattern', async () => {
      const outputFile = 'integration-single.md'
      await generateMarkdownDoc(
        testDir,
        '**/*.ts',
        [],
        outputFile
      )

      const content = await fs.readFile(outputFile, 'utf-8')

      // Check document structure
      expect(content).toContain('# test-fixtures')
      expect(content).toContain('## Структура файловой системы')
      expect(content).toContain('## Список файлов')
      expect(content).toContain('## Сгенерировано командой:')
      expect(content).toContain('src/index.ts')
      expect(content).toContain('export default "test"')

      await fs.rm(outputFile, { force: true })
    })

    it('should generate complete markdown document with multiple patterns', async () => {
      const outputFile = 'integration-multiple.md'
      await generateMarkdownDoc(
        testDir,
        ['src/*.ts', 'src/*.js'],
        [],
        outputFile
      )

      const content = await fs.readFile(outputFile, 'utf-8')

      // Check that both file types are included
      expect(content).toContain('src/index.ts')
      expect(content).toContain('src/utils.js')
      expect(content).toContain('export default "test"')
      expect(content).toContain('export const utils')

      await fs.rm(outputFile, { force: true })
    })

    it('should handle exclusion patterns correctly', async () => {
      const outputFile = 'integration-exclude.md'
      await generateMarkdownDoc(
        testDir,
        '**/*',
        ['**/*.js'],
        outputFile
      )

      const content = await fs.readFile(outputFile, 'utf-8')

      // Should include TypeScript files but exclude JavaScript files
      expect(content).toContain('src/index.ts')
      expect(content).not.toContain('src/utils.js')

      await fs.rm(outputFile, { force: true })
    })
  })
})