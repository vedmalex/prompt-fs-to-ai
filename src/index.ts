import { Command } from 'commander';
import { Glob } from 'glob';
import { basename, sep, dirname } from 'path';
import * as fs from 'node:fs/promises'; //Используем promises версию
import * as path from 'node:path'
import pkg from '../package.json' assert { type: 'json' }
import { createPatch, applyPatch } from 'diff';

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
  patch: boolean;  // Create diff instead of replacing existing file
}

export async function generateMarkdownDoc(
  rootDir: string,
  patterns: string | string[] = '**/*',
  excludePatterns: string[] = [],
  outputFile?: string,
  options?: Options, // Command line options for generating command string
) {
  const isPatchMode = options?.patch || false;
  const defaultOutputFile = getDefaultOutputFileName(rootDir);
  const finalOutputFile = outputFile || defaultOutputFile;

  // Read .prompt-fs-to-ai file for additional patterns
  // First check target directory, then current working directory
  const configPatterns = await parsePromptFsToAiFile(rootDir, process.cwd());

  // Check if config file exists specifically in the target directory
  const targetConfigFile = path.join(rootDir, '.prompt-fs-to-ai');
  let targetConfigExists = false;
  try {
    await fs.access(targetConfigFile);
    targetConfigExists = true;
  } catch (error) {
    targetConfigExists = false;
  }


  // Combine patterns from CLI and config file
  let finalIncludePatterns: string[];
  const normalizedCliPatterns = normalizePatterns(patterns);
  const isDefaultCliPattern = normalizedCliPatterns.length === 1 && normalizedCliPatterns[0] === '**/*';

  if (!isDefaultCliPattern) {
    // CLI patterns provided, use them (CLI has priority over config)
    finalIncludePatterns = normalizedCliPatterns;
  } else if (configPatterns.include.length > 0) {
    // No CLI patterns, but config has includes
    finalIncludePatterns = configPatterns.include;
  } else {
    // Use default pattern
    finalIncludePatterns = ['**/*'];
  }

  // Combine exclude patterns from CLI and config file (with deduplication)
  const finalExcludePatterns = [...new Set([...excludePatterns, ...configPatterns.exclude])];

  // Create or update .prompt-fs-to-ai file in the target directory with current patterns
  try {
    await createPromptFsToAiFile(rootDir, finalIncludePatterns, finalExcludePatterns);
    if (!targetConfigExists) {
      console.log(`Создан файл .prompt-fs-to-ai в директории: ${rootDir}`);
    } else {
      console.log(`Обновлен файл .prompt-fs-to-ai в директории: ${rootDir}`);
    }
  } catch (error) {
    console.warn(`Не удалось создать/обновить файл .prompt-fs-to-ai: ${error}`);
  }

  // Generate command string with all actually used patterns
  let commandString = `prompt-fs-to-ai ${path.relative(process.cwd(), rootDir).trim() || './'}`;

  // Add include patterns if they're not the default
  const isFinalDefaultPattern = finalIncludePatterns.length === 1 && finalIncludePatterns[0] === '**/*';
  if (!isFinalDefaultPattern) {
    commandString += finalIncludePatterns.map(p => ` -p "${p}"`).join('');
  }

  // Add exclude patterns
  if (finalExcludePatterns.length > 0) {
    commandString += ` -e ${finalExcludePatterns.map(e => `"${e}"`).join(' ')}`;
  }

  // Add output option
  if (options?.output && options.output !== defaultOutputFile) {
    commandString += ` -o "${options.output}"`;
  } else {
    commandString += ` -o "${defaultOutputFile}"`;
  }

  // Process patterns (single or multiple) to get file list
  const files = await processMultiplePatterns(
    finalIncludePatterns,
    rootDir,
    finalExcludePatterns,
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

  if (isPatchMode) {
    const currentFilePath = `${outputPath}.current`;
    let previousContent = '';

    // Check if we have a current state file
    try {
      previousContent = await fs.readFile(currentFilePath, 'utf-8');
    } catch (error) {
      // No current state file, try to find existing patches
      try {
        previousContent = await findLatestPatchContent(outputPath);
      } catch (error) {
        // No patches found, check if output file exists
        try {
          previousContent = await fs.readFile(outputPath, 'utf-8');
        } catch (error) {
          // No previous content, this is the first run
          previousContent = '';
        }
      }
    }

    if (previousContent) {
      // Create patch between previous content and new content (keep old format for compatibility)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const patchFileName = `${finalOutputFile}.${timestamp}.diff`;
      const patchPath = path.resolve(process.cwd(), patchFileName);

      const patch = createPatch(
        path.basename(finalOutputFile),
        previousContent,
        mdContent,
        'Previous version',
        'Current version'
      );

      await fs.writeFile(patchPath, patch);
      console.log(`Файл diff создан: ${patchPath}`);
    } else {
      // First run - create a patch with full content (from empty to initial state)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const patchFileName = `${finalOutputFile}.${timestamp}.diff`;
      const patchPath = path.resolve(process.cwd(), patchFileName);

      const patch = createPatch(
        path.basename(finalOutputFile),
        '',
        mdContent,
        'Empty',
        'Initial version'
      );

      await fs.writeFile(patchPath, patch);
      console.log(`Начальный файл diff создан: ${patchPath}`);
    }

    // Update current state file
    await fs.writeFile(currentFilePath, mdContent);
    console.log(`Текущее состояние обновлено: ${currentFilePath}`);

    // Don't touch the original output file
    console.log(`Оригинальный файл не был изменен: ${outputPath}`);

  } else {
    // Normal mode - replace file
    await fs.writeFile(outputPath, mdContent);
    console.log(`Markdown файл успешно создан: ${outputPath}`);
  }
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
 * Parse .prompt-fs-to-ai file for include/exclude patterns
 * @param rootDir - Root directory to search for .prompt-fs-to-ai file (target directory)
 * @param cwdDir - Current working directory to search for .prompt-fs-to-ai file (fallback)
 * @returns Object with include and exclude patterns and the file path that was used
 */
export async function parsePromptFsToAiFile(rootDir: string, cwdDir?: string): Promise<{ include: string[], exclude: string[], configFilePath?: string }> {
  // First, try to find .prompt-fs-to-ai in the target directory (rootDir)
  let configFile = path.join(rootDir, '.prompt-fs-to-ai');
  let foundInTargetDir = false;

  try {
    await fs.access(configFile);
    foundInTargetDir = true;
  } catch (error) {
    // File doesn't exist in target directory
    foundInTargetDir = false;
  }

  // If not found in target directory, try current working directory
  if (!foundInTargetDir && cwdDir && cwdDir !== rootDir) {
    configFile = path.join(cwdDir, '.prompt-fs-to-ai');
    try {
      await fs.access(configFile);
    } catch (error) {
      // File doesn't exist in either location
      return { include: [], exclude: [], configFilePath: undefined };
    }
  }

  // If we reach here, configFile points to an existing file
  try {
    const content = await fs.readFile(configFile, 'utf-8');
    const lines = content.split('\n');

    const include: string[] = [];
    const exclude: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Handle include patterns (starting with +)
      if (trimmed.startsWith('+')) {
        const pattern = trimmed.slice(1).trim();
        if (pattern) {
          include.push(pattern);
        }
      }
      // Handle exclude patterns (starting with - or no prefix)
      else {
        const pattern = trimmed.startsWith('-') ? trimmed.slice(1).trim() : trimmed;
        if (pattern) {
          exclude.push(pattern);
        }
      }
    }

    return { include, exclude, configFilePath: configFile };
  } catch (error) {
    // File can't be read, return empty patterns
    return { include: [], exclude: [], configFilePath: undefined };
  }
}

/**
 * Create .prompt-fs-to-ai file with current patterns
 * @param rootDir - Directory where to create the file
 * @param includePatterns - Include patterns to save
 * @param excludePatterns - Exclude patterns to save
 */
export async function createPromptFsToAiFile(rootDir: string, includePatterns: string[], excludePatterns: string[]): Promise<void> {
  const configFile = path.join(rootDir, '.prompt-fs-to-ai');
  let content = '# Auto-generated .prompt-fs-to-ai file\n';
  content += '# This file contains patterns used for the current project\n\n';

  // Deduplicate patterns
  const uniqueIncludePatterns = [...new Set(includePatterns)];
  const uniqueExcludePatterns = [...new Set(excludePatterns)];

  // Add include patterns
  if (uniqueIncludePatterns.length > 0) {
    content += '# Include patterns\n';
    for (const pattern of uniqueIncludePatterns) {
      content += `+${pattern}\n`;
    }
    content += '\n';
  }

  // Add exclude patterns
  if (uniqueExcludePatterns.length > 0) {
    content += '# Exclude patterns\n';
    for (const pattern of uniqueExcludePatterns) {
      content += `${pattern}\n`;
    }
  }

  await fs.writeFile(configFile, content.trim());
}

/**
 * Apply patch to content and return result
 * @param content - Original content
 * @param patchContent - Patch content
 * @returns Patched content
 */
function applyUnifiedPatch(content: string, patchContent: string): string {
  const result = applyPatch(content, patchContent);
  if (!result) {
    throw new Error('Failed to apply patch');
  }
  return result;
}

/**
 * Find all related diff files for a given output file
 * @param outputFilePath - Path to the output file (e.g., "output.md")
 * @returns Array of diff file paths sorted by timestamp
 */
async function findRelatedPatchesForOutput(outputFilePath: string): Promise<string[]> {
  const dir = path.dirname(outputFilePath);
  const baseName = path.basename(outputFilePath);

  // Find all diff files with the same base name (format: basename.timestamp.diff)
  const allFiles = await fs.readdir(dir);
  const patchFiles = allFiles
    .filter(file => file.startsWith(`${baseName}.`) && file.endsWith('.diff'))
    .map(file => path.join(dir, file))
    .sort(); // Sort by timestamp

  return patchFiles;
}

/**
 * Find all related diff files for a given diff file
 * @param patchFilePath - Path to a diff file
 * @returns Array of diff file paths sorted by timestamp
 */
async function findRelatedPatches(patchFilePath: string): Promise<string[]> {
  const dir = path.dirname(patchFilePath);
  const baseName = path.basename(patchFilePath);

  // Extract base name without timestamp and extension
  // e.g., "output.md.2025-09-25T13-25-02-770Z.diff" -> "output.md"
  const baseMatch = baseName.match(/^(.+)\..+\.diff$/);
  if (!baseMatch) {
    throw new Error(`Invalid diff file name format: ${baseName}`);
  }

  const outputBaseName = baseMatch[1];

  // Find all diff files with the same base name (format: basename.timestamp.diff)
  const allFiles = await fs.readdir(dir);
  const patchFiles = allFiles
    .filter(file => file.startsWith(`${outputBaseName}.`) && file.endsWith('.diff'))
    .map(file => path.join(dir, file))
    .sort(); // Sort by timestamp

  return patchFiles;
}

/**
 * Find the latest patch content for an output file
 * @param outputFilePath - Path to the output file
 * @returns Latest content from applying all patches
 */
async function findLatestPatchContent(outputFilePath: string): Promise<string> {
  const patchFiles = await findRelatedPatchesForOutput(outputFilePath);

  if (patchFiles.length === 0) {
    throw new Error(`No patches found for output file: ${outputFilePath}`);
  }

  // Apply all patches up to the latest one
  const latestPatch = patchFiles[patchFiles.length - 1];
  return applyPatchesUpTo(latestPatch);
}

/**
 * Apply all patches up to and including the specified diff file
 * @param patchFilePath - Path to the target diff file
 * @returns Final content after applying all patches
 */
async function applyPatchesUpTo(patchFilePath: string): Promise<string> {
  const relatedPatches = await findRelatedPatches(patchFilePath);

  // Normalize paths for comparison
  const normalizedPatchFilePath = path.resolve(patchFilePath);
  const normalizedRelatedPatches = relatedPatches.map(p => path.resolve(p));

  // Find the target patch index
  const targetIndex = normalizedRelatedPatches.indexOf(normalizedPatchFilePath);
  if (targetIndex === -1) {
    throw new Error(`Target diff file not found in related patches: ${patchFilePath}`);
  }

  // Take patches up to and including the target
  const patchesToApply = relatedPatches.slice(0, targetIndex + 1);

  // Start with empty content (initial state)
  let currentContent = '';

  for (const patchPath of patchesToApply) {
    const patchContent = await fs.readFile(patchPath, 'utf-8');
    currentContent = applyUnifiedPatch(currentContent, patchContent);
  }

  return currentContent;
}

/**
 * Sort tree node children
 * @param node - Tree node to sort
 */
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

/**
 * Build directory structure string from files
 * @param files - Array of file paths
 * @param rootDir - Root directory
 * @returns Directory structure as string
 */
function buildDirectoryStructure(files: string[], rootDir: string): string {
  const rootNode: TreeNode = {
    name: basename(rootDir),
    isDir: true,
    children: new Map(),
  };

  // Build tree structure
  files.forEach((relativePath) => {
    const parts = relativePath.split(sep);
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
          filePath: isDir ? undefined : relativePath,
        });
      }
      current = current.children.get(part)!;
    }
  });

  // Sort tree
  sortTreeNode(rootNode);

  // Build directory structure string
  let result = '```\n';
  result += buildTreeString(rootNode);
  result += '```\n';

  return result;
}

