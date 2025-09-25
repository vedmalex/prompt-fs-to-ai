# src

## Структура файловой системы

```
└── src/
    ├── index.test.ts
    └── index.ts
```

## Список файлов

`index.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePatterns, isPatternArray, processMultiplePatterns, generateMarkdownDoc, parseMarkdownForFiles, reverseMarkdownToFiles } from './index.js'

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

  describe('Reverse Operation', () => {
    const testMarkdownDir = path.join(__dirname, '..', 'test-reverse-fixtures')

    beforeEach(async () => {
      // Create test directory structure for reverse operation
      await fs.mkdir(testMarkdownDir, { recursive: true })
    })

    afterEach(async () => {
      // Clean up test directory
      await fs.rm(testMarkdownDir, { recursive: true, force: true })
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

        await reverseMarkdownToFiles(markdownFile);

        // Check that output directory was created
        const outputDir = path.join(testMarkdownDir, 'test-reverse');
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
        const markdownContent = `\`simple.txt\`

\`\`\`txt
Simple content
\`\`\`
`;

        const markdownFile = path.join(testMarkdownDir, 'simple.md');
        await fs.writeFile(markdownFile, markdownContent);

        const customOutputDir = 'custom-output-dir';
        await reverseMarkdownToFiles(markdownFile, customOutputDir);

        // Check that custom output directory was created
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
        const markdownContent = `\`config.json\`

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
    })
  })
})
```

`index.ts`

