# project-to-ai-prompt

## Структура файловой системы

```
└── project-to-ai-prompt/
    ├── bin/
    │   └── run.js
    ├── src/
    │   ├── index.test.ts
    │   └── index.ts
    ├── test-cli/
    │   ├── index.ts
    │   ├── readme.md
    │   └── utils.js
    ├── build.ts
    ├── README.md
    └── vitest.config.ts
```

## Список файлов

`bin/run.js`

```js
#!/usr/bin/env node
const { runCLI } = require('../dist/index');
runCLI();
```

`src/index.test.ts`

```ts
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

    it('should handle multiple -p flags correctly', async () => {
      // Test the accumulator function for multiple -p flags
      const accumulator = (value: string, previous: string | string[] | undefined) => {
        if (previous === undefined || (Array.isArray(previous) && previous.length === 1 && previous[0] === '**/*')) {
          return [value];
        }
        return Array.isArray(previous) ? [...previous, value] : [previous, value];
      };

      // Test default case
      expect(accumulator('first', undefined)).toEqual(['first'])

      // Test replacing default
      expect(accumulator('first', ['**/*'])).toEqual(['first'])

      // Test accumulating patterns
      expect(accumulator('second', ['first'])).toEqual(['first', 'second'])
      expect(accumulator('third', ['first', 'second'])).toEqual(['first', 'second', 'third'])
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
```

`src/index.ts`

```ts
import { Command } from 'commander';
import { Glob } from 'glob';
import { basename, sep } from 'path';
import * as fs from 'node:fs/promises'; //Используем promises версию
import * as path from 'node:path'
import pkg from '../package.json' assert { type: 'json' }

const OUTPUT_FILE_NAME = 'output.md'

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
    if (options.output !== OUTPUT_FILE_NAME) {
      commandString += ` -o "${options.output}"`;
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

// CLI function for external usage
export function runCLI() {
  const program = new Command();

  program
    .name('doc-generator')
    .description('Generates a markdown documentation of a directory structure and file contents.')
    .version(pkg.version) // Version from package.json
    .argument('<directory>', 'The root directory to document')
    .option('-p, --pattern <pattern>', 'Glob pattern for files to include (can be used multiple times)', (value, previous) => {
      if (previous === undefined || (Array.isArray(previous) && previous.length === 1 && previous[0] === '**/*')) {
        return [value];
      }
      return Array.isArray(previous) ? [...previous, value] : [previous, value];
    }, ['**/*'])
    .option('-e, --exclude <patterns...>', 'Glob patterns for files/directories to exclude', [])
    .option('-o, --output <filename>', `Output file name (default: based on directory name)`)
    .action(async (directory, options) => {
      try {
        const resolvedDirectory = path.resolve(process.cwd(), directory);
        await generateMarkdownDoc(
          resolvedDirectory,
          options.pattern,
          options.exclude,
          options.output,
          options
        );
      } catch (error) {
        console.error("Произошла ошибка:", error);
        process.exit(1); // Exit with error code
      }
    });

  program.parse(process.argv);
}
```

`test-cli/index.ts`

```ts
export const test = "single pattern";

```

`test-cli/readme.md`

```md
# Documentation

```

`test-cli/utils.js`

```js
export const utils = "multiple patterns";

```

`build.ts`

```ts
/// <reference types='@types/bun' />
import pkg from './package.json' assert { type: 'json' }
import { builtinModules } from 'module'
import { BuildConfig } from 'bun'

interface BuilderConfig {
  entrypoints?: string[] | string
  outdir?: string
  format?: 'esm' | 'cjs'
  target?: 'node' | 'bun'
  external?: string[]
  sourcemap?: 'inline' | 'external' | boolean
  splitting?: boolean
  pkg: {
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  define?: Record<string, string>
}

// Функция для Bun
export function createBunConfig(config: BuilderConfig): BuildConfig {
  const {
    pkg,
    entrypoints = ['src/index.ts'],
    outdir = './dist',
    target = 'node',
    format = 'cjs',
    external = [],
    define = {
      PRODUCTION: JSON.stringify(process.env.NODE_ENV === 'production'),
    },
    splitting = true,
    sourcemap = 'inline',
  } = config

  const bunConfig: BuildConfig = {
    entrypoints: Array.isArray(entrypoints) ? entrypoints : [entrypoints],
    target,
    define,
    external: Object.keys(pkg.dependencies || {})
      .concat(Object.keys(pkg.peerDependencies || {}))
      .concat(Object.keys(pkg.devDependencies || {}))
      .concat(builtinModules)
      .concat(external),
    outdir,
    format,
    splitting,
    sourcemap,
    minify: {
      whitespace: false,
      syntax: false,
      identifiers: false,
    },
  }

  return bunConfig
}

const entrypoints = ['src/index.ts']

// Create a Bun config from package.json
const config = createBunConfig({
  pkg,
  entrypoints,
})
const result = await Bun.build(config)

if (!result.success) {
  throw new AggregateError(result.logs, 'Build failed')
}

```

