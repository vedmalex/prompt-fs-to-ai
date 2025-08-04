# Technical Specification: CLI Pattern Option Refactoring

**Task**: Refactor CLI Pattern Option for Multiple Values
**Project**: `project-to-ai-prompt`
**Objective**: Modify the `-p, --pattern` CLI option to accept multiple space-separated glob patterns, making its behavior consistent with the `-e, --exclude` option.

## 1. Current State Analysis

### 1.1 Problem Description
The current implementation has inconsistent user experience between inclusion patterns (`-p`) and exclusion patterns (`-e`):
- `-e` option uses variadic syntax: `-e pattern1 pattern2 pattern3`
- `-p` option requires flag repetition: `-p pattern1 -p pattern2 -p pattern3`

### 1.2 Current Implementation Details
```typescript
// Current -e option (desired behavior)
.option('-e, --exclude <patterns...>', '...', [])

// Current -p option (to be changed)
.option('-p, --pattern <pattern>', '...', (value, previous) => { ... }, ['**/*'])
```

## 2. Implementation Requirements

### 2.1 Core Changes Required

#### 2.1.1 Update CLI Option Definition
**File**: `src/index.ts`
**Function**: `runCLI()`

**Current Code:**
```typescript
.option('-p, --pattern <pattern>', 'Glob pattern for files to include (can be used multiple times)', (value, previous) => {
  if (previous === undefined || (Array.isArray(previous) && previous.length === 1 && previous[0] === '**/*')) {
    return [value];
  }
  return Array.isArray(previous) ? [...previous, value] : [previous, value];
}, ['**/*'])
```

**Required New Code:**
```typescript
.option('-p, --pattern <patterns...>', 'Glob patterns for files to include (space-separated)', [])
```

#### 2.1.2 Update Action Handler
**Current Logic:**
```typescript
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
    process.exit(1);
  }
});
```

**Required New Logic:**
```typescript
.action(async (directory, options) => {
  try {
    const resolvedDirectory = path.resolve(process.cwd(), directory);
    // If no patterns are provided via the CLI, use the default '**/*'
    const patternsToUse = options.pattern.length > 0 ? options.pattern : ['**/*'];

    // Create a new options object for generateMarkdownDoc to ensure correct command string
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
    process.exit(1);
  }
});
```

### 2.2 Test Updates Required

#### 2.2.1 Remove Obsolete Test
**File**: `src/index.test.ts`
**Action**: Remove test case for custom accumulator function

**Test to Remove:**
```typescript
it('should handle multiple -p flags correctly', async () => {
  // ... test implementation for the old accumulator
});
```

#### 2.2.2 Verify Existing Tests
- All existing integration tests should continue to pass
- Core logic in `generateMarkdownDoc` remains unchanged
- `processMultiplePatterns` function should not be affected

## 3. Functional Requirements

### 3.1 User Experience Requirements
1. **Single Flag Multiple Values**: `prompt-fs-to-ai . -p "src/**/*.ts" "test/**/*.ts"`
2. **Multiple Flag Compatibility**: `prompt-fs-to-ai . -p "src/**/*.ts" -p "test/**/*.ts"`
3. **Default Pattern Handling**: When no `-p` provided, use `**/*`
4. **Accurate Command Generation**: Output markdown reflects actual patterns used

### 3.2 Technical Requirements
1. **Framework**: Uses `commander.js` variadic argument syntax
2. **Backward Compatibility**: Existing command patterns continue to work
3. **Error Handling**: Maintain existing error handling patterns
4. **Testing**: 85% minimum code coverage, 100% test success rate

## 4. Quality Assurance Criteria

### 4.1 Functional Validation
- [ ] CLI accepts space-separated patterns via single `-p` flag
- [ ] CLI maintains compatibility with multiple `-p` flag usage
- [ ] Default pattern `**/*` applied when no `-p` provided
- [ ] Generated command string accurately reflects patterns used
- [ ] All existing functionality preserved

### 4.2 Technical Validation
- [ ] All tests pass (excluding intentionally removed test)
- [ ] Code coverage meets 85% minimum requirement
- [ ] No breaking changes to existing API
- [ ] Error handling maintains current behavior
- [ ] Performance characteristics unchanged

## 5. Implementation Strategy

### 5.1 Development Approach
This specification is comprehensive and implementation-ready, enabling **fast-track to IMPLEMENT phase**:
- Skip VAN, PLAN, CREATIVE phases
- Proceed directly to implementation based on detailed specification
- Enhanced QA validation against original specification requirements

### 5.2 Risk Mitigation
- Maintain backward compatibility with existing command patterns
- Preserve existing error handling and performance characteristics
- Comprehensive test coverage to prevent regressions
- Validate command string generation accuracy

## 6. Acceptance Criteria

1. ✅ **Multiple Pattern Support**: CLI accepts multiple patterns via single `-p` flag with space-separated values
2. ✅ **Backward Compatibility**: CLI remains compatible with multiple `-p` flag usage
3. ✅ **Default Behavior**: Proper default pattern `**/*` when no `-p` provided
4. ✅ **Command Generation**: Accurate command string in output markdown file
5. ✅ **Test Validation**: All tests pass with updated test suite
6. ✅ **Coverage Requirements**: 85% minimum code coverage maintained
7. ✅ **Quality Standards**: 100% test success rate achieved