```ts
import { Command } from 'commander';
import { Glob } from 'glob';
import { basename, sep, dirname } from 'path';
import * as fs from 'node:fs/promises'; //Используем promises версию
import * as path from 'node:path'
import pkg from '../package.json' assert { type: 'json' }

const getDefaultOutputFileName = (dirPath: string) => {
  const dirName = basename(dirPath);
  return `${dirName}-output.md`;
}

/**
 * Type guard to check if patterns is an array
 */
export function isPatternArray(patterns: string | string[]): patterns is string[] {
  return Array.isArray(patterns);
}

/**
 * Normalize patterns to always return array of strings
 */
export function normalizePatterns(patterns: string | string[]): string[] {
  if (isPatternArray(patterns)) {
    return patterns.filter(pattern => pattern.trim().length > 0);
  }
  return [patterns];
}

/**
 * Process multiple patterns and return unique files
 */
export async function processMultiplePatterns(
  patterns: string[],
  rootDir: string,
  excludePatterns: string[],
  finalOutputFile: string
): Promise<string[]> {
  const allFiles = new Set<string>();

  for (const pattern of patterns) {
    const glob = new Glob(
      pattern,
      {
        cwd: rootDir,
        absolute: false,
        dot: true,
        nodir: true, // Search only files for better performance
        ignore: [
          finalOutputFile,
          '*output.md', // Exclude all files ending with output.md
          '**/*output.md', // Exclude in all subdirectories
          ...excludePatterns
        ]
      }
    );

    // Scan files with exclusions
    for await (const file of glob) {
      allFiles.add(file);
    }
  }

  return Array.from(allFiles).sort();
}

interface TreeNode {
  name: string;
  isDir: boolean;
  children: Map<string, TreeNode>;
  parent?: TreeNode;
  filePath?: string; // Добавляем поле для хранения пути к файлу
}

interface Options {  // Interface for command line options
  pattern: string | string[];  // Support single pattern or multiple patterns
  exclude: string[];
  output: string;
}

export async function generateMarkdownDoc(
  rootDir: string,
  patterns: string | string[] = '**/*',
  excludePatterns: string[] = [],
  outputFile?: string,
  options?: Options, // Command line options for generating command string
) {
  const defaultOutputFile = getDefaultOutputFileName(rootDir);
  const finalOutputFile = outputFile || defaultOutputFile;

  // Generate command string with support for multiple patterns
  let commandString = `prompt-fs-to-ai ${path.relative(process.cwd(), rootDir).trim() || './'}`;
  if (options) {
    // Handle multiple patterns for command string generation
    const normalizedPatterns = normalizePatterns(options.pattern);
    const isDefaultPattern = normalizedPatterns.length === 1 && normalizedPatterns[0] === '**/*';

    if (!isDefaultPattern) {
      commandString += normalizedPatterns.map(p => ` -p "${p}"`).join('');
    }

    if (options.exclude.length > 0) {
      commandString += ` -e ${options.exclude.map(e => `"${e}"`).join(' ')}`;
    }
    if (options.output && options.output !== defaultOutputFile) {
      commandString += ` -o "${options.output}"`;
    } else {
      commandString += ` -o "${defaultOutputFile}"`;
    }
  }

  // Process patterns (single or multiple) to get file list
  const normalizedPatterns = normalizePatterns(patterns);
  const files = await processMultiplePatterns(
    normalizedPatterns,
    rootDir,
    excludePatterns,
    finalOutputFile
  );

  // Строим древовидную структуру
  const rootNode: TreeNode = {
    name: basename(rootDir),
    isDir: true,
    children: new Map(),
  };

  files.forEach((filePath) => {
    const parts = filePath.split(sep);
    let current = rootNode;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current.children.has(part)) {
        const isDir = i < parts.length - 1;
        current.children.set(part, {
          name: part,
          isDir,
          children: new Map(),
          parent: current,
          filePath: isDir ? undefined : filePath, // Сохраняем путь только для файлов
        });
      }
      current = current.children.get(part)!;
    }
  });

  // Рекурсивная функция для сортировки дерева
  function sortTreeNode(node: TreeNode) {
    const sortedChildren = Array.from(node.children.entries())
      .sort(([nameA, nodeA], [nameB, nodeB]) => {
        // Сначала директории, потом файлы
        if (nodeA.isDir && !nodeB.isDir) {
          return -1;
        }
        if (!nodeA.isDir && nodeB.isDir) {
          return 1;
        }
        // Сортировка по имени в алфавитном порядке
        return nameA.localeCompare(nameB);
      });

    node.children = new Map(sortedChildren);

    // Рекурсивно сортируем дочерние узлы
    for (const child of node.children.values()) {
      sortTreeNode(child);
    }
  }

  // Сортируем дерево, начиная с корневого узла
  sortTreeNode(rootNode);

  // Генерируем ASCII-представление и собираем содержимое файлов
  let dirStructure = '```\n';
  let filesContent = '';

  async function buildTree(node: TreeNode, prefix = '', isLast = true): Promise<string> {
    const connector = isLast ? '└── ' : '├── ';
    let result = prefix + connector + node.name + (node.isDir ? '/' : '') + '\n';

    const children = Array.from(node.children.values());
    const newPrefix = prefix + (isLast ? '    ' : '│   ');

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const isChildLast = i === children.length - 1;
      result += await buildTree(child, newPrefix, isChildLast);

      if (!child.isDir && child.filePath) {
        const fullPath = path.join(rootDir, child.filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const extension = child.filePath.split('.').pop() || '';

        filesContent += `\`${child.filePath}\`

\`\`\`${extension}
${content}
\`\`\`

`;
      }
    }

    return result;
  }


  dirStructure += await buildTree(rootNode)  // await здесь, т.к. buildTree теперь асинхронная
    .then(structure => structure.replace(/├──/g, '├──').replace(/└──/g, '└──'));
  dirStructure += '```\n';

  // Собираем итоговый документ
  const mdContent = `# ${basename(rootDir)}

## Структура файловой системы

${dirStructure}
## Список файлов

${filesContent}

## Сгенерировано командой:

\`\`\`
${commandString}
\`\`\`
`;

  // Сохраняем результат.  Используй path.resolve для формирования полного пути.
  const outputPath = path.resolve(process.cwd(), finalOutputFile);
  await fs.writeFile(outputPath, mdContent);
  console.log(`Markdown файл успешно создан: ${outputPath}`);
}

/**
 * Parse markdown file and extract files information
 * @param markdownContent - Content of the markdown file
 * @returns Array of file objects with path and content
 */
