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

  // Find the "## Список файлов" section
  const listFilesIndex = markdownContent.indexOf('## Список файлов');
  if (listFilesIndex === -1) {
    return files;
  }

  // Get content after "## Список файлов"
  const contentAfterHeader = markdownContent.slice(listFilesIndex);
  const lines = contentAfterHeader.split('\n');

  let i = 0;
  while (i < lines.length) {
    // Look for file path pattern: `path/to/file`
    if (lines[i].trim().match(/^`[^`\n]+`$/)) {
      const filePath = lines[i].trim().slice(1, -1); // Remove backticks

      // Look for code block start on next lines
      i++;
      while (i < lines.length && lines[i].trim() === '') {
        i++; // Skip empty lines
      }

      if (i < lines.length && lines[i].trim().match(/^```[\w]*$/)) {
        // Found code block start, collect content until the matching closing ```
        i++; // Skip the opening ```
        const contentLines: string[] = [];
        let braceCount = 1; // We just passed one opening ```

        while (i < lines.length && braceCount > 0) {
          const line = lines[i];

          // Count opening and closing code blocks
          if (line.trim() === '```') {
            braceCount--;
            if (braceCount === 0) {
              // This is the closing ``` for our file block
              break;
            }
          } else if (line.trim().match(/^```[\w]*$/)) {
            // This is an opening ``` inside the content
            braceCount++;
          }

          if (braceCount > 0) {
            contentLines.push(line);
          }
          i++;
        }

        // Remove trailing empty lines
        while (contentLines.length > 0 && contentLines[contentLines.length - 1].trim() === '') {
          contentLines.pop();
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
  const markdownDir = path.dirname(markdownFilePath);
  const defaultOutputName = path.basename(markdownFilePath, path.extname(markdownFilePath));

  let finalOutputDir: string;
  if (outputDir) {
    // If outputDir is absolute path, use it as is
    // If relative, resolve relative to markdown file directory
    finalOutputDir = path.isAbsolute(outputDir)
      ? outputDir
      : path.join(markdownDir, outputDir);
  } else {
    // Default: create directory with markdown filename (without extension) in same directory
    finalOutputDir = path.join(markdownDir, defaultOutputName);
  }

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
    .command('reverse <markdown-file> [output]')
    .description('Restore directory structure and files from markdown documentation')
    .action(async (markdownFile, output) => {
      try {
        const resolvedMarkdownFile = path.resolve(process.cwd(), markdownFile);
        await reverseMarkdownToFiles(resolvedMarkdownFile, output);
      } catch (error) {
        console.error("Произошла ошибка:", error);
        process.exit(1); // Exit with error code
      }
    });

  program.parse(process.argv);
}