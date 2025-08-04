# Task Definition: CLI Pattern Option Refactoring

**Task ID:** 2025-08-04_TASK-002_cli-pattern-refactoring
**Created:** 2025-08-04_13-08
**Status:** ACTIVE
**Current Phase:** VAN

## Objective
Refactor the CLI pattern option (`-p, --pattern`) to support multiple space-separated values, making its behavior consistent with the exclude option (`-e, --exclude`).

## Scope
- Modify `src/index.ts` to change `-p` option definition from custom accumulator to variadic arguments
- Update CLI action handler to properly handle default patterns
- Update tests in `src/index.test.ts` to reflect the changes
- Ensure backward compatibility and maintain command generation accuracy

## Success Criteria
✅ CLI accepts multiple patterns via single `-p` flag with space-separated values
✅ CLI remains compatible with multiple `-p` flag usage
✅ Default pattern `**/*` applied when no `-p` flag provided
✅ Generated command string accurately reflects patterns used
✅ All tests pass (excluding intentionally removed obsolete test)
✅ 85% minimum code coverage maintained
✅ 100% test success rate achieved

## Context
This task implements a comprehensive specification provided by the user that includes detailed VAN analysis, planning, and creative phases already completed. The specification is implementation-ready and will be fast-tracked to IMPLEMENT phase.

## Files to Modify
- `src/index.ts` - Main CLI implementation
- `src/index.test.ts` - Test suite updates

## Acceptance Criteria
1. Multiple patterns accepted via single `-p` flag with space-separated values
2. Backward compatibility with multiple `-p` flag usage maintained
3. Proper default pattern handling when no `-p` provided
4. Accurate command string generation in output markdown
5. Complete test suite validation with updated test cases