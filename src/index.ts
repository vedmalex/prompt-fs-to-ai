import { Command } from 'commander';
import { Glob } from 'glob';
import { basename, sep } from 'path';
import * as fs from 'node:fs/promises'; //Используем promises версию
import * as path from 'node:path'
import pkg from '../package.json' assert { type: 'json' }

const OUTPUT_FILE_NAME = 'output.md'

interface TreeNode {
  name: string;
  isDir: boolean;
  children: Map<string, TreeNode>;
  parent?: TreeNode;
}

interface Options {  // Добавляем интерфейс для options
  pattern: string;
  exclude: string[];
  output: string;
}

async function generateMarkdownDoc(
  rootDir: string,
  pattern: string = '**/*',
  excludePatterns: string[] = [],
  outputFile: string = OUTPUT_FILE_NAME,
  options?: Options, // Добавляем options как необязательный параметр
) {

  // Формируем строку команды
  let commandString = `prompt-fs-to-ai ${path.relative(process.cwd(), rootDir).trim() || './'}`;
  if (options) {
    if (options.pattern !== '**/*') { // Добавляем опцию, только если она отличается от дефолтной
      commandString += ` -p "${options.pattern}"`;
    }
    if (options.exclude.length > 0) {
      commandString += ` -e ${options.exclude.map(e => `"${e}"`).join(' ')}`; // Корректно обрабатываем несколько exclude
    }
    if (options.output !== OUTPUT_FILE_NAME) {  // Добавляем опцию, только если она отличается от дефолтной
      commandString += ` -o "${options.output}"`;
    }
  }

  // Формируем итоговый glob-шаблон
  const glob = new Glob(
    pattern,
    {
      cwd: rootDir,
      absolute: false,
      dot: true,
      nodir: true, //Ищем только файлы, это ускорит
      ignore: [outputFile, ...excludePatterns]
    }
  );

  const files: string[] = [];

  // Сканируем файлы с учётом исключений
  for await (const file of glob) {
    files.push(file);
  }

  // Строим древовидную структуру
  const rootNode: TreeNode = {
    name: basename(rootDir),
    isDir: true,
    children: new Map(),
  };

  files.forEach((filePath) => {
    const parts = filePath.split(sep);
    let current = rootNode;

    for (const part of parts) {
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          isDir: false,
          children: new Map(),
          parent: current,
        });
      }
      const node = current.children.get(part)!;
      node.isDir = parts.indexOf(part) < parts.length - 1;
      current = node;
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

  // Генерируем ASCII-представление
  let dirStructure = '```\n';

  function buildTree(node: TreeNode, prefix = '', isLast = true): string {
    const connector = isLast ? '└── ' : '├── ';
    let result = prefix + connector + node.name + (node.isDir ? '/' : '') + '\n';

    const children = Array.from(node.children.values());
    const newPrefix = prefix + (isLast ? '    ' : '│   ');

    children.forEach((child, index) => {
      const isChildLast = index === children.length - 1;
      result += buildTree(child, newPrefix, isChildLast);
    });

    return result;
  }

  dirStructure += buildTree(rootNode)
    .replace(/├──/g, '├──')
    .replace(/└──/g, '└──');
  dirStructure += '```\n';

  // Формируем содержимое файлов
  let filesContent = '';

  for (const file of files) {
    const fullPath = path.join(rootDir, file);
    const content = await fs.readFile(fullPath, 'utf-8'); // Используем fs.promises
    const extension = file.split('.').pop() || '';

    filesContent += `\`${file}\`

\`\`\`${extension}
${content}
\`\`\`

`;
  }

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
  const outputPath = path.resolve(process.cwd(), outputFile);
  await fs.writeFile(outputPath, mdContent);
  console.log(`Markdown файл успешно создан: ${outputPath}`);
}

const program = new Command();

program
  .name('doc-generator')
  .description('Generates a markdown documentation of a directory structure and file contents.')
  .version(pkg.version) // Версия из package.json
  .argument('<directory>', 'The root directory to document')
  .option('-p, --pattern <pattern>', 'Glob pattern for files to include (default: **/*)', '**/*')
  .option('-e, --exclude <patterns...>', 'Glob patterns for files/directories to exclude', [])
  .option('-o, --output <filename>', `Output file name (default: ${OUTPUT_FILE_NAME})`, OUTPUT_FILE_NAME)
  .action(async (directory, options) => {
    try {
      await generateMarkdownDoc(path.resolve(process.cwd(), directory), options.pattern, options.exclude, options.output, options);
    } catch (error) {
      console.error("Произошла ошибка:", error);
      process.exit(1); // Выход с кодом ошибки
    }
  });


program.parse(process.argv);