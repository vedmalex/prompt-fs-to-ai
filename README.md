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
