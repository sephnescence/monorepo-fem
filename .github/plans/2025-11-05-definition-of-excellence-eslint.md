# Definition of Excellence: ESLint Implementation

**Date:** 2025-11-05
**Related Plan:** [Fix Type-Only Imports & Introduce ESLint](./2025-11-05-fix-type-imports-add-eslint.md)

## Purpose

This document defines the specific, measurable criteria for evaluating the ESLint implementation. This is used to grade the work and ensure it meets a 10/10 standard before considering it complete.

## Scoring Rubric

The implementation is evaluated across multiple dimensions. Each dimension must score 10/10 for the overall implementation to be considered excellent.

### 1. Correctness (Weight: Critical)

**10/10 criteria:**
- ✅ Both `ScheduledEvent` imports changed from value imports to type-only imports
  - File: `apps/heartbeat-publisher/src/index.ts:2`
  - File: `apps/pulse-publisher/src/index.ts:2`
  - Syntax: `import type { ScheduledEvent } from "aws-lambda";`
- ✅ ESLint dependencies installed correctly at workspace root
  - All 5 packages present: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-import`, `eslint-plugin-vitest`
- ✅ Flat config file created at correct location: `eslint.config.js` at repository root
- ✅ All 3 package.json lint scripts updated correctly
- ✅ No syntax errors in any modified files
- ✅ No TypeScript compilation errors

**How to verify:**
```bash
# Check imports are type-only
grep "import type { ScheduledEvent }" apps/heartbeat-publisher/src/index.ts
grep "import type { ScheduledEvent }" apps/pulse-publisher/src/index.ts

# Check config exists
ls -la eslint.config.js

# Check dependencies
grep "eslint" package.json

# Verify no TypeScript errors
pnpm lerna run build
```

### 2. Functionality (Weight: Critical)

**10/10 criteria:**
- ✅ `pnpm lerna run lint` completes successfully across all packages
- ✅ Lint command produces 0 errors and 0 warnings
- ✅ ESLint correctly identifies type-import issues when introduced
- ✅ `--fix` flag successfully auto-fixes type-import issues
- ✅ Build process succeeds: `pnpm lerna run build` exits with code 0
- ✅ Test suite passes: `pnpm lerna run test` exits with code 0
- ✅ No regressions in existing functionality

**How to verify:**
```bash
# Run full validation suite
pnpm lerna run lint          # Should pass with 0 errors/warnings
pnpm lerna run build         # Should succeed
pnpm lerna run test          # Should pass all tests

# Test auto-fix capability
pnpm lerna run lint -- --fix # Should successfully fix issues

# Test that ESLint catches issues (manual test):
# 1. Temporarily change a type import back to value import
# 2. Run lint - should fail
# 3. Revert change
```

### 3. Configuration Quality (Weight: High)

**10/10 criteria:**
- ✅ Flat config uses modern ESLint 9+ syntax
- ✅ Configuration is properly typed (uses `@ts-check` comment)
- ✅ All necessary ignore patterns included (`dist/`, `coverage/`, `.nx/`, `node_modules/`)
- ✅ TypeScript rule correctly configured with both `prefer` and `fixStyle` options
- ✅ Import rules properly configured with sensible settings
- ✅ Vitest rules scoped correctly to test files only
- ✅ Import resolver configured for TypeScript and Node
- ✅ No conflicting rules
- ✅ Configuration is readable and well-structured

**How to verify:**
```bash
# Read and validate config structure
cat eslint.config.js

# Verify specific rules are present
grep "consistent-type-imports" eslint.config.js
grep "import/no-duplicates" eslint.config.js
grep "vitest" eslint.config.js

