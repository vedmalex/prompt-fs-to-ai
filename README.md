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

*   `--patch`:  Create sequential patch files showing differences from the previous state instead of replacing the existing output file.  Useful for tracking changes over time without modifying the original file.

## Configuration File (.prompt-fs-to-ai)

You can create a `.prompt-fs-to-ai` file in your project root directory to define default include and exclude patterns. This file uses a syntax similar to `.gitignore`.

**Syntax:**

*   Lines starting with `#` are comments and are ignored
*   Empty lines are ignored
*   Lines starting with `+` define **include patterns** (files to include)
*   Lines starting with `-` or without prefix define **exclude patterns** (files to exclude)

**Example `.prompt-fs-to-ai` file:**

```gitignore
# Include source files
+src/**/*.ts
+src/**/*.js

# Include documentation
+**/*.md
+**/*.txt

# Exclude common directories
node_modules/
dist/
build/

# Exclude temporary files
**/*.log
**/*.tmp
.cache/
```

**Priority:**

1. **CLI patterns** have the highest priority and override configuration file patterns
2. If no CLI patterns are specified, patterns from `.prompt-fs-to-ai` in the **target directory** are used
3. If no config file exists in the target directory, patterns from `.prompt-fs-to-ai` in the **current working directory** are used as fallback
4. If no config files are found, the default `**/*` pattern is used
5. **Exclude patterns** from both CLI and config file are combined
6. **Auto-creation/Update**: The `.prompt-fs-to-ai` file in the target directory is automatically created or updated with the patterns used for the current run

**Examples:**

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

6. **Creating sequential patch files instead of replacing existing documentation:**
    ```bash
    prompt-fs-to-ai /path/to/my/project --patch
    ```
    This will create timestamped `.patch` files showing the differences between the current state and the previous state, without modifying the original file. Each subsequent run creates a new patch file that accounts for all previous changes.

## reverse

Restore directory structure and files from markdown documentation or patch file.

```bash
prompt-fs-to-ai reverse <input-file> [output-directory]
```

*   `<input-file>`: Path to the markdown file created by `prompt-fs-to-ai` or a patch file (with `.patch.` in filename)
*   `[output-directory]`: (Optional) Directory where to restore the files. Defaults to the input filename without extension.

When a patch file is provided, the command will automatically find and apply all related patches up to and including the specified patch file, reconstructing the state of the documentation at that point in time.

**Examples:**
```bash
# Restore from a specific patch file
prompt-fs-to-ai reverse output.md.patch.2025-09-25T10-30-00-000Z restored-state

# This will apply all patches from the initial state up to the specified timestamp
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
