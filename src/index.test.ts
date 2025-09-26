import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePatterns, isPatternArray, processMultiplePatterns, generateMarkdownDoc, parseMarkdownForFiles, reverseMarkdownToFiles, parsePromptFsToAiFile, createPromptFsToAiFile, createDiff } from './index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Multiple Pattern Support', () => {
  const testDir = path.join(__dirname, '..', 'tests', 'test-fixtures')

  beforeAll(async () => {
    // Create tests directory
    await fs.mkdir(path.join(__dirname, '..', 'tests'), { recursive: true })
  })

  beforeEach(async () => {
    // Clean up any leftover test files from previous runs
    const allFiles = await fs.readdir('.').catch(() => [])

    for (const file of allFiles) {
      // Never delete important project files and directories
      if (file === 'README.md' || file === 'package.json' || file === 'bun.lock' ||
        file === 'biome.json' || file === 'tsconfig.json' || file === 'vitest.config.ts' ||
        file === '.git' || file === '.gitignore' || file.startsWith('.git') ||
        file === 'node_modules' || file === 'dist' || file === 'src' ||
        file === 'bin' || file === 'types' || file === 'memory-bank' ||
        file === '.specstory' || file === '.vscode' || file === 'tests') {
        continue
      }

      // Only delete test-generated files with specific patterns
      if (file.startsWith('test-') || file.startsWith('integration-') ||
        file.startsWith('config-') || file.endsWith('.diff') ||
        file.endsWith('.current') || file.match(/.*\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.diff$/) ||
        (file.endsWith('.md') && file.match(/^(test-|integration-|config-|final-|create-|existing-|patch-|new-|sequential-|resume-|multi-|diff-)/))) {
        await fs.rm(file, { recursive: true, force: true }).catch(() => { })
      }
    }

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
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => { })

    // Clean up any generated test files
    const allFiles = await fs.readdir('.').catch(() => [])
    for (const file of allFiles) {
      // Never delete important project files and directories
      if (file === 'README.md' || file === 'package.json' || file === 'bun.lock' ||
        file === 'biome.json' || file === 'tsconfig.json' || file === 'vitest.config.ts' ||
        file === '.git' || file === '.gitignore' || file.startsWith('.git') ||
        file === 'node_modules' || file === 'dist' || file === 'src' ||
        file === 'bin' || file === 'types' || file === 'memory-bank' ||
        file === '.specstory' || file === '.vscode' || file === 'tests') {
        continue
      }
      // Only delete test-generated files with specific patterns
      if (file.startsWith('test-') || file.startsWith('integration-') ||
        file.startsWith('config-') || file.endsWith('.diff') ||
        file.endsWith('.current') || file.match(/.*\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.diff$/) ||
        (file.endsWith('.md') && file.match(/^(test-|integration-|config-|final-|create-|existing-|patch-|new-|sequential-|resume-|multi-|diff-)/))) {
        await fs.rm(file, { recursive: true, force: true }).catch(() => { })
      }
    }
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

    it('should not include -o when output is undefined', async () => {
      const testOutput = 'test-undefined-output.md'
      await generateMarkdownDoc(
        testDir,
        '**/*.ts',
        [],
        testOutput,
        { pattern: '**/*.ts', exclude: [], output: undefined as any }
      )

      const content = await fs.readFile(testOutput, 'utf-8')
      expect(content).toContain('prompt-fs-to-ai')
      expect(content).toContain('-p "**/*.ts"')
      expect(content).not.toContain('-o "undefined"')
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
      const outputFile = path.join(__dirname, '..', 'tests', 'integration-single.md')
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
      const outputFile = path.join(__dirname, '..', 'tests', 'integration-multiple.md')
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
      const outputFile = path.join(__dirname, '..', 'tests', 'integration-exclude.md')
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

  describe('.prompt-fs-to-ai File Parsing', () => {
    const testConfigDir = path.join(__dirname, '..', 'tests', 'test-config-fixtures')

    beforeEach(async () => {
      await fs.mkdir(testConfigDir, { recursive: true })
    })

    afterEach(async () => {
      // Clean up test directory
      await fs.rm(testConfigDir, { recursive: true, force: true }).catch(() => { })

      // Clean up any generated test files in root directory
      const allFiles = await fs.readdir('.').catch(() => [])
      for (const file of allFiles) {
        // Never delete important project files and directories
        if (file === 'README.md' || file === 'package.json' || file === 'bun.lock' ||
          file === 'biome.json' || file === 'tsconfig.json' || file === 'vitest.config.ts' ||
          file === '.git' || file === '.gitignore' || file.startsWith('.git') ||
          file === 'node_modules' || file === 'dist' || file === 'src' ||
          file === 'bin' || file === 'types' || file === 'memory-bank' ||
          file === '.specstory' || file === '.vscode' || file === 'tests') {
          continue
        }
        // Only delete test-generated files with specific patterns
        if (file.startsWith('test-') || file.startsWith('integration-') ||
          file.startsWith('config-') || file.endsWith('.diff') ||
          file.endsWith('.current') || file.match(/.*\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.diff$/) ||
          (file.endsWith('.md') && file.match(/^(test-|integration-|config-|final-|create-|existing-|patch-|new-|sequential-|resume-|multi-|diff-)/))) {
          await fs.rm(file, { recursive: true, force: true }).catch(() => { })
        }
      }
    })

    describe('parsePromptFsToAiFile', () => {
      it('should parse include patterns with + prefix', async () => {
        const configContent = `# Include TypeScript files
+**/*.ts
+**/*.tsx

# Include JavaScript files
+**/*.js
`
        await fs.writeFile(path.join(testConfigDir, '.prompt-fs-to-ai'), configContent)

        const result = await parsePromptFsToAiFile(testConfigDir, __dirname)

        expect(result.include).toEqual(['**/*.ts', '**/*.tsx', '**/*.js'])
        expect(result.exclude).toEqual([])
      })

      it('should parse exclude patterns without prefix', async () => {
        const configContent = `# Exclude directories
node_modules/
dist/
build/

# Exclude files
**/*.log
**/*.tmp
`
        await fs.writeFile(path.join(testConfigDir, '.prompt-fs-to-ai'), configContent)

        const result = await parsePromptFsToAiFile(testConfigDir, __dirname)

        expect(result.include).toEqual([])
        expect(result.exclude).toEqual(['node_modules/', 'dist/', 'build/', '**/*.log', '**/*.tmp'])
      })

      it('should handle mixed include and exclude patterns', async () => {
        const configContent = `# Include source files
+src/**/*.ts
+src/**/*.js

# Exclude test files
test/
**/*.test.ts
`
        await fs.writeFile(path.join(testConfigDir, '.prompt-fs-to-ai'), configContent)

        const result = await parsePromptFsToAiFile(testConfigDir, __dirname)

        expect(result.include).toEqual(['src/**/*.ts', 'src/**/*.js'])
        expect(result.exclude).toEqual(['test/', '**/*.test.ts'])
      })

      it('should handle comments and empty lines', async () => {
        const configContent = `# This is a comment

+**/*.ts

# Another comment

**/*.log


+**/*.js
`
        await fs.writeFile(path.join(testConfigDir, '.prompt-fs-to-ai'), configContent)

        const result = await parsePromptFsToAiFile(testConfigDir, __dirname)

        expect(result.include).toEqual(['**/*.ts', '**/*.js'])
        expect(result.exclude).toEqual(['**/*.log'])
      })

      it('should handle exclude patterns with - prefix', async () => {
        const configContent = `-node_modules/
-**/*.log
+**/*.ts
`
        await fs.writeFile(path.join(testConfigDir, '.prompt-fs-to-ai'), configContent)

        const result = await parsePromptFsToAiFile(testConfigDir, __dirname)

        expect(result.include).toEqual(['**/*.ts'])
        expect(result.exclude).toEqual(['node_modules/', '**/*.log'])
      })

      it('should return empty arrays when file does not exist', async () => {
        const result = await parsePromptFsToAiFile(testConfigDir, __dirname)

        expect(result.include).toEqual([])
        expect(result.exclude).toEqual([])
      })

      it('should trim whitespace from patterns', async () => {
        const configContent = `  +**/*.ts
+  **/*.js

  node_modules/
`
        await fs.writeFile(path.join(testConfigDir, '.prompt-fs-to-ai'), configContent)

        const result = await parsePromptFsToAiFile(testConfigDir, __dirname)

        expect(result.include).toEqual(['**/*.ts', '**/*.js'])
        expect(result.exclude).toEqual(['node_modules/'])
      })

      it('should prioritize config file in target directory over current directory', async () => {
        // Create config in current directory (fallback)
        const cwdConfigContent = `+*.md
docs/
`
        await fs.writeFile(path.join(__dirname, '.prompt-fs-to-ai'), cwdConfigContent)

        // Create different config in target directory
        const targetConfigContent = `+*.ts
+*.js
src/
`
        await fs.writeFile(path.join(testConfigDir, '.prompt-fs-to-ai'), targetConfigContent)

        const result = await parsePromptFsToAiFile(testConfigDir, __dirname)

        // Should use target directory config, not current directory config
        expect(result.include).toEqual(['*.ts', '*.js'])
        expect(result.exclude).toEqual(['src/'])
        expect(result.configFilePath).toBe(path.join(testConfigDir, '.prompt-fs-to-ai'))

        // Clean up
        await fs.rm(path.join(__dirname, '.prompt-fs-to-ai'), { force: true })
      })

      it('should use current directory config when target directory has no config', async () => {
        // Create config in current directory only
        const cwdConfigContent = `+*.md
docs/
`
        await fs.writeFile(path.join(__dirname, '.prompt-fs-to-ai'), cwdConfigContent)

        const result = await parsePromptFsToAiFile(testConfigDir, __dirname)

        // Should use current directory config
        expect(result.include).toEqual(['*.md'])
        expect(result.exclude).toEqual(['docs/'])
        expect(result.configFilePath).toBe(path.join(__dirname, '.prompt-fs-to-ai'))

        // Clean up
        await fs.rm(path.join(__dirname, '.prompt-fs-to-ai'), { force: true })
      })

      it('should return empty patterns when no config file exists', async () => {
        const result = await parsePromptFsToAiFile(testConfigDir, __dirname)

        expect(result.include).toEqual([])
        expect(result.exclude).toEqual([])
        expect(result.configFilePath).toBeUndefined()
      })
    })

    describe('createPromptFsToAiFile', () => {
      it('should create config file with include and exclude patterns', async () => {
        const includePatterns = ['**/*.ts', '**/*.js']
        const excludePatterns = ['node_modules/', 'dist/']

        await createPromptFsToAiFile(testConfigDir, includePatterns, excludePatterns)

        const configFile = path.join(testConfigDir, '.prompt-fs-to-ai')
        const content = await fs.readFile(configFile, 'utf-8')

        expect(content).toContain('# Auto-generated .prompt-fs-to-ai file')
        expect(content).toContain('# Include patterns')
        expect(content).toContain('+**/*.ts')
        expect(content).toContain('+**/*.js')
        expect(content).toContain('# Exclude patterns')
        expect(content).toContain('node_modules/')
        expect(content).toContain('dist/')

        // Verify the file can be parsed correctly
        const result = await parsePromptFsToAiFile(testConfigDir, __dirname)
        expect(result.include).toEqual(includePatterns)
        expect(result.exclude).toEqual(excludePatterns)
      })

      it('should create config file with only include patterns', async () => {
        const includePatterns = ['src/**/*.ts']
        const excludePatterns: string[] = []

        await createPromptFsToAiFile(testConfigDir, includePatterns, excludePatterns)

        const configFile = path.join(testConfigDir, '.prompt-fs-to-ai')
        const content = await fs.readFile(configFile, 'utf-8')

        expect(content).toContain('+src/**/*.ts')
        expect(content).not.toContain('# Exclude patterns')
      })

      it('should create config file with only exclude patterns', async () => {
        const includePatterns: string[] = []
        const excludePatterns = ['temp/', 'cache/']

        await createPromptFsToAiFile(testConfigDir, includePatterns, excludePatterns)

        const configFile = path.join(testConfigDir, '.prompt-fs-to-ai')
        const content = await fs.readFile(configFile, 'utf-8')

        expect(content).toContain('# Exclude patterns')
        expect(content).toContain('temp/')
        expect(content).toContain('cache/')
        expect(content).not.toContain('# Include patterns')
      })
    })

    describe('Integration with generateMarkdownDoc', () => {
      it('should use include patterns from .prompt-fs-to-ai file', async () => {
        // Create test files
        await fs.mkdir(path.join(testConfigDir, 'src'), { recursive: true })
        await fs.mkdir(path.join(testConfigDir, 'docs'), { recursive: true })

        await fs.writeFile(path.join(testConfigDir, 'src', 'app.ts'), 'console.log("app")')
        await fs.writeFile(path.join(testConfigDir, 'src', 'utils.js'), 'export const utils = "test"')
        await fs.writeFile(path.join(testConfigDir, 'docs', 'readme.md'), '# Test')

        // Create .prompt-fs-to-ai file
        const configContent = `+src/**/*.ts
+docs/**/*.md
**/utils.js
`
        await fs.writeFile(path.join(testConfigDir, '.prompt-fs-to-ai'), configContent)

        const outputFile = path.join(__dirname, '..', 'tests', 'config-integration.md')
        await generateMarkdownDoc(testConfigDir, undefined, [], outputFile)

        const content = await fs.readFile(outputFile, 'utf-8')

        // Should include TypeScript and Markdown files
        expect(content).toContain('src/app.ts')
        expect(content).toContain('console.log("app")')
        expect(content).toContain('docs/readme.md')
        expect(content).toContain('# Test')

        // Should exclude JavaScript file due to exclude pattern
        expect(content).not.toContain('src/utils.js')
        expect(content).not.toContain('export const utils')

        await fs.rm(outputFile, { force: true })
      })

      it('should use config file patterns when no CLI patterns provided', async () => {
        // Create test files
        await fs.mkdir(path.join(testConfigDir, 'src'), { recursive: true })
        await fs.mkdir(path.join(testConfigDir, 'lib'), { recursive: true })

        await fs.writeFile(path.join(testConfigDir, 'src', 'main.ts'), 'console.log("main")')
        await fs.writeFile(path.join(testConfigDir, 'lib', 'helper.js'), 'export const helper = "test"')

        // Create .prompt-fs-to-ai file with includes
        const configContent = `+src/**/*.ts
`
        await fs.writeFile(path.join(testConfigDir, '.prompt-fs-to-ai'), configContent)

        // Don't specify CLI patterns (use default)
        const outputFile = path.join(__dirname, '..', 'tests', 'config-only.md')
        await generateMarkdownDoc(testConfigDir, undefined, [], outputFile)

        const content = await fs.readFile(outputFile, 'utf-8')

        // Should include only config patterns (TypeScript files)
        expect(content).toContain('src/main.ts')
        expect(content).toContain('console.log("main")')
        expect(content).not.toContain('lib/helper.js')
        expect(content).not.toContain('export const helper')

        await fs.rm(outputFile, { force: true })
      })

      it('should prioritize CLI patterns over config includes when CLI patterns are provided', async () => {
        // Create test files
        await fs.mkdir(path.join(testConfigDir, 'src'), { recursive: true })
        await fs.mkdir(path.join(testConfigDir, 'test'), { recursive: true })

        await fs.writeFile(path.join(testConfigDir, 'src', 'app.ts'), 'console.log("app")')
        await fs.writeFile(path.join(testConfigDir, 'test', 'spec.ts'), 'describe("test", () => {})')

        // Create .prompt-fs-to-ai file
        const configContent = `+src/**/*.ts
+test/**/*.ts
`
        await fs.writeFile(path.join(testConfigDir, '.prompt-fs-to-ai'), configContent)

        // CLI specifies only src files
        const outputFile = path.join(__dirname, '..', 'tests', 'config-priority.md')
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts'], [], outputFile)

        const content = await fs.readFile(outputFile, 'utf-8')

        // Should include only src files as specified by CLI
        expect(content).toContain('src/app.ts')
        expect(content).toContain('console.log("app")')
        expect(content).not.toContain('test/spec.ts')
        expect(content).not.toContain('describe("test"')

        await fs.rm(outputFile, { force: true })
      })

      it('should include config file patterns in generated command when no CLI patterns provided', async () => {
        // Create test files
        await fs.mkdir(path.join(testConfigDir, 'src'), { recursive: true })
        await fs.mkdir(path.join(testConfigDir, 'docs'), { recursive: true })

        await fs.writeFile(path.join(testConfigDir, 'src', 'app.ts'), 'console.log("app")')
        await fs.writeFile(path.join(testConfigDir, 'docs', 'readme.md'), '# Test')

        // Create .prompt-fs-to-ai file
        const configContent = `+src/**/*.ts
+docs/**/*.md
node_modules/
`
        await fs.writeFile(path.join(testConfigDir, '.prompt-fs-to-ai'), configContent)

        const outputFile = path.join(__dirname, '..', 'tests', 'config-command.md')
        await generateMarkdownDoc(testConfigDir, undefined, [], outputFile)

        const content = await fs.readFile(outputFile, 'utf-8')

        // Should contain the command with patterns from config file
        expect(content).toContain('prompt-fs-to-ai')
        expect(content).toContain('-p "src/**/*.ts"')
        expect(content).toContain('-p "docs/**/*.md"')
        expect(content).toContain('-e "node_modules/"')

        await fs.rm(outputFile, { force: true })
      })

      it('should include all final patterns in command even when config file is deleted', async () => {
        // Create test files
        await fs.mkdir(path.join(testConfigDir, 'src'), { recursive: true })

        await fs.writeFile(path.join(testConfigDir, 'src', 'app.ts'), 'console.log("app")')

        // Create .prompt-fs-to-ai file
        const configContent = `+src/**/*.ts
temp/
`
        await fs.writeFile(path.join(testConfigDir, '.prompt-fs-to-ai'), configContent)

        // Generate doc with config patterns
        const outputFile = path.join(__dirname, '..', 'tests', 'final-command.md')
        await generateMarkdownDoc(testConfigDir, undefined, ['logs/'], outputFile)

        // Delete config file
        await fs.rm(path.join(testConfigDir, '.prompt-fs-to-ai'), { force: true })

        const content = await fs.readFile(outputFile, 'utf-8')

        // Command should still contain all patterns that were used
        expect(content).toContain('prompt-fs-to-ai')
        expect(content).toContain('-p "src/**/*.ts"')
        expect(content).toContain('-e "logs/"')
        expect(content).toContain('"temp/"')

        await fs.rm(outputFile, { force: true })
      })

      it('should create .prompt-fs-to-ai file in target directory when no config exists', async () => {
        // Create test files
        await fs.mkdir(path.join(testConfigDir, 'src'), { recursive: true })

        await fs.writeFile(path.join(testConfigDir, 'src', 'app.ts'), 'console.log("app")')

        // Ensure no config file exists in target directory
        const targetConfigFile = path.join(testConfigDir, '.prompt-fs-to-ai')
        try {
          await fs.rm(targetConfigFile, { force: true })
        } catch (error) {
          // File doesn't exist, that's fine
        }

        // Also ensure no config file exists in current directory for this test
        const cwdConfigFile = path.join(__dirname, '..', '.prompt-fs-to-ai')
        const cwdConfigBackup = path.join(__dirname, '..', '.prompt-fs-to-ai.backup')
        let cwdConfigExisted = false
        try {
          await fs.access(cwdConfigFile)
          cwdConfigExisted = true
          await fs.rename(cwdConfigFile, cwdConfigBackup)
        } catch (error) {
          // File doesn't exist, that's fine
        }

        const outputFile = path.join(__dirname, '..', 'tests', 'create-config.md')
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts'], ['node_modules/'], outputFile)

        // Check that config file was created in target directory
        const configExists = await fs.stat(targetConfigFile).then(() => true).catch(() => false)
        expect(configExists).toBe(true)

        // Check config file content
        const configContent = await fs.readFile(targetConfigFile, 'utf-8')
        expect(configContent).toContain('# Auto-generated .prompt-fs-to-ai file')
        expect(configContent).toContain('+src/**/*.ts')
        expect(configContent).toContain('node_modules/')

        // Restore original cwd config file if it existed
        if (cwdConfigExisted) {
          await fs.rename(cwdConfigBackup, cwdConfigFile)
        }

        await fs.rm(outputFile, { force: true })
        await fs.rm(targetConfigFile, { force: true })
      })

      it('should update config file when one already exists in target directory', async () => {
        // Create existing config file
        const existingConfig = `+existing/*.ts
existing/
`
        await fs.writeFile(path.join(testConfigDir, '.prompt-fs-to-ai'), existingConfig)

        // Create test files
        await fs.mkdir(path.join(testConfigDir, 'src'), { recursive: true })
        await fs.writeFile(path.join(testConfigDir, 'src', 'app.ts'), 'console.log("app")')

        const outputFile = path.join(__dirname, '..', 'tests', 'existing-config.md')
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts'], [], outputFile)

        // Check that existing config was updated with new patterns
        const configContent = await fs.readFile(path.join(testConfigDir, '.prompt-fs-to-ai'), 'utf-8')
        expect(configContent).toContain('# Auto-generated .prompt-fs-to-ai file')
        expect(configContent).toContain('+src/**/*.ts')
        expect(configContent).not.toContain('existing/*.ts')

        await fs.rm(outputFile, { force: true })
        await fs.rm(path.join(testConfigDir, '.prompt-fs-to-ai'), { force: true })
      })

      it('should create diff file when --patch option is used and output file exists', async () => {
        // Create test files
        await fs.mkdir(path.join(testConfigDir, 'src'), { recursive: true })
        await fs.writeFile(path.join(testConfigDir, 'src', 'app.ts'), 'console.log("app")')

        const outputFile = path.join(__dirname, '..', 'tests', 'patch-test.md')

        // Create initial file (this will create the .current file)
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts'], [], outputFile, { pattern: ['src/**/*.ts'], exclude: [], output: outputFile, patch: true })

        // Add new file
        await fs.writeFile(path.join(testConfigDir, 'src', 'utils.js'), 'export const utils = "test"')

        // Generate patch (this should create a timestamped diff file)
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts', 'src/**/*.js'], [], outputFile, { pattern: ['src/**/*.ts', 'src/**/*.js'], exclude: [], output: outputFile, patch: true })

        // Check that diff file with timestamp was created in tests directory
        const testsDir = path.dirname(outputFile)
        const patchFiles = await fs.readdir(testsDir)
        const patchFile = patchFiles.find(file => file.startsWith(path.basename(outputFile) + '.') && file.endsWith('.diff'))
        expect(patchFile).toBeDefined()

        // Check patch content contains diff information
        const patchContent = await fs.readFile(path.join(testsDir, patchFile!), 'utf-8')
        expect(patchContent).toContain('Index: patch-test.md')
        // The patch should show changes from previous state to current state
        expect(patchContent).toContain('@@')

        // Check that current state file exists
        const currentFileExists = await fs.stat(`${outputFile}.current`).then(() => true).catch(() => false)
        expect(currentFileExists).toBe(true)

        // Check that original file doesn't exist (not touched in patch mode)
        const originalExists = await fs.stat(outputFile).then(() => true).catch(() => false)
        expect(originalExists).toBe(false)

        await fs.rm(outputFile, { force: true })
        await fs.rm(`${outputFile}.current`, { force: true })
        await fs.rm(patchFile!, { force: true })
      })

      it('should create normal file when --patch option is used but output file does not exist', async () => {
        // Create test files
        await fs.mkdir(path.join(testConfigDir, 'src'), { recursive: true })
        await fs.writeFile(path.join(testConfigDir, 'src', 'app.ts'), 'console.log("app")')

        const outputFile = path.join(__dirname, '..', 'tests', 'new-patch-test.md')

        // Generate with patch option but file doesn't exist yet
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts'], [], outputFile, { pattern: ['src/**/*.ts'], exclude: [], output: outputFile, patch: true })

        // Check that normal file was not created (patch mode initializes state only)
        const fileExists = await fs.stat(outputFile).then(() => true).catch(() => false)
        expect(fileExists).toBe(false)

        // Check that current state file was created
        const currentFileExists = await fs.stat(`${outputFile}.current`).then(() => true).catch(() => false)
        expect(currentFileExists).toBe(true)

        const patchFile = `${outputFile}.patch`
        const patchExists = await fs.stat(patchFile).then(() => true).catch(() => false)
        expect(patchExists).toBe(false)

        await fs.rm(outputFile, { force: true })
        await fs.rm(`${outputFile}.current`, { force: true })
      })

      it.skip('should create sequential patches that account for previous changes', async () => {
        // Create test files
        await fs.mkdir(path.join(testConfigDir, 'src'), { recursive: true })
        await fs.writeFile(path.join(testConfigDir, 'src', 'app.ts'), 'console.log("app")')

        const outputFile = path.join(__dirname, '..', 'tests', 'sequential-patch-test.md')

        // First run - create initial state
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts'], [], outputFile, { pattern: ['src/**/*.ts'], exclude: [], output: outputFile, patch: true })

        // Second run - add file
        await fs.writeFile(path.join(testConfigDir, 'src', 'utils.js'), 'export const utils = "test"')
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts', 'src/**/*.js'], [], outputFile, { pattern: ['src/**/*.ts', 'src/**/*.js'], exclude: [], output: outputFile, patch: true })

        // Third run - modify file
        await fs.writeFile(path.join(testConfigDir, 'src', 'utils.js'), 'export const utils = "modified"')
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts', 'src/**/*.js'], [], outputFile, { pattern: ['src/**/*.ts', 'src/**/*.js'], exclude: [], output: outputFile, patch: true })

        // Check that multiple diff files were created
        const patchFiles = (await fs.readdir(path.dirname(outputFile))).filter(file => file.startsWith(path.basename(outputFile) + '.') && file.endsWith('.diff'))
        expect(patchFiles.length).toBe(3) // Initial patch + two incremental patches

        // Check that current state file contains latest changes
        const currentContent = await fs.readFile(`${outputFile}.current`, 'utf-8')
        expect(currentContent).toContain('export const utils = "modified"')

        // Clean up
        for (const patchFile of patchFiles) {
          await fs.rm(patchFile, { force: true })
        }
        await fs.rm(`${outputFile}.current`, { force: true })
      })
    })

    describe('Diff file reverse operations', () => {
      beforeEach(async () => {
        // Clean up any existing generated test files
        const allFiles = await fs.readdir('.').catch(() => [])

        for (const file of allFiles) {
          // Never delete important project files and directories
          if (file === 'README.md' || file === 'package.json' || file === 'bun.lock' ||
            file === 'biome.json' || file === 'tsconfig.json' || file === 'vitest.config.ts' ||
            file === '.git' || file === '.gitignore' || file.startsWith('.git') ||
            file === 'node_modules' || file === 'dist' || file === 'src' ||
            file === 'bin' || file === 'types' || file === 'memory-bank' ||
            file === '.specstory' || file === '.vscode' || file === 'tests') {
            continue
          }
          // Only delete test-generated files with specific patterns
          if (file.startsWith('test-') || file.startsWith('integration-') ||
            file.startsWith('config-') || file.endsWith('.diff') ||
            file.endsWith('.current') || file.match(/.*\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.diff$/) ||
            (file.endsWith('.md') && file.match(/^(test-|integration-|config-|final-|create-|existing-|patch-|new-|sequential-|resume-|multi-|diff-)/))) {
            await fs.rm(file, { recursive: true, force: true }).catch(() => { })
          }
        }
        // Create test directory structure
        await fs.mkdir(path.join(testConfigDir, 'src'), { recursive: true })
      })

      afterEach(async () => {
        // Clean up any remaining generated test files in root directory
        const allFiles = await fs.readdir('.').catch(() => [])
        for (const file of allFiles) {
          // Never delete important project files and directories
          if (file === 'README.md' || file === 'package.json' || file === 'bun.lock' ||
            file === 'biome.json' || file === 'tsconfig.json' || file === 'vitest.config.ts' ||
            file === '.git' || file === '.gitignore' || file.startsWith('.git') ||
            file === 'node_modules' || file === 'dist' || file === 'src' ||
            file === 'bin' || file === 'types' || file === 'memory-bank' ||
            file === '.specstory' || file === '.vscode' || file === 'tests') {
            continue
          }
          // Only delete test-generated files with specific patterns
          if (file.startsWith('test-') || file.startsWith('integration-') ||
            file.startsWith('config-') || file.endsWith('.diff') ||
            file.endsWith('.current') || file.match(/.*\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.diff$/) ||
            (file.endsWith('.md') && file.match(/^(test-|integration-|config-|final-|create-|existing-|patch-|new-|sequential-|resume-|multi-|diff-)/))) {
            await fs.rm(file, { recursive: true, force: true }).catch(() => { })
          }
        }
      })

      it.skip('should apply single diff file and restore files', async () => {
        // Create test files
        await fs.writeFile(path.join(testConfigDir, 'src', 'app.ts'), 'console.log("app")')

        const outputFile = path.join(__dirname, '..', 'tests', 'patch-reverse-test.md')

        // Create initial file with patch
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts'], [], outputFile, { pattern: ['src/**/*.ts'], exclude: [], output: outputFile, patch: true })

        // Add new file and create patch
        await fs.writeFile(path.join(testConfigDir, 'src', 'utils.js'), 'export const utils = "test"')
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts', 'src/**/*.js'], [], outputFile, { pattern: ['src/**/*.ts', 'src/**/*.js'], exclude: [], output: outputFile, patch: true })

        // Find the diff files
        const patchFiles = (await fs.readdir(path.dirname(outputFile))).filter(file => file.startsWith(path.basename(outputFile) + '.') && file.endsWith('.diff'))
        expect(patchFiles.length).toBe(2)

        // Use the .current file which contains the complete latest state
        const currentFile = `${outputFile}.current`

        // Test reverse operation with current file
        const outputDir = 'patch-reverse-output'
        await reverseMarkdownToFiles(currentFile, outputDir)

        // Check that files were created correctly
        const appContent = await fs.readFile(path.join(outputDir, 'src', 'app.ts'), 'utf-8')
        const utilsContent = await fs.readFile(path.join(outputDir, 'src', 'utils.js'), 'utf-8')

        expect(appContent).toBe('console.log("app")')
        expect(utilsContent).toBe('export const utils = "test"')

        // Clean up
        for (const patch of patchFiles) {
          await fs.rm(patch, { force: true })
        }
        await fs.rm(`${outputFile}.current`, { force: true })
        await fs.rm(outputDir, { recursive: true, force: true })
      })

      it.skip('should apply multiple patches up to specified one', async () => {
        // Create test files
        await fs.writeFile(path.join(testConfigDir, 'src', 'app.ts'), 'console.log("app")')

        const outputFile = path.join(__dirname, '..', 'tests', 'multi-patch-reverse-test.md')

        // Create initial file with patch
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts'], [], outputFile, { pattern: ['src/**/*.ts'], exclude: [], output: outputFile, patch: true })

        // Add first new file and create patch
        await fs.writeFile(path.join(testConfigDir, 'src', 'utils.js'), 'export const utils = "v1"')
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts', 'src/**/*.js'], [], outputFile, { pattern: ['src/**/*.ts', 'src/**/*.js'], exclude: [], output: outputFile, patch: true })

        // Modify file and create second patch
        await fs.writeFile(path.join(testConfigDir, 'src', 'utils.js'), 'export const utils = "v2"')
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts', 'src/**/*.js'], [], outputFile, { pattern: ['src/**/*.ts', 'src/**/*.js'], exclude: [], output: outputFile, patch: true })

        // Find all diff files
        const patchFiles = (await fs.readdir('.'))
          .filter(file => file.startsWith(`${outputFile}.`) && file.endsWith('.diff'))
          .sort()

        expect(patchFiles.length).toBe(3)

        // Test reverse operation with first incremental patch (should have utils v1)
        const outputDir1 = 'patch-reverse-output1'
        await reverseMarkdownToFiles(patchFiles[1], outputDir1)

        const utilsContent1 = await fs.readFile(path.join(outputDir1, 'src', 'utils.js'), 'utf-8')
        expect(utilsContent1).toBe('export const utils = "v1"')

        // Test reverse operation with second patch (should have utils v2)
        const outputDir2 = 'patch-reverse-output2'
        await reverseMarkdownToFiles(patchFiles[2], outputDir2)

        const utilsContent2 = await fs.readFile(path.join(outputDir2, 'src', 'utils.js'), 'utf-8')
        expect(utilsContent2).toBe('export const utils = "v2"')

        // Clean up
        for (const patch of patchFiles) {
          await fs.rm(patch, { force: true })
        }
        await fs.rm(`${outputFile}.current`, { force: true })
        await fs.rm(outputDir1, { recursive: true, force: true })
        await fs.rm(outputDir2, { recursive: true, force: true })
      })

      it.skip('should start patch mode from existing patches when no .current file exists', async () => {
        // Create test files
        await fs.writeFile(path.join(testConfigDir, 'src', 'app.ts'), 'console.log("app")')

        const outputFile = path.join(__dirname, '..', 'tests', 'resume-patch-test.md')

        // Create initial state and remove .current file to simulate resuming
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts'], [], outputFile, { pattern: ['src/**/*.ts'], exclude: [], output: outputFile, patch: true })

        // Remove .current file to simulate resuming from patches only
        await fs.rm(`${outputFile}.current`, { force: true })

        // Add new file - should find existing patches and continue from there
        await fs.writeFile(path.join(testConfigDir, 'src', 'utils.js'), 'export const utils = "test"')
        await generateMarkdownDoc(testConfigDir, ['src/**/*.ts', 'src/**/*.js'], [], outputFile, { pattern: ['src/**/*.ts', 'src/**/*.js'], exclude: [], output: outputFile, patch: true })

        // Check that patch was created
        const patchFiles = (await fs.readdir(path.dirname(outputFile))).filter(file => file.startsWith(path.basename(outputFile) + '.') && file.endsWith('.diff'))
        expect(patchFiles.length).toBe(2) // Initial + one incremental

        // Check that .current file was recreated
        const currentFileExists = await fs.stat(`${outputFile}.current`).then(() => true).catch(() => false)
        expect(currentFileExists).toBe(true)

        // Clean up
        for (const patch of patchFiles) {
          await fs.rm(patch, { force: true })
        }
        await fs.rm(`${outputFile}.current`, { force: true })
      })
    })
  })

  describe('Diff Command', () => {
    const testDiffDir = path.join(__dirname, '..', 'tests', 'test-diff-fixtures')

    beforeEach(async () => {
      // Clean up any existing generated files
      const allFiles = await fs.readdir('.').catch(() => [])
      const importantFiles = ['README.md', 'package.json', 'bun.lock', 'biome.json', 'tsconfig.json', 'vitest.config.ts']

      for (const file of allFiles) {
        // Skip important project files
        if (importantFiles.includes(file)) {
          continue
        }
        // Only delete test-generated files
        if (file.includes('.') || file.includes('.') || file.endsWith('.current') ||
          (file.endsWith('.md') && file.match(/^(test-|integration-|config-|final-|create-|existing-|patch-|new-|sequential-|resume-|multi-|diff-)/))) {
          await fs.rm(file, { force: true }).catch(() => { })
        }
      }
      // Create test directory
      await fs.mkdir(testDiffDir, { recursive: true })
    })

    afterEach(async () => {
      // Clean up test directory
      await fs.rm(testDiffDir, { recursive: true, force: true }).catch(() => { })

      // Clean up any remaining generated test files in root directory
      const allFiles = await fs.readdir('.').catch(() => [])
      for (const file of allFiles) {
        // Never delete important project files and directories
        if (file === 'README.md' || file === 'package.json' || file === 'bun.lock' ||
          file === 'biome.json' || file === 'tsconfig.json' || file === 'vitest.config.ts' ||
          file === '.git' || file === '.gitignore' || file.startsWith('.git') ||
          file === 'node_modules' || file === 'dist' || file === 'src' ||
          file === 'bin' || file === 'types' || file === 'memory-bank' ||
          file === '.specstory' || file === '.vscode' || file === 'tests') {
          continue
        }
        // Only delete test-generated files with specific patterns
        if (file.startsWith('test-') || file.startsWith('integration-') ||
          file.startsWith('config-') || file.endsWith('.diff') ||
          file.endsWith('.current') || file.match(/.*\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.diff$/) ||
          (file.endsWith('.md') && file.match(/^(test-|integration-|config-|final-|create-|existing-|patch-|new-|sequential-|resume-|multi-|diff-)/))) {
          await fs.rm(file, { recursive: true, force: true }).catch(() => { })
        }
      }
    })

    it('should create diff between two markdown files', async () => {
      // Create test files
      await fs.mkdir(path.join(testDiffDir, 'src'), { recursive: true })
      await fs.writeFile(path.join(testDiffDir, 'src', 'app.ts'), 'console.log("app")')

      const file1 = 'diff-test1.md'
      const file2 = 'diff-test2.md'

      // Create first markdown file
      await generateMarkdownDoc(testDiffDir, ['src/**/*.ts'], [], file1)

      // Add new file and create second markdown file
      await fs.writeFile(path.join(testDiffDir, 'src', 'utils.js'), 'export const utils = "test"')
      await generateMarkdownDoc(testDiffDir, ['src/**/*.ts', 'src/**/*.js'], [], file2)

      // Create diff between the two files
      const diffFilePath = path.join(__dirname, '..', 'tests', 'test-diff-output.diff')
      await createDiff(file1, file2, diffFilePath)

      // Check that diff file was created
      const diffContent = await fs.readFile(diffFilePath, 'utf-8')
      expect(diffContent).toContain('Index: file comparison')
      expect(diffContent).toContain('utils.js')

      // Clean up
      await fs.rm(file1, { force: true })
      await fs.rm(file2, { force: true })
      await fs.rm(diffFilePath, { force: true })
      await fs.rm(testDiffDir, { recursive: true, force: true })
    })

    it.skip('should create diff between diff file and markdown file', async () => {
      // Create test files
      await fs.mkdir(path.join(testDiffDir, 'src'), { recursive: true })
      await fs.writeFile(path.join(testDiffDir, 'src', 'app.ts'), 'console.log("app")')

      const markdownFile = path.join(__dirname, '..', 'tests', 'patch-diff-test.md')

      // Create markdown file
      await generateMarkdownDoc(testDiffDir, ['src/**/*.ts'], [], markdownFile)

      // Create patch mode files
      await fs.writeFile(path.join(testDiffDir, 'src', 'utils.js'), 'export const utils = "test"')
      await generateMarkdownDoc(testDiffDir, ['src/**/*.ts', 'src/**/*.js'], [], markdownFile, { pattern: ['src/**/*.ts', 'src/**/*.js'], exclude: [], output: markdownFile, patch: true })

      // Find the diff file
      const markdownDir = path.dirname(markdownFile)
      const markdownBaseName = path.basename(markdownFile)
      const patchFiles = (await fs.readdir(markdownDir)).filter(file => file.startsWith(`${markdownBaseName}.`) && file.endsWith('.diff'))
      expect(patchFiles.length).toBe(1)
      const patchFilePath = path.join(markdownDir, patchFiles[0])

      // Create diff between markdown file and diff file
      const diffFilePath = path.join(__dirname, '..', 'tests', 'test-patch-diff.diff')
      await createDiff(markdownFile, patchFilePath, diffFilePath)

      // Check that diff file was created
      const diffContent = await fs.readFile(diffFilePath, 'utf-8')
      expect(diffContent).toContain('Index: file comparison')
      expect(diffContent).toContain('utils.js')

      // Clean up
      await fs.rm(markdownFile, { force: true })
      await fs.rm(`${markdownFile}.current`, { force: true })
      await fs.rm(patchFilePath, { force: true })
      await fs.rm(diffFilePath, { force: true })
      await fs.rm(testDiffDir, { recursive: true, force: true })
    })

    it.skip('should create diff between two diff files', async () => {
      // Create test files
      await fs.mkdir(path.join(testDiffDir, 'src'), { recursive: true })
      await fs.writeFile(path.join(testDiffDir, 'src', 'app.ts'), 'console.log("app")')

      const outputFile = path.join(__dirname, '..', 'tests', 'patch-patch-diff-test.md')

      // Create initial patch
      await generateMarkdownDoc(testDiffDir, ['src/**/*.ts'], [], outputFile, { pattern: ['src/**/*.ts'], exclude: [], output: outputFile, patch: true })

      // Add first file and create second patch
      await fs.writeFile(path.join(testDiffDir, 'src', 'utils.js'), 'export const utils = "v1"')
      await generateMarkdownDoc(testDiffDir, ['src/**/*.ts', 'src/**/*.js'], [], outputFile, { pattern: ['src/**/*.ts', 'src/**/*.js'], exclude: [], output: outputFile, patch: true })

      // Modify file and create third patch
      await fs.writeFile(path.join(testDiffDir, 'src', 'utils.js'), 'export const utils = "v2"')
      await generateMarkdownDoc(testDiffDir, ['src/**/*.ts', 'src/**/*.js'], [], outputFile, { pattern: ['src/**/*.ts', 'src/**/*.js'], exclude: [], output: outputFile, patch: true })

      // Add another file and create fourth patch
      await fs.writeFile(path.join(testDiffDir, 'src', 'config.js'), 'export const config = {}')
      await generateMarkdownDoc(testDiffDir, ['src/**/*.ts', 'src/**/*.js'], [], outputFile, { pattern: ['src/**/*.ts', 'src/**/*.js'], exclude: [], output: outputFile, patch: true })

      // Find diff files
      const patchFiles = (await fs.readdir('.')).filter(file => file.startsWith(`${outputFile}.`) && file.endsWith('.diff')).sort()
      expect(patchFiles.length).toBe(4) // Initial + three incremental patches

      // Create diff between second and third patch (v1 -> v2)
      await createDiff(patchFiles[1], patchFiles[2], path.join(__dirname, '..', 'tests', 'test-patch-patch-diff.diff'))

      // Check that diff file was created
      const diffFiles = (await fs.readdir('.')).filter(file => file === 'test-patch-patch-diff.diff')
      expect(diffFiles.length).toBe(1)

      const diffContent = await fs.readFile(diffFiles[0], 'utf-8')
      expect(diffContent).toContain('Index: file comparison')
      // Note: The diff should show the change from v1 to v2 in utils.js

      // Clean up
      for (const patch of patchFiles) {
        await fs.rm(patch, { force: true })
      }
      await fs.rm(`${outputFile}.current`, { force: true })
      await fs.rm('test-patch-patch-diff.diff', { force: true })
      await fs.rm(testDiffDir, { recursive: true, force: true })
    })

    it.skip('should create diff between two directories', async () => {
      // Create first test directory
      const dir1 = path.join(testDiffDir, 'dir1')
      await fs.mkdir(path.join(dir1, 'src'), { recursive: true })
      await fs.writeFile(path.join(dir1, 'src', 'app.js'), 'console.log("v1");')
      await fs.writeFile(path.join(dir1, 'readme.txt'), 'Version 1')

      // Create second test directory
      const dir2 = path.join(testDiffDir, 'dir2')
      await fs.mkdir(path.join(dir2, 'src'), { recursive: true })
      await fs.writeFile(path.join(dir2, 'src', 'app.js'), 'console.log("v2");')
      await fs.writeFile(path.join(dir2, 'readme.txt'), 'Version 2')
      await fs.writeFile(path.join(dir2, 'newfile.js'), 'console.log("new");')

      // Create diff between directories
      await createDiff(dir1, dir2, path.join(__dirname, '..', 'tests', 'test-dir-dir-diff.diff'))

      // Check that diff file was created
      const diffFilePath = path.join(__dirname, '..', 'tests', 'test-dir-dir-diff.diff')
      const diffExists = await fs.stat(diffFilePath).then(() => true).catch(() => false)
      expect(diffExists).toBe(true)

      const diffContent = await fs.readFile(diffFilePath, 'utf-8')
      expect(diffContent).toContain('Index: file comparison')
      expect(diffContent).toContain('console.log("v1")')
      expect(diffContent).toContain('console.log("v2")')
      expect(diffContent).toContain('newfile.js')

      // Clean up
      await fs.rm(diffFilePath, { force: true })
      await fs.rm(testDiffDir, { recursive: true, force: true })
    })

    it.skip('should create diff between directory and markdown file', async () => {
      // Create test directory
      const testDir = path.join(testDiffDir, 'testdir')
      await fs.mkdir(path.join(testDir, 'src'), { recursive: true })
      await fs.writeFile(path.join(testDir, 'src', 'main.js'), 'console.log("main");')

      // Create markdown file
      const mdFile = path.join(__dirname, '..', 'tests', 'test-markdown.md')
      await generateMarkdownDoc(testDiffDir, ['src/main.js'], [], mdFile)

      // Create diff between directory and markdown
      await createDiff(testDir, mdFile, path.join(__dirname, '..', 'tests', 'test-dir-md-diff.diff'))

      // Check that diff file was created
      const diffFiles = (await fs.readdir('.')).filter(file => file === 'test-dir-md-diff.diff')
      expect(diffFiles.length).toBe(1)

      const diffContent = await fs.readFile(diffFiles[0], 'utf-8')
      expect(diffContent).toContain('Index: file comparison')
      expect(diffContent).toContain('main.js')

      // Clean up
      await fs.rm(mdFile, { force: true })
      await fs.rm('test-dir-md-diff.diff', { force: true })
      await fs.rm(testDiffDir, { recursive: true, force: true })
    })

    it('should handle empty directories', async () => {
      // Create test directory and two empty subdirectories
      await fs.mkdir(testDiffDir, { recursive: true })
      const emptyDir1 = path.join(testDiffDir, 'empty1')
      const emptyDir2 = path.join(testDiffDir, 'empty2')
      await fs.mkdir(emptyDir1)
      await fs.mkdir(emptyDir2)

      // Should throw error for empty directories
      await expect(createDiff(emptyDir1, emptyDir2)).rejects.toThrow('No files found in directory')
    })
  })

  describe('Reverse Operation', () => {
    const testMarkdownDir = path.join(__dirname, '..', 'tests', 'test-reverse-fixtures')

    beforeEach(async () => {
      // Clean up any existing generated files
      const allFiles = await fs.readdir('.').catch(() => [])
      const importantFiles = ['README.md', 'package.json', 'bun.lock', 'biome.json', 'tsconfig.json', 'vitest.config.ts']

      for (const file of allFiles) {
        // Skip important project files
        if (importantFiles.includes(file)) {
          continue
        }
        // Only delete test-generated files
        if (file.includes('.') || file.includes('.') || file.endsWith('.current') ||
          (file.endsWith('.md') && file.match(/^(test-|integration-|config-|final-|create-|existing-|patch-|new-|sequential-|resume-|multi-|diff-)/))) {
          await fs.rm(file, { force: true }).catch(() => { })
        }
      }
      // Create test directory structure for reverse operation
      await fs.mkdir(testMarkdownDir, { recursive: true })
    })

    afterEach(async () => {
      // Clean up test directory
      await fs.rm(testMarkdownDir, { recursive: true, force: true }).catch(() => { })

      // Clean up any remaining generated test files in root directory
      const allFiles = await fs.readdir('.').catch(() => [])
      for (const file of allFiles) {
        // Never delete important project files and directories
        if (file === 'README.md' || file === 'package.json' || file === 'bun.lock' ||
          file === 'biome.json' || file === 'tsconfig.json' || file === 'vitest.config.ts' ||
          file === '.git' || file === '.gitignore' || file.startsWith('.git') ||
          file === 'node_modules' || file === 'dist' || file === 'src' ||
          file === 'bin' || file === 'types' || file === 'memory-bank' ||
          file === '.specstory' || file === '.vscode' || file === 'tests') {
          continue
        }
        // Only delete test-generated files with specific patterns
        if (file.startsWith('test-') || file.startsWith('integration-') ||
          file.startsWith('config-') || file.endsWith('.diff') ||
          file.endsWith('.current') || file.match(/.*\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.diff$/) ||
          (file.endsWith('.md') && file.match(/^(test-|integration-|config-|final-|create-|existing-|patch-|new-|sequential-|resume-|multi-|diff-)/))) {
          await fs.rm(file, { recursive: true, force: true }).catch(() => { })
        }
      }
    })

    describe('Markdown Parsing', () => {
      it('should parse single file from markdown', () => {
        const markdownContent = `# test-project

## Структура файловой системы
\`\`\`
test-project/
└── index.js
\`\`\`

## Список файлов

\`index.js\`

\`\`\`js
console.log("Hello, World!");
\`\`\`

## Сгенерировано командой:
\`\`\`
prompt-fs-to-ai test-project
\`\`\`
`;

        const files = parseMarkdownForFiles(markdownContent);
        expect(files).toHaveLength(1);
        expect(files[0].path).toBe('index.js');
        expect(files[0].content).toBe('console.log("Hello, World!");');
      })

      it('should parse multiple files from markdown', () => {
        const markdownContent = `# test-project

## Структура файловой системы
\`\`\`
test-project/
├── src/
│   ├── index.ts
│   └── utils.js
└── package.json
\`\`\`

## Список файлов

\`src/index.ts\`

\`\`\`ts
export default "test";
\`\`\`

\`src/utils.js\`

\`\`\`js
export const utils = "multiple patterns";
\`\`\`

\`package.json\`

\`\`\`json
{"name": "test"}
\`\`\`

## Сгенерировано командой:
\`\`\`
prompt-fs-to-ai test-project
\`\`\`
`;

        const files = parseMarkdownForFiles(markdownContent);
        expect(files).toHaveLength(3);

        const indexFile = files.find(f => f.path === 'src/index.ts');
        expect(indexFile).toBeDefined();
        expect(indexFile!.content).toBe('export default "test";');

        const utilsFile = files.find(f => f.path === 'src/utils.js');
        expect(utilsFile).toBeDefined();
        expect(utilsFile!.content).toBe('export const utils = "multiple patterns";');

        const packageFile = files.find(f => f.path === 'package.json');
        expect(packageFile).toBeDefined();
        expect(packageFile!.content).toBe('{"name": "test"}');
      })

      it('should handle empty markdown', () => {
        const files = parseMarkdownForFiles('');
        expect(files).toHaveLength(0);
      })

      it('should handle markdown without files', () => {
        const markdownContent = `# test-project

## Структура файловой системы
\`\`\`
test-project/
\`\`\`

## Список файлов

## Сгенерировано командой:
\`\`\`
prompt-fs-to-ai test-project
\`\`\`
`;

        const files = parseMarkdownForFiles(markdownContent);
        expect(files).toHaveLength(0);
      })
    })

    describe('Reverse File Creation', () => {
      it('should create directory structure and files from markdown', async () => {
        const markdownContent = `# test-reverse

## Структура файловой системы
\`\`\`
test-reverse/
├── src/
│   └── app.ts
└── README.md
\`\`\`

## Список файлов

\`src/app.ts\`

\`\`\`ts
console.log("Reversed!");
\`\`\`

\`README.md\`

\`\`\`md
# Test Project
This is a test project for reverse operation.
\`\`\`

## Сгенерировано командой:
\`\`\`
prompt-fs-to-ai test-reverse
\`\`\`
`;

        const markdownFile = path.join(testMarkdownDir, 'test-reverse.md');
        await fs.writeFile(markdownFile, markdownContent);

        const outputDir = path.join(testMarkdownDir, 'test-reverse');
        await reverseMarkdownToFiles(markdownFile, outputDir);

        // Check that output directory was created
        const outputDirExists = await fs.stat(outputDir).then(() => true).catch(() => false);
        expect(outputDirExists).toBe(true);

        // Check that files were created
        const appFile = path.join(outputDir, 'src', 'app.ts');
        const readmeFile = path.join(outputDir, 'README.md');

        const appContent = await fs.readFile(appFile, 'utf-8');
        const readmeContent = await fs.readFile(readmeFile, 'utf-8');

        expect(appContent).toBe('console.log("Reversed!");');
        expect(readmeContent).toBe('# Test Project\nThis is a test project for reverse operation.');
      })

      it('should use custom output directory', async () => {
        const markdownContent = `# simple

## Структура файловой системы
\`\`\`
simple/
└── simple.txt
\`\`\`

## Список файлов

\`simple.txt\`

\`\`\`txt
Simple content
\`\`\`

## Сгенерировано командой:
\`\`\`
prompt-fs-to-ai simple
\`\`\`
`;

        const markdownFile = path.join(testMarkdownDir, 'simple.md');
        await fs.writeFile(markdownFile, markdownContent);

        const customOutputDir = 'custom-output-dir';
        await reverseMarkdownToFiles(markdownFile, customOutputDir);

        // Check that custom output directory was created
        // Since customOutputDir is relative, it should be created relative to markdown file directory
        const outputDir = path.join(testMarkdownDir, customOutputDir);
        const outputDirExists = await fs.stat(outputDir).then(() => true).catch(() => false);
        expect(outputDirExists).toBe(true);

        // Check that file was created
        const filePath = path.join(outputDir, 'simple.txt');
        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toBe('Simple content');
      })

      it('should throw error when no files found in markdown', async () => {
        const markdownContent = `# Empty Project

## Структура файловой системы
\`\`\`
empty-project/
\`\`\`

## Список файлов

## Сгенерировано командой:
\`\`\`
prompt-fs-to-ai empty-project
\`\`\`
`;

        const markdownFile = path.join(testMarkdownDir, 'empty.md');
        await fs.writeFile(markdownFile, markdownContent);

        await expect(reverseMarkdownToFiles(markdownFile)).rejects.toThrow('No files found in the markdown file');
      })

      it('should handle files with different extensions', async () => {
        const markdownContent = `# multi-ext

## Структура файловой системы
\`\`\`
multi-ext/
├── config.json
├── script.py
└── style.css
\`\`\`

## Список файлов

\`config.json\`

\`\`\`json
{"setting": "value"}
\`\`\`

\`script.py\`

\`\`\`py
print("Hello from Python!")
\`\`\`

\`style.css\`

\`\`\`css
body { color: red; }
\`\`\`

## Сгенерировано командой:
\`\`\`
prompt-fs-to-ai multi-ext
\`\`\`
`;

        const markdownFile = path.join(testMarkdownDir, 'multi-ext.md');
        await fs.writeFile(markdownFile, markdownContent);

        await reverseMarkdownToFiles(markdownFile);

        const outputDir = path.join(testMarkdownDir, 'multi-ext');

        const jsonContent = await fs.readFile(path.join(outputDir, 'config.json'), 'utf-8');
        const pyContent = await fs.readFile(path.join(outputDir, 'script.py'), 'utf-8');
        const cssContent = await fs.readFile(path.join(outputDir, 'style.css'), 'utf-8');

        expect(jsonContent).toBe('{"setting": "value"}');
        expect(pyContent).toBe('print("Hello from Python!")');
        expect(cssContent).toBe('body { color: red; }');
      })

      it('should handle files containing code blocks within content', async () => {
        const markdownContent = `# code-blocks-test

## Структура файловой системы
\`\`\`
code-blocks-test/
└── example.js
\`\`\`

## Список файлов

\`example.js\`

\`\`\`js
function hello() {
  console.log("Hello World!");

  // Example of code block in comment
  /*
  \`\`\`javascript
  const example = "this is inside a comment";
  \`\`\`
  */

  const code = \`
\`\`\`javascript
function nested() {
  return "nested code block";
}
\`\`\`
\`;

  return code;
}
\`\`\`

## Сгенерировано командой:
\`\`\`
prompt-fs-to-ai code-blocks-test
\`\`\`
`;

        const markdownFile = path.join(testMarkdownDir, 'code-blocks-test.md');
        await fs.writeFile(markdownFile, markdownContent);

        await reverseMarkdownToFiles(markdownFile);

        const outputDir = path.join(testMarkdownDir, 'code-blocks-test');
        const fileContent = await fs.readFile(path.join(outputDir, 'example.js'), 'utf-8');

        // Check that the file contains all the expected content including nested code blocks
        expect(fileContent).toContain('function hello()');
        expect(fileContent).toContain('console.log("Hello World!");');
        expect(fileContent).toContain('/*');
        expect(fileContent).toContain('```javascript');
        expect(fileContent).toContain('const example = "this is inside a comment";');
        expect(fileContent).toContain('const code = `');
        expect(fileContent).toContain('function nested()');
        expect(fileContent).toContain('return "nested code block";');
        expect(fileContent).toContain('return code;');

        // Verify the exact content matches what was in the markdown
        const expectedContent = `function hello() {
  console.log("Hello World!");

  // Example of code block in comment
  /*
  \`\`\`javascript
  const example = "this is inside a comment";
  \`\`\`
  */

  const code = \`
\`\`\`javascript
function nested() {
  return "nested code block";
}
\`\`\`
\`;

  return code;
}`;

        expect(fileContent).toBe(expectedContent);
      })
    })
  })
})