# Check file pattern matching for Vitest rules
grep "*.test.ts" eslint.config.js
```

### 4. Integration (Weight: High)

**10/10 criteria:**
- ✅ Lint scripts work from package directories: `cd apps/heartbeat-publisher && pnpm lint`
- ✅ Lint scripts work from root via Lerna: `pnpm lerna run lint`
- ✅ Nx caching works correctly (second run is faster/cached)
- ✅ Lint script uses `--max-warnings 0` to treat warnings as errors
- ✅ ESLint config is automatically discovered (no need for `--config` flag)
- ✅ Works in both terminal and IDE (VSCode/other editors auto-discover config)
- ✅ Consistent behaviour across all 3 packages

**How to verify:**
```bash
# Test from package directory
cd apps/heartbeat-publisher
pnpm lint
cd ../..

# Test from root via Lerna
pnpm lerna run lint

# Test caching (second run should be instant)
pnpm lerna run lint
pnpm lerna run lint  # Should show "[existing outputs match the cache, left as is]"

# Verify max-warnings flag
grep "max-warnings" apps/*/package.json packages/*/package.json
```

### 5. Documentation (Weight: High)

**10/10 criteria:**
- ✅ Comprehensive plan document created and committed
- ✅ Definition of Excellence document created and committed
- ✅ Plan includes detailed reasoning for all decisions
- ✅ Plan documents all trade-offs considered
- ✅ Plan includes command reference for future staff members
- ✅ Plan documents alternatives considered and why they were rejected
- ✅ Code comments in ESLint config explain non-obvious configuration choices
- ✅ Clear success criteria defined
- ✅ Future enhancement suggestions documented

**How to verify:**
```bash
# Check documents exist
ls -la .github/plans/2025-11-05-fix-type-imports-add-eslint.md
ls -la .github/plans/2025-11-05-definition-of-excellence-eslint.md

# Verify completeness (should have all sections)
grep "## Context" .github/plans/2025-11-05-fix-type-imports-add-eslint.md
grep "## Architecture Decisions" .github/plans/2025-11-05-fix-type-imports-add-eslint.md
grep "## Alternatives Considered" .github/plans/2025-11-05-fix-type-imports-add-eslint.md
```

### 6. Maintainability (Weight: Medium)

**10/10 criteria:**
- ✅ Single source of truth (root config, not duplicated)
- ✅ Easy to add more rules in the future
- ✅ Easy to add more packages to the monorepo
- ✅ Configuration is self-documenting
- ✅ Clear separation between production and test rules
- ✅ Follows ESLint and TypeScript ESLint best practices
- ✅ No unnecessary complexity
- ✅ Future staff can understand and modify without deep ESLint knowledge

**How to verify:**
```bash
# Check for single config file (no duplication)
find . -name "eslint.config.*" -o -name ".eslintrc*" | grep -v node_modules

# Verify config structure is clear
cat eslint.config.js  # Should be readable and logically organized
```

### 7. Code Quality (Weight: Medium)

**10/10 criteria:**
- ✅ No console warnings during lint execution
- ✅ No deprecated API usage
- ✅ Proper use of TypeScript types in config
- ✅ Consistent formatting throughout config file
- ✅ Proper use of ES module syntax
- ✅ No security vulnerabilities in dependencies
- ✅ Following Australian English (in documentation, as per CLAUDE.md)

**How to verify:**
```bash
# Check for warnings during execution
pnpm lerna run lint 2>&1 | grep -i "deprecated"

# Check for security issues
pnpm audit

# Verify ES module syntax
grep "export default" eslint.config.js
```

### 8. User Experience (Weight: Medium)

**10/10 criteria:**
- ✅ Clear, actionable error messages when lint fails
- ✅ Auto-fix works for common issues
- ✅ Fast execution time (< 5 seconds per package on first run)
- ✅ Cached execution is near-instant (< 1 second)
- ✅ Works out of the box (no additional setup required)
- ✅ Consistent behaviour for all team members
- ✅ IDE integration works automatically (no manual config needed)

**How to verify:**
```bash
# Test execution time
time pnpm lerna run lint

# Test cached execution
time pnpm lerna run lint

