# prompt-fs-to-ai

`prompt-fs-to-ai` is a command-line tool that generates Markdown documentation for your project, including a file system tree and the content of selected files. It's built with TypeScript and uses `commander.js` for argument parsing and `glob` for pattern matching.

## Table of Contents

- [prompt-fs-to-ai](#prompt-fs-to-ai)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Features](#features)
  - [Technical Stack](#technical-stack)
    - [Core Technologies](#core-technologies)
    - [Key Dependencies](#key-dependencies)
    - [Development Tools](#development-tools)
  - [Architecture](#architecture)
    - [Core Components](#core-components)
    - [Data Flow](#data-flow)
    - [Key Design Patterns](#key-design-patterns)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Configuration File (.prompt-fs-to-ai)](#configuration-file-prompt-fs-to-ai)
  - [Use Cases \& Examples](#use-cases--examples)
    - [Real-World Scenarios](#real-world-scenarios)
      - [AI-Assisted Development](#ai-assisted-development)
      - [Code Review Preparation](#code-review-preparation)
      - [API Documentation](#api-documentation)
      - [Configuration Management](#configuration-management)
    - [Basic Examples](#basic-examples)
      - [Advanced Workflow Examples](#advanced-workflow-examples)
  - [reverse](#reverse)
    - [Command Syntax](#command-syntax)
    - [Parameters](#parameters)
    - [Options](#options)
    - [How It Works](#how-it-works)
    - [Supported Input Types](#supported-input-types)
      - [Regular Markdown Files](#regular-markdown-files)
      - [Diff Files](#diff-files)
      - [Current State Files](#current-state-files)
    - [Advanced Usage Examples](#advanced-usage-examples)
      - [Selective File Extraction](#selective-file-extraction)
      - [Time Travel with Patches](#time-travel-with-patches)
      - [Migration and Recovery](#migration-and-recovery)
    - [Error Handling](#error-handling)
    - [Integration Examples](#integration-examples)
      - [CI/CD Pipeline Recovery](#cicd-pipeline-recovery)
      - [Git Hook for Documentation Backup](#git-hook-for-documentation-backup)
  - [patch](#patch)
    - [How Patch Mode Works](#how-patch-mode-works)
    - [Command Usage](#command-usage)
    - [Generated Files](#generated-files)
      - [Diff Files (`output.md.TIMESTAMP.diff`)](#diff-files-outputmdtimestampdiff)
      - [Current State File (`output.md.current`)](#current-state-file-outputmdcurrent)
    - [Patch File Structure](#patch-file-structure)
      - [Code Review Workflow](#code-review-workflow)
      - [Backup Strategy](#backup-strategy)
    - [Managing Patch Files](#managing-patch-files)
      - [Listing Patches](#listing-patches)
      - [Cleaning Up Patches](#cleaning-up-patches)
      - [Analyzing Patch History](#analyzing-patch-history)
    - [Integration with Version Control](#integration-with-version-control)
      - [Git Integration](#git-integration)
      - [CI/CD Integration](#cicd-integration)
    - [Performance Considerations](#performance-considerations)
    - [Troubleshooting Patch Mode](#troubleshooting-patch-mode)
      - [Common Issues](#common-issues)
    - [Best Practices](#best-practices)
  - [diff](#diff)
    - [Command Syntax](#command-syntax-1)
    - [Supported Input Types](#supported-input-types-1)
      - [Directories](#directories)
      - [Markdown Files](#markdown-files)
      - [Diff Files](#diff-files-1)
      - [Mixed Types](#mixed-types)
    - [Output Format](#output-format)
    - [Advanced Diff Scenarios](#advanced-diff-scenarios)
      - [Code Review Analysis](#code-review-analysis)
      - [Documentation Evolution](#documentation-evolution)
      - [Multi-Project Comparison](#multi-project-comparison)
    - [Integration with Other Tools](#integration-with-other-tools)
      - [Git Diff Integration](#git-diff-integration)
      - [CI/CD Change Detection](#cicd-change-detection)
    - [Diff Best Practices](#diff-best-practices)
  - [Performance \& Limitations](#performance--limitations)
    - [Performance Characteristics](#performance-characteristics)
    - [System Requirements](#system-requirements)
    - [Limitations](#limitations)
      - [File Size \& Count Limits](#file-size--count-limits)
      - [Pattern Matching Limitations](#pattern-matching-limitations)
      - [Patch System Limitations](#patch-system-limitations)
      - [Path Limitations](#path-limitations)
    - [Best Practices for Large Projects](#best-practices-for-large-projects)
  - [Development](#development)
  - [Publishing (for package maintainers)](#publishing-for-package-maintainers)
  - [Error Handling](#error-handling-1)
  - [FAQ \& Troubleshooting](#faq--troubleshooting)
    - [Frequently Asked Questions](#frequently-asked-questions)
    - [Common Issues \& Solutions](#common-issues--solutions)
      - [Performance Issues](#performance-issues)
      - [Pattern Matching Issues](#pattern-matching-issues)
      - [File Encoding Issues](#file-encoding-issues)
      - [Path Issues](#path-issues)
      - [Patch System Issues](#patch-system-issues)
    - [Getting Help](#getting-help)
    - [Debug Commands](#debug-commands)
  - [Advanced Integration Examples](#advanced-integration-examples)
    - [Enterprise Documentation Pipeline](#enterprise-documentation-pipeline)
      - [Automated Code Review Workflow](#automated-code-review-workflow)
      - [Multi-Environment Synchronization](#multi-environment-synchronization)
    - [AI-Assisted Development Integration](#ai-assisted-development-integration)
      - [ChatGPT/Claude Context Generation](#chatgptclaude-context-generation)
      - [Automated Documentation Updates](#automated-documentation-updates)
    - [Disaster Recovery System](#disaster-recovery-system)
      - [Automated Backup and Recovery](#automated-backup-and-recovery)
    - [Continuous Integration Workflows](#continuous-integration-workflows)
      - [Documentation Quality Gates](#documentation-quality-gates)
      - [Multi-Project Portfolio Management](#multi-project-portfolio-management)
    - [Custom Hooks and Extensions](#custom-hooks-and-extensions)
      - [Pre-commit Documentation Validation](#pre-commit-documentation-validation)
  - [Contributing](#contributing)
    - [Development Setup](#development-setup)
    - [Development Workflow](#development-workflow)
    - [Code Quality Standards](#code-quality-standards)
    - [Reporting Issues](#reporting-issues)
    - [Types of Contributions](#types-of-contributions)
    - [Commit Guidelines](#commit-guidelines)
    - [Testing Your Changes](#testing-your-changes)
  - [License](#license)

## Overview

**prompt-fs-to-ai** bridges the gap between your codebase and AI assistants by creating comprehensive, structured documentation that captures both the file organization and content of your projects. This tool is particularly valuable for:

- **AI-Assisted Development**: Provide context-aware documentation to AI tools like ChatGPT, Claude, or GitHub Copilot
- **Code Reviews**: Generate structured overviews for pull request reviews
- **Knowledge Sharing**: Create portable documentation that can be easily shared with team members
- **Version Control**: Track changes over time with built-in patch mode
- **Code Archaeology**: Restore project states from documentation

The tool excels at handling complex project structures while maintaining flexibility through powerful glob pattern matching and configuration files.

## Features

*   Generates an ASCII-art representation of your project's directory structure.
*   Includes the content of specified files in the generated Markdown.
*   Allows you to specify inclusion and exclusion patterns using glob syntax.
*   Customizable output file name.
*   Handles errors gracefully.

## Technical Stack

### Core Technologies
- **Runtime**: Node.js / Bun
- **Language**: TypeScript
- **Build Tool**: Bun (with TypeScript compilation)
- **CLI Framework**: Commander.js
- **File Matching**: Glob library
- **Diff/Patch**: diff library

### Key Dependencies
- `commander`: Command-line interface parsing
- `glob`: File pattern matching with advanced features
- `diff`: Unified diff creation and patch application
- `@types/node`, `@types/diff`: TypeScript type definitions

### Development Tools
- **Testing**: Vitest (coverage available via `@vitest/coverage-v8`)
- **Linting**: Biome (fast, zero-config linter)
- **Package Manager**: Bun (fast alternative to npm)

## Architecture

The tool follows a modular architecture with clear separation of concerns:

### Core Components

1. **CLI Layer** (`bin/run.js`, CLI definitions in `src/index.ts`)
   - Command parsing and validation
   - User interaction and error handling

2. **File Processing Engine** (`processMultiplePatterns`, `generateMarkdownDoc`)
   - Glob pattern resolution
   - File system traversal
   - Content reading and formatting

3. **Tree Building System** (`buildTree`, `sortTreeNode`)
   - Directory structure analysis
   - ASCII tree visualization
   - File sorting and organization

4. **Patch Management System** (`createPatch`, `applyPatchesUpTo`)
   - Change tracking between versions
   - Incremental documentation updates
   - State restoration capabilities

5. **Configuration System** (`parsePromptFsToAiFile`, `createPromptFsToAiFile`)
   - `.prompt-fs-to-ai` configuration file support
   - Pattern persistence and auto-generation

### Data Flow

```
CLI Arguments/Config File → Pattern Processing → File Discovery → Tree Building → Markdown Generation → Output/Patch Creation
```

### Key Design Patterns

- **Functional Core**: Pure functions for file processing and tree building
- **Command Pattern**: CLI commands with consistent interfaces
- **Builder Pattern**: Flexible markdown document construction
- **Strategy Pattern**: Different output modes (normal, patch, diff)

## Installation

You can install `prompt-fs-to-ai` globally using npm:

```bash
npm install -g prompt-fs-to-ai
```

You can also install it globally using Bun:

```bash
bun add -g prompt-fs-to-ai
```

If you want to install it locally within your project (for development or as a project dependency):

```bash
npm install prompt-fs-to-ai --save-dev  # Or --save if it's a runtime dependency
```

Or with Bun:

```bash
bun add -d prompt-fs-to-ai  # Or without -d if it's a runtime dependency
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

*   `-o, --output <filename>`:  The name of the output Markdown file. If omitted, the tool uses the last remembered output from `.prompt-fs-to-ai` (if present), otherwise defaults to `<directory-name>-output.md`.

*   `--patch`:  Create sequential patch files showing differences from the previous state instead of replacing the existing output file.  Useful for tracking changes over time without modifying the original file.

*   `--include-binary`: Include binary/proprietary files (not recommended). By default, binary/proprietary files are skipped.

## Configuration File (.prompt-fs-to-ai)

You can create a `.prompt-fs-to-ai` file in your project root directory to define default include and exclude patterns. This file uses a syntax similar to `.gitignore`.

Note: the tool also **respects ignore files** in the target directory: `.gitignore`, `.cursorignore`, and other `.*ignore` files (for example `.dockerignore`, `.npmignore`). Lines starting with `!` (negation) are currently ignored by the tool.

**Syntax:**

*   Lines starting with `#` are comments and are ignored
*   Empty lines are ignored
*   Lines starting with `+` define **include patterns** (files to include)
*   Lines starting with `-` or without prefix define **exclude patterns** (files to exclude)
*   Lines starting with `@` define **directives** (metadata / behavior toggles)

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

**Directives (optional):**

```gitignore
# Output settings (persisted defaults)
@outputFile my-project-output.md
@outputType md

# Include binary files (off by default)
@includeBinary true

# Auto-excluded binary extensions (added automatically when detected)
@autoExcludeExt png
@autoExcludeExt docx

# Auto-excluded paths (default ignore list + any additional auto-excludes)
@autoExcludePath **/node_modules/**
@autoExcludePath **/.git/**
```

**Priority:**

1. **CLI patterns** have the highest priority and override configuration file patterns
2. If no CLI patterns are specified, patterns from `.prompt-fs-to-ai` in the **target directory** are used
3. If no config file exists in the target directory, patterns from `.prompt-fs-to-ai` in the **current working directory** are used as fallback
4. If no config files are found, the default `**/*` pattern is used
5. **Exclude patterns** from both CLI and config file are combined
6. **Default ignores** (e.g. `.git/`, `node_modules/`, build folders, `.env*`, `.prompt-fs-to-ai`, `*.diff`, `*.current`) are applied for performance and safety
7. **Respects ignore files**: `.gitignore`, `.cursorignore`, and other `.*ignore` files (e.g. `.dockerignore`, `.npmignore`, `.eslintignore`) in the target directory are treated as additional ignores
8. **Include overrides ignores**: if your include patterns explicitly target a normally ignored folder/file (default ignores, ignore files, or auto-excludes), the tool will not ignore it for that run
9. **Auto-creation/Update**: The `.prompt-fs-to-ai` file in the target directory is automatically created or updated with the patterns used for the current run (including remembered output and auto-excludes)

## Use Cases & Examples

### Real-World Scenarios

#### AI-Assisted Development
```bash
# Generate comprehensive context for AI assistants
prompt-fs-to-ai /path/to/react-app -p "src/**/*.{ts,tsx}" -p "package.json" -e "node_modules" -o ai-context.md
```

#### Code Review Preparation
```bash
# Create focused documentation for pull request review
prompt-fs-to-ai /path/to/feature-branch -p "src/components/**/*" -p "src/hooks/**/*" -p "tests/**/*.test.ts" -o pr-review.md
```

#### API Documentation
```bash
# Document backend API structure
prompt-fs-to-ai /path/to/api-server -p "routes/**/*.js" -p "models/**/*.js" -p "controllers/**/*.js" -p "README.md" -o api-docs.md
```

#### Configuration Management
```bash
# Track infrastructure as code changes
prompt-fs-to-ai /path/to/terraform -p "**/*.tf" -p "**/*.tfvars" -p "README.md" -o infra-docs.md
```

### Basic Examples

1. **Generate documentation for the entire project (default output is based on directory name):**

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
    This will create timestamped `.diff` files showing the differences between the current state and the previous state, without modifying the original file. Each subsequent run creates a new diff file that accounts for all previous changes.

#### Advanced Workflow Examples

**Multi-language project documentation:**
```bash
# Document both frontend and backend in a monorepo
prompt-fs-to-ai /path/to/monorepo \
  -p "packages/frontend/src/**/*.{ts,tsx,vue}" \
  -p "packages/backend/src/**/*.{py,js}" \
  -p "packages/shared/**/*.{ts,d.ts}" \
  -p "docker-compose.yml" \
  -e "**/*.test.*" \
  -e "**/*.spec.*" \
  -o monorepo-overview.md
```

**Incremental documentation with patches:**
```bash
# Initial documentation
prompt-fs-to-ai /path/to/project --patch

# After making changes, create incremental patch
prompt-fs-to-ai /path/to/project --patch

# Review all changes
prompt-fs-to-ai reverse output.md.2025-09-25T14-30-00-000Z.diff changes-overview
```

**Compare project states:**
```bash
# Compare two versions of a project
prompt-fs-to-ai diff /path/to/project-v1 /path/to/project-v2 -o version-comparison.diff

# Compare documentation files
prompt-fs-to-ai diff docs-v1.md docs-v2.md -o docs-changes.diff
```

## reverse

The `reverse` command reconstructs directory structures and files from markdown documentation created by `prompt-fs-to-ai`. This powerful feature allows you to restore project states, migrate between versions, or recreate lost codebases from documentation.

### Command Syntax

```bash
prompt-fs-to-ai reverse <input-file> [output-directory] [options]
```

### Parameters

*   `<input-file>`: Path to the markdown file created by `prompt-fs-to-ai` or a diff file (ends with `.diff`)
*   `[output-directory]`: (Optional) Directory where to restore the files. Defaults to the input filename without extension.

### Options

*   `-f, --files <files...>`: Extract only specified files (wildcards supported)
    - Supports glob patterns: `*`, `**`, `?`
    - Multiple patterns: `-f "src/**/*.js" -f "docs/**/*.md"`
    - Examples: `src/main.js`, `**/*.config.*`, `test/**/*`

### How It Works

1. **Markdown Parsing**: Extracts file paths and contents from code blocks
2. **Directory Structure**: Recreates the exact folder hierarchy
3. **File Creation**: Writes all files with original content and encoding
4. **Patch Application**: When using patch files, automatically applies all related patches chronologically

### Supported Input Types

#### Regular Markdown Files
- Standard `.md` files created by `prompt-fs-to-ai`
- Contains complete project state at time of creation

<a id="patch-files-reverse"></a>
#### Diff Files
- Files ending with `.diff` (e.g., `output.md.2025-09-25T10-30-00-000Z.diff`)
- Automatically finds and applies all preceding patches
- Recreates project state at specific point in time

#### Current State Files
- `.current` files maintained by patch mode
- Contains the latest project documentation state

### Advanced Usage Examples

#### Selective File Extraction
```bash
# Extract only configuration files
prompt-fs-to-ai reverse project-docs.md restored-project -f "**/*.config.*" -f "**/*.env*"

# Extract only source code, excluding tests
prompt-fs-to-ai reverse project-docs.md src-only -f "src/**/*" -f "lib/**/*"

# Extract specific file types
prompt-fs-to-ai reverse docs.md frontend-only -f "**/*.{ts,tsx,vue}" -f "**/*.{css,scss}"
```

#### Time Travel with Patches
```bash
# Restore project state from specific timestamp
prompt-fs-to-ai reverse output.md.2025-09-25T14-30-00-000Z.diff project-at-2pm

# Restore to state before major refactoring
prompt-fs-to-ai reverse output.md.2025-09-20T09-15-00-000Z.diff pre-refactor-state

# Compare states by restoring to different directories
prompt-fs-to-ai reverse state-v1.2025-09-25T10-00-00-000Z.diff restored-v1
prompt-fs-to-ai reverse state-v2.2025-09-25T15-00-00-000Z.diff restored-v2
diff -r restored-v1 restored-v2
```

#### Migration and Recovery
```bash
# Recover lost files from documentation
prompt-fs-to-ai reverse backup-docs.md recovered-project

# Migrate project between systems
prompt-fs-to-ai reverse project-docs.md /new-server/project-location

# Create clean copy without build artifacts
prompt-fs-to-ai reverse docs.md clean-copy -f "src/**/*" -f "docs/**/*" -f "*.md" -f "*.json"
```

### Error Handling

The command provides detailed error messages for common issues:

- **No files found**: Input file contains no extractable file content
- **Invalid patch sequence**: Patch files are missing or corrupted
- **Path conflicts**: Output directory already exists with conflicting files
- **Encoding issues**: File content cannot be written in current locale

### Integration Examples

#### CI/CD Pipeline Recovery
```bash
#!/bin/bash
# Restore latest project state in CI
LATEST_DIFF=$(ls -t *.diff | head -1)
prompt-fs-to-ai reverse "$LATEST_DIFF" ./restored

# Install deps and run tests (example)
bun install || npm install
bun test || npm test
```

#### Git Hook for Documentation Backup
```bash
#!/bin/bash
# Pre-commit hook to backup current state
prompt-fs-to-ai . --patch
echo "Project state backed up to diff/current files"
```

## patch

The `patch` mode (`--patch` flag) enables incremental documentation tracking, creating timestamped patch files instead of replacing existing documentation. This system is perfect for monitoring project evolution, code reviews, and maintaining historical documentation states.

### How Patch Mode Works

Instead of overwriting the main documentation file, patch mode:

1. **Creates timestamped diffs**: Each run generates a `<output>.TIMESTAMP.diff` file containing only changes
2. **Maintains current state**: Updates a `.current` file with the latest complete documentation
3. **Preserves history**: Never modifies or deletes existing documentation
4. **Enables time travel**: Any historical state can be reconstructed using `reverse`

### Command Usage

```bash
prompt-fs-to-ai <directory> --patch [other-options]
```

The `--patch` flag can be combined with all other options:

```bash
# Track changes with custom patterns
prompt-fs-to-ai /project --patch -p "src/**/*.{js,ts}" -e "node_modules"

# Use with configuration files
prompt-fs-to-ai /project --patch -o custom-docs.md
```

### Generated Files

#### Diff Files (`output.md.TIMESTAMP.diff`)
- **Format**: `outputFile.YYYY-MM-DDTHH-MM-SS-SSSZ.diff`
- **Content**: Unified diff format showing exactly what changed
- **Example**: `project-docs.md.2025-09-25T14-30-15-123Z.diff`

#### Current State File (`output.md.current`)
- **Purpose**: Contains the complete latest documentation
- **Updates**: Modified on each patch run with full current state
- **Usage**: Can be used directly with `reverse` command

### Patch File Structure

Each patch file contains:
```
Index: project-docs.md
===================================================================
--- project-docs.md (Previous version)
+++ project-docs.md (Current version)
@@ -10,7 +10,7 @@
 ## Структура файловой системы

 ```
-project/
+my-project/
 ├── src/
 │   └── app.js
 └── package.json
@@ -25,6 +25,12 @@
 console.log("Hello World!");
 ```

+`src/utils.js`
+
+```js
+export const helper = "new function";
+```
+
 ## Сгенерировано командой:

 ```
```

### Advanced Patch Workflows

#### Continuous Monitoring
```bash
# Initial documentation
prompt-fs-to-ai /project --patch

# Development cycle
while true; do
    # Make changes...
    prompt-fs-to-ai /project --patch
    sleep 3600  # Hourly snapshots
done
```

#### Code Review Workflow
```bash
# Before changes
prompt-fs-to-ai /feature-branch --patch

# After implementing feature
prompt-fs-to-ai /feature-branch --patch

# Review changes
prompt-fs-to-ai diff output.md.2025-09-25T09-00-00-000Z.diff \
                   output.md.2025-09-25T17-00-00-000Z.diff \
                   -o feature-changes.diff
```

#### Backup Strategy
```bash
#!/bin/bash
# Daily backup script
PROJECT_DIR="/path/to/project"
BACKUP_DIR="/backups/$(date +%Y-%m-%d)"

cd "$PROJECT_DIR"
prompt-fs-to-ai . --patch -o "backup-$(date +%Y%m%d).md"

# Archive patches older than 30 days
find . -name "*.diff" -mtime +30 -exec mv {} "$BACKUP_DIR" \;
```

### Managing Patch Files

#### Listing Patches
```bash
# See all patches chronologically
ls -la *.diff | sort

# Count patches
ls *.diff | wc -l

# Find patches by date range
ls *.2025-09-*.diff  # All September diffs
```

#### Cleaning Up Patches
```bash
# Remove patches older than 90 days
find . -name "*.diff" -mtime +90 -delete

# Archive old patches
tar -czf diffs-archive.tar.gz *.2025-0[1-6]*.diff  # First half of year
```

#### Analyzing Patch History
```bash
# See patch creation timeline
ls -lt *.diff | head -10

# Check patch sizes (larger = more changes)
ls -lhS *.diff | head -5

# Find biggest changes
du -h *.diff | sort -hr | head -3
```

### Integration with Version Control

#### Git Integration
```bash
# Pre-commit hook
#!/bin/bash
prompt-fs-to-ai . --patch
git add *.diff *.current
echo "Documentation snapshot created"
```

#### CI/CD Integration
```yaml
# .github/workflows/docs.yml
name: Documentation Tracking
on: [push, pull_request]

jobs:
  track-changes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Generate documentation diff
        run: |
          npm install -g prompt-fs-to-ai  # or: bun add -g prompt-fs-to-ai
          prompt-fs-to-ai . --patch
      - name: Upload diffs
        uses: actions/upload-artifact@v3
        with:
          name: docs-diffs
          path: "*.diff"
```

### Performance Considerations

- **Storage**: Diffs are small (only changes), not full files
- **Speed**: Subsequent runs are faster (no full regeneration)
- **Memory**: Lower memory usage for large projects
- **Backup**: Easy to archive and restore historical states

### Troubleshooting Patch Mode

#### Common Issues

**"No patches found" error:**
```bash
# Run initial generation first
prompt-fs-to-ai /project  # Creates baseline
prompt-fs-to-ai /project --patch  # Now works
```

**Missing .current file:**
```bash
# Recreate from latest diff
LATEST_DIFF=$(ls -t *.diff | head -1)
prompt-fs-to-ai reverse "$LATEST_DIFF" temp && rm -rf temp
```

**Patch conflicts:**
- Diffs are always additive, no conflicts possible
- Each diff is independent and self-contained

### Best Practices

1. **Regular snapshots**: Use cron jobs or CI for regular diffs
2. **Meaningful naming**: Use descriptive output filenames
3. **Archive strategy**: Move old diffs to archive storage
4. **Monitor disk usage**: Diffs can accumulate over time
5. **Test restoration**: Regularly verify `reverse` works with your diffs

## diff

The `diff` command creates unified diff files comparing two inputs, enabling powerful comparison capabilities across different types of content.

### Command Syntax

```bash
prompt-fs-to-ai diff <input1> <input2> [output-file]
```

### Supported Input Types

The diff command can compare any combination of:

#### Directories
```bash
# Compare two project versions
prompt-fs-to-ai diff /project/v1 /project/v2 -o version-comparison.diff

# Compare development and production branches
prompt-fs-to-ai diff ./dev-branch ./prod-branch -o branch-diff.diff
```

#### Markdown Files
```bash
# Compare documentation versions
prompt-fs-to-ai diff docs-v1.md docs-v2.md -o docs-changes.diff

# Compare generated documentation
prompt-fs-to-ai diff project-a.md project-b.md -o project-comparison.diff
```

<a id="diff-files-diff"></a>
#### Diff Files
```bash
# Compare different points in time
prompt-fs-to-ai diff output.md.2025-09-25T10-00-00-000Z.diff \
                   output.md.2025-09-25T15-00-00-000Z.diff \
                   -o afternoon-changes.diff

# Compare diff states
prompt-fs-to-ai diff state-before-refactor.diff state-after-refactor.diff -o refactor-impact.diff
```

#### Mixed Types
```bash
# Directory vs Documentation
prompt-fs-to-ai diff /live/project project-docs.md -o live-vs-docs.diff

# Patch vs Current State
prompt-fs-to-ai diff output.md.2025-09-25T12-00-00-000Z.diff output.md.current -o current-changes.diff
```

### Output Format

The diff command generates unified diff format:

```
Index: comparison
===================================================================
--- input1 (First input)
+++ input2 (Second input)
@@ -line_number,context_lines +line_number,context_lines @@
 context line
-removed line
+added line
 context line
```

### Advanced Diff Scenarios

#### Code Review Analysis
```bash
# Compare feature branch states
prompt-fs-to-ai diff \
  output.md.2025-09-25T09-00-00-000Z.diff \
  output.md.2025-09-25T17-00-00-000Z.diff \
  -o feature-review.diff

# Analyze refactoring impact
prompt-fs-to-ai diff \
  project-structure-before.md \
  project-structure-after.md \
  -o refactoring-analysis.diff
```

#### Documentation Evolution
```bash
# Track documentation changes over time
prompt-fs-to-ai diff \
  docs-q1.md \
  docs-q2.md \
  -o quarterly-docs-changes.diff

# Compare auto-generated vs manual docs
prompt-fs-to-ai diff \
  auto-generated-docs.md \
  manual-docs.md \
  -o automation-assessment.diff
```

#### Multi-Project Comparison
```bash
# Compare similar projects
prompt-fs-to-ai diff \
  /projects/project-a \
  /projects/project-b \
  -o project-comparison.diff

# Analyze framework migration
prompt-fs-to-ai diff \
  legacy-framework-docs.md \
  new-framework-docs.md \
  -o migration-diff.diff
```

### Integration with Other Tools

#### Git Diff Integration
```bash
# Create diff and apply with git
prompt-fs-to-ai diff docs-v1.md docs-v2.md changes.diff
git apply changes.diff  # Apply the changes

# Compare with git diff
prompt-fs-to-ai diff file1 file2 | git diff --no-index
```

#### CI/CD Change Detection
```bash
#!/bin/bash
# Detect documentation changes in CI
prompt-fs-to-ai diff \
  docs-baseline.md \
  $(find . -name "*.md" -newer docs-baseline.md | head -1) \
  -o recent-changes.diff

if [ -s recent-changes.diff ]; then
    echo "Documentation changes detected"
    cat recent-changes.diff
fi
```

### Diff Best Practices

1. **Meaningful comparisons**: Compare similar types of content
2. **Clear output names**: Use descriptive filenames for diff outputs
3. **Regular baselines**: Establish baseline files for ongoing comparison
4. **Automation**: Integrate into CI/CD for continuous monitoring
5. **Archiving**: Keep important diffs for historical reference

## Performance & Limitations

### Performance Characteristics

**File Processing Speed:**
- Small projects (< 100 files): Instantaneous
- Medium projects (100-1000 files): 1-5 seconds
- Large projects (1000+ files): 5-30 seconds
- Very large projects (10000+ files): 30+ seconds

**Memory Usage:**
- Base memory: ~50MB
- Scales with file count and content size
- Large files (>10MB) may cause memory issues

### System Requirements

**Minimum Requirements:**
- Node.js 16+ or Bun 1.0+
- 512MB RAM
- Any modern OS (Linux, macOS, Windows)

**Recommended for Large Projects:**
- Node.js 18+ or latest Bun
- 2GB+ RAM
- SSD storage for better performance

### Limitations

#### File Size & Count Limits
- **Maximum file size**: Limited by available RAM (recommended <50MB per file)
- **Binary/proprietary files**: Skipped by default (images, docx/pptx/xlsx, archives, etc.). Use `--include-binary` to include them (not recommended).
- **Encoding**: UTF-8 only (other encodings may cause issues)
- **Symbolic links**: Followed, but may cause infinite loops in circular structures

#### Pattern Matching Limitations
- Glob patterns are processed by the `glob` library with standard limitations
- Very complex patterns may impact performance
- Case sensitivity depends on the underlying file system

#### Patch System Limitations
- Diffs are cumulative but may become large over time
- Binary file changes cannot be tracked in patches
- File renames/moves are tracked as delete+add operations

#### Path Limitations
- Maximum path length depends on OS (typically 260 chars on Windows, 1024+ on Unix)
- Unicode characters in paths are supported but may cause issues on some systems

### Best Practices for Large Projects

1. **Use specific patterns** instead of `**/*` for large codebases:
   ```bash
   prompt-fs-to-ai /large/project -p "src/**/*.{js,ts}" -p "docs/**/*.md" -e "node_modules"
   ```

2. **Split documentation** by modules/packages:
   ```bash
   # Document each package separately
   prompt-fs-to-ai packages/frontend -o frontend-docs.md
   prompt-fs-to-ai packages/backend -o backend-docs.md
   ```

3. **Use patch mode** for incremental updates:
   ```bash
   prompt-fs-to-ai /project --patch  # Much faster for subsequent runs
   ```

4. **Exclude unnecessary files** early:
   ```bash
   prompt-fs-to-ai /project -e "node_modules" -e "dist" -e ".git" -e "**/*.log"
```

## Development

1.  **Clone the repository:**

    ```bash
    git clone <your_repository_url>
    cd prompt-fs-to-ai
    ```

2.  **Install dependencies:**

    ```bash
    bun install  # or npm install
    ```

3.  **Build the project:**

    ```bash
    bun run build  # or npm run build
    ```

4. **Run locally**

    Build first, then run the CLI entrypoint:

    ```bash
    bun run build
    node bin/run.js /path/to/your/project --options
    ```

5.  **Run tests (if you have tests):**

    ```bash
    bun test  # or npm test
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

## FAQ & Troubleshooting

### Frequently Asked Questions

**Q: What's the difference between `prompt-fs-to-ai` and other documentation tools?**

A: Unlike traditional documentation generators that focus on API docs or code comments, `prompt-fs-to-ai` creates comprehensive project snapshots optimized for AI consumption. It captures both structure and content in a single, portable format.

**Q: Can I use this for binary files or large files?**

A: Binary files are automatically skipped. For large text files, there's no strict limit, but very large files (>10MB) may cause memory issues. Consider using specific patterns to exclude unnecessary large files.

**Q: How does the patch system work?**

A: The patch system creates incremental diffs between documentation states. Each `--patch` run generates a timestamped `.diff` file containing only the changes, making it efficient for tracking project evolution without duplicating unchanged content.

**Q: Can I automate documentation generation in CI/CD?**

A: Yes! The tool returns appropriate exit codes and can be integrated into CI pipelines. Use `--patch` mode for incremental updates and combine with `diff` command for change detection.

**Q: What's the `.prompt-fs-to-ai` configuration file for?**

A: This file stores your include/exclude patterns and is automatically created/updated with each run. It ensures consistency across documentation generations and can be committed to version control.

### Common Issues & Solutions

#### Performance Issues

**Problem:** Tool is slow on large projects
```
Solution: Use specific patterns instead of **/* and exclude unnecessary directories
prompt-fs-to-ai /project -p "src/**/*.{js,ts}" -e "node_modules" -e "dist"
```

**Problem:** Out of memory errors
```
Solution: Split large projects into smaller documentation chunks
prompt-fs-to-ai packages/frontend -o frontend-docs.md
prompt-fs-to-ai packages/backend -o backend-docs.md
```

#### Pattern Matching Issues

**Problem:** Files not included despite correct patterns
```
Solution: Check glob syntax and verify paths exist
prompt-fs-to-ai /project -p "**/*.{js,ts}" --verbose
```

**Problem:** Exclude patterns not working
```
Solution: Exclude patterns are combined with includes. Use quotes for complex patterns
prompt-fs-to-ai /project -e "node_modules dist **/*.test.js"
```

#### File Encoding Issues

**Problem:** Files with special characters display incorrectly
```
Solution: Ensure files are UTF-8 encoded. The tool only supports UTF-8.
```

#### Path Issues

**Problem:** "Path too long" errors on Windows
```
Solution: Use shorter relative paths or run from a directory closer to the project
cd /d C:\path\to\deep\project
prompt-fs-to-ai .
```

#### Patch System Issues

**Problem:** Patches not applying correctly
```
Solution: Ensure you're applying patches in chronological order
prompt-fs-to-ai reverse output.md.2025-09-25T10-00-00-000Z.diff
```

**Problem:** Missing `.current` file
```
Solution: Run at least one normal generation first, or apply existing patches
prompt-fs-to-ai /project  # Creates .current file
prompt-fs-to-ai /project --patch  # Now works correctly
```

### Getting Help

1. **Check the documentation:** Review this README and examples
2. **Run with verbose output:** Add `--help` for all options
3. **Test with small projects:** Isolate issues using minimal test cases
4. **Check existing issues:** Search GitHub issues for similar problems
5. **Provide details when reporting:** Include OS, Node version, command used, and error messages

### Debug Commands

```bash
# See all available options
prompt-fs-to-ai --help

# Test pattern matching
prompt-fs-to-ai /test/dir -p "**/*.js" -e "node_modules"

# Validate configuration
cat .prompt-fs-to-ai  # Check generated config

# Check patch files
ls -la *.diff      # List all diff files
```

## Advanced Integration Examples

This section showcases sophisticated workflows combining multiple `prompt-fs-to-ai` features for enterprise-level documentation management.

### Enterprise Documentation Pipeline

#### Automated Code Review Workflow
```bash
#!/bin/bash
# .github/workflows/code-review.yml

BRANCH_NAME=$1
REVIEW_DIR="code-reviews/${BRANCH_NAME}"

# Generate baseline documentation
prompt-fs-to-ai . --patch -o "${REVIEW_DIR}/baseline.md"

# Run tests and generate post-test docs
npm test
prompt-fs-to-ai . --patch -o "${REVIEW_DIR}/after-tests.md"

# Compare states
prompt-fs-to-ai diff \
  "${REVIEW_DIR}/baseline.md.current" \
  "${REVIEW_DIR}/after-tests.md.current" \
  -o "${REVIEW_DIR}/test-impact.diff"

# Archive review artifacts
tar -czf "${REVIEW_DIR}.tar.gz" "$REVIEW_DIR"
```

#### Multi-Environment Synchronization
```bash
#!/bin/bash
# sync-docs.sh - Synchronize documentation across environments

ENVIRONMENTS=("development" "staging" "production")
BASE_DOCS="infrastructure-docs.md"

for env in "${ENVIRONMENTS[@]}"; do
    echo "Syncing docs for $env environment..."

    # Generate environment-specific docs
    prompt-fs-to-ai "/environments/$env" \
        -p "**/*.yml" -p "**/*.yaml" -p "**/*.json" \
        -e "**/secrets/**" \
        -o "${env}-config.md"

    # Compare with baseline
    if [ -f "$BASE_DOCS" ]; then
        prompt-fs-to-ai diff "$BASE_DOCS" "${env}-config.md" \
            -o "${env}-drift.diff"
    fi
done

# Generate summary report
echo "# Environment Drift Report" > drift-summary.md
echo "Generated: $(date)" >> drift-summary.md
echo "" >> drift-summary.md

for env in "${ENVIRONMENTS[@]}"; do
    if [ -f "${env}-drift.diff" ]; then
        echo "## $env Environment" >> drift-summary.md
        echo "\`\`\`diff" >> drift-summary.md
        head -20 "${env}-drift.diff" >> drift-summary.md
        echo "\`\`\`" >> drift-summary.md
        echo "" >> drift-summary.md
    fi
done
```

### AI-Assisted Development Integration

#### ChatGPT/Claude Context Generation
```bash
#!/bin/bash
# prepare-ai-context.sh

PROJECT_TYPE=$1
OUTPUT_DIR="ai-contexts/${PROJECT_TYPE}"

mkdir -p "$OUTPUT_DIR"

# Generate comprehensive context for different AI tasks
case $PROJECT_TYPE in
    "frontend")
        prompt-fs-to-ai . \
            -p "src/**/*.{ts,tsx,js,jsx}" \
            -p "public/**/*.{html,css}" \
            -p "package.json" \
            -p "tsconfig.json" \
            -e "**/*.test.*" \
            -e "**/*.spec.*" \
            -o "${OUTPUT_DIR}/frontend-context.md"
        ;;

    "backend")
        prompt-fs-to-ai . \
            -p "src/**/*.{py,js,ts}" \
            -p "**/*.sql" \
            -p "requirements.txt" \
            -p "package.json" \
            -p "Dockerfile" \
            -e "**/migrations/**" \
            -o "${OUTPUT_DIR}/backend-context.md"
        ;;

    "infrastructure")
        prompt-fs-to-ai . \
            -p "**/*.tf" \
            -p "**/*.yml" \
            -p "**/*.yaml" \
            -p "**/*.json" \
            -p "Makefile" \
            -o "${OUTPUT_DIR}/infra-context.md"
        ;;
esac

echo "AI context prepared in: $OUTPUT_DIR"
```

#### Automated Documentation Updates
```bash
#!/bin/bash
# update-docs.sh - Keep documentation synchronized with code changes

REPO_ROOT=$(git rev-parse --show-toplevel)
DOCS_DIR="${REPO_ROOT}/docs"
DIFF_DIR="${DOCS_DIR}/diffs"

mkdir -p "$DIFF_DIR"

# Generate incremental documentation diffs
cd "$REPO_ROOT"
prompt-fs-to-ai . --patch -o "${DOCS_DIR}/api-docs.md"

# Check for significant changes
LATEST_DIFF=$(ls -t ${DOCS_DIR}/*.diff 2>/dev/null | head -1)
if [ -n "$LATEST_DIFF" ]; then
    DIFF_SIZE=$(stat -f%z "$LATEST_DIFF" 2>/dev/null || stat -c%s "$LATEST_DIFF" 2>/dev/null)

    if [ "$DIFF_SIZE" -gt 10000 ]; then  # Significant changes
        echo "🚨 Significant documentation changes detected!"

        # Generate change summary
        prompt-fs-to-ai diff \
            "${DOCS_DIR}/api-docs.md.current" \
            "$LATEST_DIFF" \
            -o "${DOCS_DIR}/recent-changes.diff"

        # Notify team (example with Slack webhook)
        curl -X POST -H 'Content-type: application/json' \
             --data "{\"text\":\"Major docs changes detected: $DIFF_SIZE bytes\"}" \
             $SLACK_WEBHOOK_URL
    fi
fi

# Archive old diffs (keep last 30 days)
find "$DIFF_DIR" -name "*.diff" -mtime +30 -exec mv {} "${DIFF_DIR}/archive/" \;
```

### Disaster Recovery System

#### Automated Backup and Recovery
```bash
#!/bin/bash
# backup-restore.sh

BACKUP_ROOT="/backups/projects"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

backup_project() {
    local project_name=$1
    local project_path=$2
    local backup_path="${BACKUP_ROOT}/${project_name}/${TIMESTAMP}"

    mkdir -p "$backup_path"

    echo "Creating backup for $project_name..."

    # Generate comprehensive documentation backup
    cd "$project_path"
    prompt-fs-to-ai . --patch -o "${backup_path}/full-backup.md"

    # Create metadata
    cat > "${backup_path}/backup-info.json" << EOF
{
    "project": "$project_name",
    "timestamp": "$TIMESTAMP",
    "path": "$project_path",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'no-git')",
    "files_count": $(find . -type f | wc -l),
    "total_size": $(du -sb . | cut -f1)
}
EOF

    # Create recovery script
    cat > "${backup_path}/restore.sh" << EOF
#!/bin/bash
echo "Restoring $project_name from backup..."
prompt-fs-to-ai reverse full-backup.md.current ../restored-$project_name
echo "Recovery complete. Check ../restored-$project_name"
EOF
    chmod +x "${backup_path}/restore.sh"

    echo "Backup completed: $backup_path"
}

restore_project() {
    local project_name=$1
    local timestamp=$2
    local restore_path="${3:-./restored-${project_name}}"

    local backup_path="${BACKUP_ROOT}/${project_name}/${timestamp}"

    if [ ! -d "$backup_path" ]; then
        echo "Backup not found: $backup_path"
        exit 1
    fi

    echo "Restoring $project_name from $timestamp..."
    cd "$backup_path"
    prompt-fs-to-ai reverse full-backup.md.current "$restore_path"

    echo "Project restored to: $restore_path"
}

# Usage examples:
# backup_project "my-app" "/path/to/my-app"
# restore_project "my-app" "20250925_143000" "/restore/location"
```

### Continuous Integration Workflows

#### Documentation Quality Gates
```yaml
# .github/workflows/docs-quality.yml
name: Documentation Quality Check

on:
  pull_request:
    paths:
      - 'src/**'
      - 'docs/**'

jobs:
  docs-quality:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Generate documentation
        run: |
          npx prompt-fs-to-ai . \
            -p "src/**/*.{ts,js}" \
            -p "docs/**/*.md" \
            -e "**/*.test.*" \
            -o pr-docs.md

      - name: Compare with main branch docs
        run: |
          git fetch origin main
          git checkout origin/main -- docs/main-branch-docs.md || true

          if [ -f "docs/main-branch-docs.md" ]; then
            npx prompt-fs-to-ai diff \
              docs/main-branch-docs.md \
              pr-docs.md \
              -o docs-changes.diff

            echo "## Documentation Changes" >> $GITHUB_STEP_SUMMARY
            echo '```diff' >> $GITHUB_STEP_SUMMARY
            head -50 docs-changes.diff >> $GITHUB_STEP_SUMMARY
            echo '```' >> $GITHUB_STEP_SUMMARY
          fi

      - name: Verify documentation completeness
        run: |
          # Check if all public APIs are documented
          MISSING_DOCS=$(node -e "
            const fs = require('fs');
            const docs = fs.readFileSync('pr-docs.md', 'utf8');
            const sourceFiles = require('glob').sync('src/**/*.{ts,js}', { ignore: '**/*.test.*' });

            const undocumented = sourceFiles.filter(file => {
              const exportName = file.split('/').pop().replace(/\..*$/, '');
              return !docs.includes(\`\${exportName}\`);
            });

            if (undocumented.length > 0) {
              console.log('Potentially undocumented files:');
              undocumented.forEach(file => console.log(\`- \${file}\`));
              process.exit(1);
            }
          ")

      - name: Upload documentation artifacts
        uses: actions/upload-artifact@v4
        with:
          name: pr-documentation
          path: |
            pr-docs.md
            docs-changes.diff
```

#### Multi-Project Portfolio Management
```bash
#!/bin/bash
# portfolio-tracker.sh

PORTFOLIO_ROOT="/projects"
REPORT_DIR="/reports/portfolio/$(date +%Y-%m-%d)"

mkdir -p "$REPORT_DIR"

# Generate portfolio overview
echo "# Portfolio Documentation Report" > "${REPORT_DIR}/index.md"
echo "Generated: $(date)" >> "${REPORT_DIR}/index.md"
echo "" >> "${REPORT_DIR}/index.md"

# Process each project
for project_dir in "$PORTFOLIO_ROOT"/*/; do
    if [ -d "$project_dir" ]; then
        project_name=$(basename "$project_dir")

        echo "Processing $project_name..."
        cd "$project_dir"

        # Generate project documentation
        prompt-fs-to-ai . \
            -p "src/**/*" \
            -p "*.md" \
            -p "package.json" \
            -e "node_modules" \
            -e "**/*.log" \
            -o "${REPORT_DIR}/${project_name}-docs.md"

        # Extract key metrics
        file_count=$(find src -type f 2>/dev/null | wc -l)
        lines_of_code=$(find src -name "*.{js,ts,py,java}" -exec wc -l {} \; 2>/dev/null | awk '{sum += $1} END {print sum}')

        # Add to portfolio report
        echo "## $project_name" >> "${REPORT_DIR}/index.md"
        echo "- **Files:** $file_count" >> "${REPORT_DIR}/index.md"
        echo "- **Lines of Code:** $lines_of_code" >> "${REPORT_DIR}/index.md"
        echo "- **Last Updated:** $(date)" >> "${REPORT_DIR}/index.md"
        echo "" >> "${REPORT_DIR}/index.md"
    fi
done

# Generate portfolio diff if previous report exists
PREVIOUS_REPORT=$(find /reports/portfolio -name "index.md" -mtime -7 | sort | tail -2 | head -1)
if [ -n "$PREVIOUS_REPORT" ]; then
    prompt-fs-to-ai diff \
        "$PREVIOUS_REPORT" \
        "${REPORT_DIR}/index.md" \
        -o "${REPORT_DIR}/portfolio-changes.diff"
fi

echo "Portfolio report generated: $REPORT_DIR"
```

### Custom Hooks and Extensions

#### Pre-commit Documentation Validation
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Generate documentation for staged changes
STAGED_FILES=$(git diff --cached --name-only | grep -E '\.(js|ts|py|java)$')

if [ -n "$STAGED_FILES" ]; then
    echo "Validating documentation for staged files..."

    # Create temporary documentation
    prompt-fs-to-ai . \
        -p "$STAGED_FILES" \
        -o temp-validation.md

    # Check for basic documentation completeness
    MISSING_EXPORTS=$(node -e "
        const fs = require('fs');
        const docs = fs.readFileSync('temp-validation.md', 'utf8');

        // Extract exports from staged files
        const { execSync } = require('child_process');
        const exports = execSync('git diff --cached -U0 | grep \"^+\s*export\" | sed \"s/.*export//\"', { encoding: 'utf8' });

        const missing = exports.split('\n')
            .filter(line => line.trim())
            .filter(line => !docs.includes(line.trim()));

        if (missing.length > 0) {
            console.log('⚠️  Consider documenting these new exports:');
            missing.forEach(exp => console.log('   - ' + exp.trim()));
        }
    ")

    # Cleanup
    rm -f temp-validation.md
fi

echo "Documentation validation complete."
```

These advanced integration examples demonstrate how `prompt-fs-to-ai` can be incorporated into sophisticated development workflows, from simple automation to enterprise-grade documentation management systems.

## Contributing

We welcome contributions from the community! Here's how you can help improve `prompt-fs-to-ai`:

### Development Setup

1. **Fork and Clone:**
   ```bash
   git clone https://github.com/your-username/prompt-fs-to-ai.git
   cd prompt-fs-to-ai
   ```

2. **Install Dependencies:**
   ```bash
   bun install  # or npm install
   ```

3. **Build the Project:**
   ```bash
   bun run build  # or npm run build
   ```

4. **Run Tests:**
   ```bash
   bun test       # or npm test
   bun test:watch # for continuous testing
   ```

### Development Workflow

1. **Create a Feature Branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes:**
   - Follow the existing code style (Biome linter)
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes:**
   ```bash
   bun test                    # Run all tests
   bun run test:watch         # Run tests in watch mode
   bun run build              # Ensure build passes
   bun run lint               # Check code style
   ```

4. **Submit a Pull Request:**
   - Ensure all tests pass
   - Update README.md if needed
   - Provide a clear description of changes

### Code Quality Standards

- **TypeScript**: Strict type checking enabled
- **Testing**: Add tests for new behavior where reasonable
- **Linting**: Biome configuration must pass
- **Formatting**: 2 spaces, no tabs, Unix line endings

### Reporting Issues

When reporting bugs or requesting features:

1. **Check Existing Issues:** Search before creating new ones
2. **Use Issue Templates:** Follow the provided templates
3. **Provide Details:**
   - OS and Node.js/Bun version
   - Steps to reproduce
   - Expected vs actual behavior
   - Sample files/project structure if relevant

### Types of Contributions

- **Bug Fixes:** Critical for stability
- **New Features:** Must include tests and documentation
- **Documentation:** README, code comments, examples
- **Performance:** Optimizations and memory improvements
- **Testing:** Additional test coverage

### Commit Guidelines

- Use clear, descriptive commit messages
- Reference issue numbers when applicable
- Keep commits focused on single changes
- Squash related commits before PR

### Testing Your Changes

Before submitting:
```bash
# Full test suite
bun test

# Build verification
bun run build

# Manual testing with real projects
bun run build
node bin/run.js /path/to/test/project
```

Thank you for contributing to `prompt-fs-to-ai`! 🎉

## License

MIT