/**
 * Build tree string representation
 * @param node - Tree node
 * @param prefix - Current prefix
 * @param isLast - Whether this is the last child
 * @returns Tree string
 */
function buildTreeString(node: TreeNode, prefix: string = '', isLast: boolean = true): string {
  let result = '';

  if (prefix === '') {
    result += node.name + '\n';
  } else {
    const connector = isLast ? '└──' : '├──';
    result += prefix + connector + ' ' + node.name + '\n';
  }

  const children = Array.from(node.children.values());
  const newPrefix = prefix + (isLast ? '    ' : '│   ');

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const isChildLast = i === children.length - 1;
    result += buildTreeString(child, newPrefix, isChildLast);
  }

  return result;
}

/**
 * Format file content for markdown
 * @param relativePath - Relative path to file
 * @param content - File content
 * @returns Formatted markdown content
 */
function formatFileContent(relativePath: string, content: string): string {
  const extension = relativePath.split('.').pop() || '';

  return `\`${relativePath}\`

\`\`\`${extension}
${content}
\`\`\`
`;
}

/**
 * Generate markdown content from a directory
 * @param dirPath - Path to the directory
 * @returns Generated markdown content
 */
async function generateMarkdownFromDirectory(dirPath: string): Promise<string> {
  // Generate markdown content without saving to file
  const resolvedDir = path.resolve(process.cwd(), dirPath);

  // Check for .prompt-fs-to-ai file and use its patterns
  const configPatterns = await parsePromptFsToAiFile(resolvedDir, process.cwd());

  // Use patterns from config file if available, otherwise use default
  let includePatterns: string[];
  let excludePatterns: string[];

  if (configPatterns.include.length > 0) {
    // Use patterns from .prompt-fs-to-ai file
    includePatterns = configPatterns.include;
    excludePatterns = configPatterns.exclude;
  } else {
    // Use default pattern if no config file
    includePatterns = ['**/*'];
    excludePatterns = [];
  }

  const files = await processMultiplePatterns(includePatterns, resolvedDir, excludePatterns, 'temp-output.md');

  if (files.length === 0) {
    throw new Error(`No files found in directory: ${dirPath}`);
  }

  const structure = buildDirectoryStructure(files, resolvedDir);
  const fileContents = await Promise.all(
    files.map(async (file) => {
      const fullPath = path.join(resolvedDir, file);
      const content = await fs.readFile(fullPath, 'utf-8');
      return formatFileContent(file, content);
    })
  );

  // Build command string with used patterns
  let commandString = `# Generated from directory: ${path.relative(process.cwd(), resolvedDir)}\n# Command: prompt-fs-to-ai ${path.relative(process.cwd(), resolvedDir)}`;

  if (configPatterns.include.length > 0) {
    commandString += includePatterns.map(p => ` -p "${p}"`).join('');
    if (excludePatterns.length > 0) {
      commandString += ` -e ${excludePatterns.map(e => `"${e}"`).join(' ')}`;
    }
  }
  commandString += '\n\n';

  return commandString + '## Структура файловой системы\n\n' + structure + '## Список файлов\n\n' + fileContents.join('\n\n');
}