# Test error messages (temporarily break something)
# 1. Change a type import to value import
# 2. Run lint
# 3. Verify error message is clear and actionable
# 4. Revert change
```

## Overall Score Calculation

To achieve a **10/10** overall score, ALL of the following must be true:

1. **All Critical dimensions** (Correctness, Functionality) score 10/10
2. **All High weight dimensions** (Configuration Quality, Integration, Documentation) score 10/10
3. **At least 2 of 3 Medium weight dimensions** score 10/10
4. **No dimension scores below 7/10**

## Grading Process

### Phase 1: Automated Checks
Run these commands in sequence. All must pass:

```bash
# 1. Lint check
pnpm lerna run lint
# Expected: Exit code 0, no errors, no warnings

# 2. Build check
pnpm lerna run build
# Expected: Exit code 0, successful compilation

# 3. Test check
pnpm lerna run test
# Expected: Exit code 0, all tests pass

# 4. Auto-fix check
pnpm lerna run lint -- --fix
# Expected: Exit code 0, can fix issues when introduced
```

**If any automated check fails, the implementation scores < 7/10 and must be fixed.**

### Phase 2: Manual Verification

After automated checks pass, verify:

1. **File Changes:**
   - Review both changed index.ts files
   - Review eslint.config.js
   - Review all 3 package.json files
   - Verify changes match the plan

2. **Documentation:**
   - Read through plan document
   - Read through DoE document
   - Verify completeness and accuracy

3. **Configuration:**
   - Review ESLint config structure
   - Verify rules are correctly configured
   - Check ignore patterns are appropriate

4. **Integration:**
   - Run lint from package directory
   - Run lint from root
   - Verify Nx caching works

### Phase 3: Quality Assessment

For each dimension above:
1. Check each criteria point
2. Run verification commands
3. Document any issues found
4. Calculate dimension score

### Phase 4: Final Grade

If all dimensions score 10/10:
- ✅ **Grade: 10/10 - Implementation is excellent and complete**

If one or more High/Critical dimensions score < 10/10:
- ⚠️ **Grade: < 9/10 - Must address issues before completion**

If only Medium dimensions score < 10/10 but issues are minor:
- ✅ **Grade: 9/10 - Acceptable with minor improvements noted for future**

## Remediation

If the implementation does not score 10/10:

1. **Identify specific failing criteria** from rubric above
2. **Document the gap** (what's missing or incorrect)
3. **Create fix plan** (how to address each gap)
4. **Implement fixes** (address each issue systematically)
5. **Re-grade** (run through this DoE again)
6. **Repeat until 10/10**

## Success Declaration

This implementation may be declared successful when:

1. ✅ All automated checks pass (Phase 1)
2. ✅ All manual verifications confirm correct implementation (Phase 2)
3. ✅ All dimensions score 10/10 (Phase 3)
4. ✅ Overall score is 10/10 (Phase 4)
5. ✅ Both plan and DoE documents are committed to repository
6. ✅ All file changes are committed with appropriate commit message

## Future Grading

This DoE can be used to evaluate:
1. **Similar future ESLint rule additions** (adapt criteria as needed)
2. **ESLint configuration updates** (ensure changes maintain quality)
3. **New monorepo packages** (verify they integrate correctly)
4. **Team onboarding** (new members can use this to understand standards)

## Notes for Graders

- **Be objective:** Each criterion is either met (✅) or not met (❌)
- **No partial credit:** A criterion that's "mostly done" is not done
- **Test thoroughly:** Run all verification commands
- **Document issues:** If something scores < 10/10, document exactly why
- **Context matters:** The scoring is relative to the project's needs
- **Continuous improvement:** This DoE can be updated based on learnings

## Appendix: Quick Checklist

Use this for rapid validation:

```
□ Both type imports fixed
□ ESLint dependencies installed
□ Flat config created and correct
□ All 3 lint scripts updated
□ `pnpm lerna run lint` passes
□ `pnpm lerna run build` succeeds
□ `pnpm lerna run test` passes
□ Auto-fix works
□ Plan document complete
□ DoE document complete
□ No regressions
□ Nx caching works
□ Works from package and root
□ IDE integration works
□ Documentation is Australian English
```

If all boxes are checked (✅), the implementation is 10/10.
