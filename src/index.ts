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
  patch: boolean;  // Create patch instead of replacing existing file
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
      // Create patch between previous content and new content
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const patchFileName = `${finalOutputFile}.patch.${timestamp}`;
      const patchPath = path.resolve(process.cwd(), patchFileName);

      const patch = createPatch(
        path.basename(finalOutputFile),
        previousContent,
        mdContent,
        'Previous version',
        'Current version'
      );

      await fs.writeFile(patchPath, patch);
      console.log(`Патч создан: ${patchPath}`);
    } else {
      // First run - create a patch with full content (from empty to initial state)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const patchFileName = `${finalOutputFile}.patch.${timestamp}`;
      const patchPath = path.resolve(process.cwd(), patchFileName);

      const patch = createPatch(
        path.basename(finalOutputFile),
        '',
        mdContent,
        'Empty',
        'Initial version'
      );

      await fs.writeFile(patchPath, patch);
      console.log(`Начальный патч создан: ${patchPath}`);
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
 * Find all related patch files for a given output file
 * @param outputFilePath - Path to the output file (e.g., "output.md")
 * @returns Array of patch file paths sorted by timestamp
 */
async function findRelatedPatchesForOutput(outputFilePath: string): Promise<string[]> {
  const dir = path.dirname(outputFilePath);
  const baseName = path.basename(outputFilePath);
  const patchPrefix = `${baseName}.patch.`;

  // Find all patch files with the same base name
  const allFiles = await fs.readdir(dir);
  const patchFiles = allFiles
    .filter(file => file.startsWith(patchPrefix))
    .map(file => path.join(dir, file))
    .sort(); // Sort by timestamp

  return patchFiles;
}

/**
 * Find all related patch files for a given patch file
 * @param patchFilePath - Path to a patch file
 * @returns Array of patch file paths sorted by timestamp
 */
async function findRelatedPatches(patchFilePath: string): Promise<string[]> {
  const dir = path.dirname(patchFilePath);
  const baseName = path.basename(patchFilePath);

  // Extract base name without timestamp and extension
  // e.g., "output.md.patch.2025-09-25T13-25-02-770Z" -> "output.md"
  const baseMatch = baseName.match(/^(.+)\.patch\./);
  if (!baseMatch) {
    throw new Error(`Invalid patch file name format: ${baseName}`);
  }

  const outputBaseName = baseMatch[1];
  const patchPrefix = `${outputBaseName}.patch.`;

  // Find all patch files with the same base name
  const allFiles = await fs.readdir(dir);
  const patchFiles = allFiles
    .filter(file => file.startsWith(patchPrefix))
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
 * Apply all patches up to and including the specified patch file
 * @param patchFilePath - Path to the target patch file
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
    throw new Error(`Target patch file not found in related patches: ${patchFilePath}`);
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
  const files = await processMultiplePatterns(['**/*'], resolvedDir, [], 'temp-output.md');

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

  const commandString = `# Generated from directory: ${path.relative(process.cwd(), resolvedDir)}\n# Command: prompt-fs-to-ai ${path.relative(process.cwd(), resolvedDir)}\n\n`;

  return commandString + '## Структура файловой системы\n\n' + structure + '## Список файлов\n\n' + fileContents.join('\n\n');
}

/**
 * Create a diff between two files or directories (can be markdown files, patch files, or directories)
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

  // Check if inputs are directories and generate markdown content
  let content1: string;
  let content2: string;

  // Handle first input
  try {
    const stat1 = await fs.stat(resolvedInput1);
    if (stat1.isDirectory()) {
      content1 = await generateMarkdownFromDirectory(resolvedInput1);
    } else if (path.basename(resolvedInput1).includes('.patch.')) {
      // If it's a patch file, try to read corresponding .current file first
      const currentFile = resolvedInput1.replace(/\.patch\..*$/, '.current');
      try {
        content1 = await fs.readFile(currentFile, 'utf-8');
      } catch (error) {
        // If no .current file, apply patches
        content1 = await applyPatchesUpTo(resolvedInput1);
      }
    } else {
      // Regular markdown file
      content1 = await fs.readFile(resolvedInput1, 'utf-8');
    }
  } catch (error) {
    throw new Error(`Cannot read first input ${input1Path}: ${error}`);
  }

  // Handle second input
  try {
    const stat2 = await fs.stat(resolvedInput2);
    if (stat2.isDirectory()) {
      content2 = await generateMarkdownFromDirectory(resolvedInput2);
    } else if (path.basename(resolvedInput2).includes('.patch.')) {
      // If it's a patch file, try to read corresponding .current file first
      const currentFile = resolvedInput2.replace(/\.patch\..*$/, '.current');
      try {
        content2 = await fs.readFile(currentFile, 'utf-8');
      } catch (error) {
        // If no .current file, apply patches
        content2 = await applyPatchesUpTo(resolvedInput2);
      }
    } else {
      // Regular markdown file
      content2 = await fs.readFile(resolvedInput2, 'utf-8');
    }
  } catch (error) {
    throw new Error(`Cannot read second input ${input2Path}: ${error}`);
  }

  // Create diff
  const diff = createPatch(
    'comparison',
    content1,
    content2,
    path.basename(input1Path),
    path.basename(input2Path)
  );

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
    finalOutputPath = path.resolve(process.cwd(), `${baseName}.diff.${timestamp}`);
  }

  // Save diff
  await fs.writeFile(finalOutputPath, diff, 'utf-8');
  console.log(`Diff создан: ${finalOutputPath}`);
}

/**
 * Reverse operation: create directory structure and files from markdown file or patch file
 * @param inputFilePath - Path to the markdown file or patch file
 * @param outputDir - Output directory (optional, defaults to input filename without extension)
 * @param filesToExtract - Array of file patterns to extract (optional, extracts all if not specified)
 */
export async function reverseMarkdownToFiles(
  inputFilePath: string,
  outputDir?: string,
  filesToExtract?: string[]
): Promise<void> {
  let markdownContent: string;

  // Check if input file is a patch file
  const isPatchFile = path.basename(inputFilePath).includes('.patch.');

  if (isPatchFile) {
    console.log(`Обнаружен файл патча: ${inputFilePath}`);
    console.log('Применяю все патчи до указанного включительно...');

    // Apply all patches up to the specified one
    markdownContent = await applyPatchesUpTo(inputFilePath);
    console.log('Все патчи применены успешно');
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

  // Reverse command for restoring files from markdown or patch file
  program
    .command('reverse <input-file> [output]')
    .description('Restore directory structure and files from markdown documentation or patch file')
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
    .description('Create a diff between two files or directories (markdown, patch files, or directories)')
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
    .option('--patch', 'Create patch file instead of replacing existing output file')
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