/**
 * Create a diff between two files or directories (can be markdown files, diff files, or directories)
 * @param input1Path - Path to first file/directory (markdown, patch, or directory)
 * @param input2Path - Path to second file/directory (markdown, patch, or directory)
 * @param outputPath - Path where to save the diff file
 */
export async function createDiff(
  input1Path: string,
  input2Path: string,
  outputPath?: string
): Promise<void> {
  const resolvedInput1 = path.resolve(process.cwd(), input1Path);
  const resolvedInput2 = path.resolve(process.cwd(), input2Path);

  // Get file arrays from inputs
  let files1: Array<{ path: string; content: string }>;
  let files2: Array<{ path: string; content: string }>;

  // Handle first input
  try {
    const stat1 = await fs.stat(resolvedInput1);
    if (stat1.isDirectory()) {
      const content1 = await generateMarkdownFromDirectory(resolvedInput1);
      files1 = parseMarkdownForFiles(content1);
    } else if (path.basename(resolvedInput1).endsWith('.diff')) {
      // If it's a diff file, try to read corresponding .current file first
      const currentFile = resolvedInput1.replace(/\..+\.diff$/, '.current');
      try {
        const content1 = await fs.readFile(currentFile, 'utf-8');
        files1 = parseMarkdownForFiles(content1);
      } catch (error) {
        // If no .current file, apply patches
        const content1 = await applyPatchesUpTo(resolvedInput1);
        files1 = parseMarkdownForFiles(content1);
      }
    } else {
      // Regular markdown file
      const content1 = await fs.readFile(resolvedInput1, 'utf-8');
      files1 = parseMarkdownForFiles(content1);
    }
  } catch (error) {
    throw new Error(`Cannot read first input ${input1Path}: ${error}`);
  }

  // Handle second input
  try {
    const stat2 = await fs.stat(resolvedInput2);
    if (stat2.isDirectory()) {
      const content2 = await generateMarkdownFromDirectory(resolvedInput2);
      files2 = parseMarkdownForFiles(content2);
    } else if (path.basename(resolvedInput2).endsWith('.diff')) {
      // If it's a diff file, try to read corresponding .current file first
      const currentFile = resolvedInput2.replace(/\..+\.diff$/, '.current');
      try {
        const content2 = await fs.readFile(currentFile, 'utf-8');
        files2 = parseMarkdownForFiles(content2);
      } catch (error) {
        // If no .current file, apply patches
        const content2 = await applyPatchesUpTo(resolvedInput2);
        files2 = parseMarkdownForFiles(content2);
      }
    } else {
      // Regular markdown file
      const content2 = await fs.readFile(resolvedInput2, 'utf-8');
      files2 = parseMarkdownForFiles(content2);
    }
  } catch (error) {
    throw new Error(`Cannot read second input ${input2Path}: ${error}`);
  }

  // Create file-based diff
  const diff = await createFileBasedDiff(files1, files2, path.basename(input1Path), path.basename(input2Path));

  // Determine output path
  let finalOutputPath: string;
  if (outputPath) {
    finalOutputPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(process.cwd(), outputPath);
  } else {
    // Default: create diff file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = path.basename(input1Path, path.extname(input1Path));
    finalOutputPath = path.resolve(process.cwd(), `${baseName}.${timestamp}.diff`);
  }

  // Save diff
  await fs.writeFile(finalOutputPath, diff, 'utf-8');
  console.log(`Diff создан: ${finalOutputPath}`);
}