export function parseMarkdownForFiles(markdownContent: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  const lines = markdownContent.split('\n');

  let i = 0;
  while (i < lines.length) {
    // Look for file path pattern: `path/to/file`
    if (lines[i].startsWith('`') && lines[i].endsWith('`') && !lines[i].includes('```')) {
      const filePath = lines[i].slice(1, -1); // Remove backticks

      // Look for code block start
      i++;
      if (i < lines.length && lines[i].trim() === '```' + path.extname(filePath).slice(1)) {
        i++; // Skip the opening ```
        const contentLines: string[] = [];

        // Collect content until closing ```
        while (i < lines.length && lines[i] !== '```') {
          contentLines.push(lines[i]);
          i++;
        }

        files.push({
          path: filePath,
          content: contentLines.join('\n')
        });
      }
    }
    i++;
  }

  return files;
}

/**
 * Reverse operation: create directory structure and files from markdown file
 * @param markdownFilePath - Path to the markdown file
 * @param outputDir - Output directory (optional, defaults to markdown filename without extension)
 */
export async function reverseMarkdownToFiles(
  markdownFilePath: string,
  outputDir?: string
): Promise<void> {
  // Read markdown file
  const markdownContent = await fs.readFile(markdownFilePath, 'utf-8');

  // Parse files from markdown
  const files = parseMarkdownForFiles(markdownContent);

  if (files.length === 0) {
    throw new Error('No files found in the markdown file');
  }

  // Determine output directory
  const defaultOutputDir = path.basename(markdownFilePath, path.extname(markdownFilePath));
  const finalOutputDir = outputDir || defaultOutputDir;

  // Create output directory
  await fs.mkdir(finalOutputDir, { recursive: true });

  // Create all files
  for (const file of files) {
    const fullPath = path.join(finalOutputDir, file.path);

    // Create directory structure if needed
    const dirPath = dirname(fullPath);
    if (dirPath !== '.') {
      await fs.mkdir(dirPath, { recursive: true });
    }

    // Write file content
    await fs.writeFile(fullPath, file.content, 'utf-8');
  }

  console.log(`Структура файлов успешно восстановлена в директорию: ${path.resolve(finalOutputDir)}`);
  console.log(`Создано файлов: ${files.length}`);
}

// CLI function for external usage
export function runCLI() {
  const program = new Command();

  program
    .name('doc-generator')
    .description('Generates a markdown documentation of a directory structure and file contents.')
    .version(pkg.version); // Version from package.json

  // Main command for generating documentation
  program
    .argument('<directory>', 'The root directory to document')
    .option('-p, --pattern <patterns...>', 'Glob patterns for files to include (space-separated)', [])
    .option('-e, --exclude <patterns...>', 'Glob patterns for files/directories to exclude', [])
    .option('-o, --output <filename>', `Output file name (default: based on directory name)`)
    .action(async (directory, options) => {
      try {
        const resolvedDirectory = path.resolve(process.cwd(), directory);
        // If no patterns are provided via the CLI, use the default '**/*'. Otherwise, use the user's patterns.
        const patternsToUse = options.pattern.length > 0 ? options.pattern : ['**/*'];

        // Create a new options object for generateMarkdownDoc to ensure the generated command string is correct.
        const docOptions = {
          ...options,
          pattern: patternsToUse
        };

        await generateMarkdownDoc(
          resolvedDirectory,
          patternsToUse,
          options.exclude,
          options.output,
          docOptions
        );
      } catch (error) {
        console.error("Произошла ошибка:", error);
        process.exit(1); // Exit with error code
      }
    });

  // Reverse command for restoring files from markdown
  program
    .command('reverse')
    .description('Restore directory structure and files from markdown documentation')
    .argument('<markdown-file>', 'Path to the markdown file generated by this tool')
    .option('-o, --output <directory>', 'Output directory name (default: markdown filename without extension)')
    .action(async (markdownFile, options) => {
      try {
        const resolvedMarkdownFile = path.resolve(process.cwd(), markdownFile);
        await reverseMarkdownToFiles(resolvedMarkdownFile, options.output);
      } catch (error) {
        console.error("Произошла ошибка:", error);
        process.exit(1); // Exit with error code
      }
    });

  program.parse(process.argv);
}
```



## Сгенерировано командой:

```
prompt-fs-to-ai src
```