`README.md`

```md
# prompt-fs-to-ai

`prompt-fs-to-ai` is a command-line tool that generates Markdown documentation for your project, including a file system tree and the content of selected files. It's built with TypeScript and uses `commander.js` for argument parsing and `glob` for pattern matching.

## Features

*   Generates an ASCII-art representation of your project's directory structure.
*   Includes the content of specified files in the generated Markdown.
*   Allows you to specify inclusion and exclusion patterns using glob syntax.
*   Customizable output file name.
*   Handles errors gracefully.

## Installation

You can install `prompt-fs-to-ai` globally using npm:

```bash
npm install -g prompt-fs-to-ai
```

If you want to install it locally within your project (for development or as a project dependency):

```bash
npm install prompt-fs-to-ai --save-dev  # Or --save if it's a runtime dependency
```

If you're developing the package, you can link it locally:

```bash
# From the prompt-fs-to-ai directory:
npm link

# Then, in any other project:
npm link prompt-fs-to-ai
```
You can also install from local folder
```bash
npm install -g /path/to/prompt-fs-to-ai
```

## Usage

The basic command structure is:

```bash
prompt-fs-to-ai <directory> [options]
```

*   **`<directory>`:**  (Required) The root directory of your project that you want to document.

**Options:**

*   `-p, --pattern <pattern>`:  A glob pattern specifying which files to include.  Defaults to `**/*` (all files).  Examples:
    *   `**/*.{js,ts}`:  Includes all `.js` and `.ts` files.
    *   `src/**/*.py`: Includes all `.py` files within the `src` directory (and its subdirectories).
    *   `*.md`: Includes all `.md` files in the root directory only.

*   `-e, --exclude <patterns...>`:  One or more glob patterns specifying files or directories to *exclude*.  This is a space-separated list.  Examples:
    *   `node_modules`:  Excludes the `node_modules` directory.
    *   `dist`: Excludes the `dist` directory.
    *   `**/*.test.js`: Excludes files ending in `.test.js`.
    *  `"node_modules dist **/*.test.js"`: Excludes all above

*   `-o, --output <filename>`:  The name of the output Markdown file.  Defaults to `output.md`.

**Examples:**

1.  **Generate documentation for the entire project, saving to `output.md`:**

    ```bash
    prompt-fs-to-ai /path/to/your/project
    ```

2.  **Include only JavaScript and TypeScript files, excluding `node_modules`:**

    ```bash
    prompt-fs-to-ai /path/to/your/project -p "**/*.{js,ts}" -e node_modules
    ```

3.  **Include only Go files, excluding the `vendor` directory, and saving to `docs.md`:**

    ```bash
    prompt-fs-to-ai /path/to/your/project -p "**/*.go" -e vendor -o docs.md
    ```

4.  **Multiple exclude patterns:**

    ```bash
    prompt-fs-to-ai /path/to/project -e "node_modules dist **/*.test.js"
    ```

5. **Using short options:**
    ```bash
    prompt-fs-to-ai /path/to/my/project -p "**/*.{c,h}" -e "build tmp" -o my_c_docs.md
    ```

## Development

1.  **Clone the repository:**

    ```bash
    git clone <your_repository_url>
    cd prompt-fs-to-ai
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Build the project:**

    ```bash
    npm run build
    ```

4. **Run locally**
    ```bash
    npm start /path/to/your/project --options
    ```

5.  **Run tests (if you have tests):**

    ```bash
    npm test
    ```

##  Publishing (for package maintainers)

1.  **Ensure you're logged in to npm:**

    ```bash
    npm login
    ```

2.  **Build the project:**

    ```bash
    npm run build
    ```

3.  **Publish the package:**

    ```bash
    npm publish
    ```

## Error Handling

If an error occurs during the generation process (e.g., a file cannot be read), the program will print an error message to the console and exit with a non-zero exit code (1).  This is helpful for scripting and automation.

## Contributing

Contributions are welcome!  Please feel free to submit issues or pull requests.

## License

MIT

```

`vitest.config.ts`

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
})
```



## Сгенерировано командой:

```
prompt-fs-to-ai ./ -p "./**/*.{ts,js,md}" -e "./dist/**/*" "./.vscode/**/*" "types/**/*" "logs/**/*" "node_modules/**/*" ".specstory/**/*" "memory-bank/**/*" -o "undefined"
```