/**
 * Create a file-based diff between two file arrays
 * @param files1 - Files from first input
 * @param files2 - Files from second input
 * @param label1 - Label for first input
 * @param label2 - Label for second input
 * @returns Unified diff string
 */
/**
 * Generate directory tree string from file array
 * @param files - Array of files with paths
 * @param rootName - Name for the root directory
 * @returns Directory tree as string
 */
function generateTreeFromFiles(files: Array<{ path: string; content: string }>, rootName: string): string {
  const filePaths = files.map(f => f.path);
  return buildDirectoryStructure(filePaths, rootName);
}

async function createFileBasedDiff(
  files1: Array<{ path: string; content: string }>,
  files2: Array<{ path: string; content: string }>,
  label1: string,
  label2: string
): Promise<string> {
  // Create hash maps for quick lookup
  const fileMap1 = new Map<string, string>();
  const fileMap2 = new Map<string, string>();

  for (const file of files1) {
    fileMap1.set(file.path, file.content);
  }

  for (const file of files2) {
    fileMap2.set(file.path, file.content);
  }

  // Generate directory trees with consistent root name for comparison
  const tree1 = generateTreeFromFiles(files1, 'project');
  const tree2 = generateTreeFromFiles(files2, 'project');

  // Collect all unique file paths
  const allPaths = new Set([...fileMap1.keys(), ...fileMap2.keys()]);
  const sortedPaths = Array.from(allPaths).sort();

  // Check if we have TTY for progress bar
  const hasTTY = process.stdout.isTTY;
  let progressCurrent = 0;
  const progressTotal = sortedPaths.length;

  // Collect diff sections
  const diffSections: string[] = [];
  diffSections.push(`Index: file comparison`);
  diffSections.push(`===================================================================`);
  diffSections.push(`--- ${label1}`);
  diffSections.push(`+++ ${label2}`);
  diffSections.push(``);

  // Add directory structure diff if trees are different
  if (tree1 !== tree2) {
    diffSections.push(`## Directory Structure Changes`);
    diffSections.push(``);
    const treeDiff = createPatch('Directory Structure', tree1, tree2, `a/${label1}`, `b/${label2}`);
    // Remove the header lines since we already have them
    const treeDiffLines = treeDiff.split('\n');
    const contentStartIndex = treeDiffLines.findIndex(line => line.startsWith('@@'));
    if (contentStartIndex !== -1) {
      diffSections.push(...treeDiffLines.slice(contentStartIndex));
    } else {
      // If no actual diff content, just show the trees
      diffSections.push(`### ${label1} Structure:`);
      diffSections.push(tree1);
      diffSections.push(``);
      diffSections.push(`### ${label2} Structure:`);
      diffSections.push(tree2);
    }
    diffSections.push(``);
  }

  // Add file content changes section
  if (sortedPaths.length > 0) {
    diffSections.push(`## File Content Changes`);
    diffSections.push(``);
  }

  for (const filePath of sortedPaths) {
    // Update progress
    progressCurrent++;
    if (hasTTY) {
      const progress = Math.round((progressCurrent / progressTotal) * 100);
      process.stdout.write(`\rПрогресс: [${'='.repeat(progress / 5)}${' '.repeat(20 - progress / 5)}] ${progress}%`);
    }

    const content1 = fileMap1.get(filePath);
    const content2 = fileMap2.get(filePath);

    if (content1 === undefined && content2 !== undefined) {
      // File added in second input
      diffSections.push(`diff --git a/${filePath} b/${filePath}`);
      diffSections.push(`new file mode 100644`);
      diffSections.push(`index 0000000..${'0'.repeat(7)}`);
      diffSections.push(`--- /dev/null`);
      diffSections.push(`+++ b/${filePath}`);
      diffSections.push(`@@ -0,0 +1,${content2.split('\n').length} @@`);

      const lines = content2.split('\n');
      for (let i = 0; i < lines.length; i++) {
        diffSections.push(`+${lines[i]}`);
      }
      diffSections.push(``);

    } else if (content1 !== undefined && content2 === undefined) {
      // File removed from second input
      diffSections.push(`diff --git a/${filePath} b/${filePath}`);
      diffSections.push(`deleted file mode 100644`);
      diffSections.push(`index ${'0'.repeat(7)}..0000000`);
      diffSections.push(`--- a/${filePath}`);
      diffSections.push(`+++ /dev/null`);
      diffSections.push(`@@ -1,${content1.split('\n').length} +0,0 @@`);

      const lines = content1.split('\n');
      for (let i = 0; i < lines.length; i++) {
        diffSections.push(`-${lines[i]}`);
      }
      diffSections.push(``);

    } else if (content1 !== content2) {
      // File modified
      const fileDiff = createPatch(filePath, content1!, content2!, `a/${filePath}`, `b/${filePath}`);
      // Remove the header lines since we already have them
      const diffLines = fileDiff.split('\n');
      const contentStartIndex = diffLines.findIndex(line => line.startsWith('@@'));
      if (contentStartIndex !== -1) {
        diffSections.push(`diff --git a/${filePath} b/${filePath}`);
        diffSections.push(`index ${'0'.repeat(7)}..${'0'.repeat(7)}`);
        diffSections.push(...diffLines.slice(contentStartIndex));
        diffSections.push(``);
      }
    }
    // If content1 === content2, file is unchanged, skip it
  }

  // Clear progress bar
  if (hasTTY) {
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
  }

  return diffSections.join('\n');
}

