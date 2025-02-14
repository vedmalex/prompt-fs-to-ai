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
  filePath?: string; // Добавляем поле для хранения пути к файлу
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