/**
 * Reverse operation: create directory structure and files from markdown file or diff file
 * @param inputFilePath - Path to the markdown file or diff file
 * @param outputDir - Output directory (optional, defaults to input filename without extension)
 * @param filesToExtract - Array of file patterns to extract (optional, extracts all if not specified)
 */
export async function reverseMarkdownToFiles(
  inputFilePath: string,
  outputDir?: string,
  filesToExtract?: string[]
): Promise<void> {
  let markdownContent: string;

  // Check if input file is a diff file
  const isPatchFile = path.basename(inputFilePath).endsWith('.diff');

  if (isPatchFile) {
    console.log(`Обнаружен файл diff: ${inputFilePath}`);
    console.log('Применяю все файлы diff до указанного включительно...');

    // Apply all patches up to the specified one
    markdownContent = await applyPatchesUpTo(inputFilePath);
    console.log('Все файлы diff применены успешно');
  } else {
    // Read regular markdown file
    markdownContent = await fs.readFile(inputFilePath, 'utf-8');
  }

  // Parse files from markdown
  let files = parseMarkdownForFiles(markdownContent);

  if (files.length === 0) {
    throw new Error('No files found in the markdown file');
  }

  // Filter files if specific files are requested
  if (filesToExtract && filesToExtract.length > 0) {
    const filteredFiles: typeof files = [];

    for (const file of files) {
      // Check if file path matches any of the requested patterns
      const matches = filesToExtract.some(pattern => {
        // Simple wildcard matching: * matches any characters
        const regexPattern = pattern
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.')
          .replace(/\//g, '\\/');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(file.path);
      });
      if (matches) {
        filteredFiles.push(file);
      }
    }

    files = filteredFiles;

    if (files.length === 0) {
      throw new Error(`No files found matching the specified patterns: ${filesToExtract.join(', ')}`);
    }
  }

  // Determine output directory
  const inputDir = path.dirname(inputFilePath);
  const defaultOutputName = path.basename(inputFilePath, path.extname(inputFilePath));

  let finalOutputDir: string;
  if (outputDir) {
    // If outputDir is absolute path, use it as is
    // If relative, resolve relative to input file directory
    finalOutputDir = path.isAbsolute(outputDir)
      ? outputDir
      : path.join(inputDir, outputDir);
  } else {
    // Default: create directory with input filename (without extension) in same directory
    finalOutputDir = path.join(inputDir, defaultOutputName);
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
    .name('prompt-fs-to-ai')
    .description('Generates a markdown documentation of a directory structure and file contents.')
    .version(pkg.version); // Version from package.json

  // Reverse command for restoring files from markdown or diff file
  program
    .command('reverse <input-file> [output]')
    .description('Restore directory structure and files from markdown documentation or diff file')
    .option('-f, --files <files...>', 'Extract only specified files (wildcards supported)')
    .action(async (inputFile, output, options) => {
      try {
        const resolvedInputFile = path.resolve(process.cwd(), inputFile);
        await reverseMarkdownToFiles(resolvedInputFile, output, options.files);
      } catch (error) {
        console.error("Произошла ошибка:", error);
        process.exit(1); // Exit with error code
      }
    });

  // Diff command for comparing two files or directories
  program
    .command('diff <input1> <input2> [output]')
    .description('Create a diff between two files or directories (markdown, diff files, or directories)')
    .action(async (input1, input2, output) => {
      try {
        await createDiff(input1, input2, output);
      } catch (error) {
        console.error("Произошла ошибка:", error);
        process.exit(1); // Exit with error code
      }
    });

  // Main command for generating documentation
  program
    .argument('<directory>', 'The root directory to document')
    .option('-p, --pattern <patterns...>', 'Glob patterns for files to include (space-separated)', [])
    .option('-e, --exclude <patterns...>', 'Glob patterns for files/directories to exclude', [])
    .option('-o, --output <filename>', `Output file name (default: based on directory name)`)
    .option('--patch', 'Create diff file instead of replacing existing output file')
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

  program.parse(process.argv);
}