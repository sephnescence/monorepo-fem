# Fix Type-Only Imports & Introduce ESLint

**Date:** 2025-11-05
**Status:** In Progress
**Author:** Claude (with Blake Taylor)

## Context

During code review, we identified that `ScheduledEvent` from `aws-lambda` was imported as a value import when it should be a type-only import. Since it's only used for type annotations and never at runtime, using `import type` makes the intent explicit and allows for better tree-shaking during compilation.

This discovery prompted us to introduce ESLint to catch similar issues automatically and prevent them in the future.

## Problem Statement

1. **Existing Issues:** Two Lambda handlers (`heartbeat-publisher` and `pulse-publisher`) import `ScheduledEvent` as a value when it's only used as a type annotation
2. **Missing Tooling:** No ESLint configuration exists to enforce type-only imports or catch other code quality issues
3. **Monorepo Consistency:** Need a centralized linting strategy that works across all packages

## Solution Overview

Introduce ESLint with flat configuration (modern ESLint 9+ format) with:
- Minimal TypeScript rules focused on `consistent-type-imports`
- Import organisation via `eslint-plugin-import`
- Vitest-specific rules via `eslint-plugin-vitest` (test files only)

## Architecture Decisions

### 1. Flat Config vs Legacy Config

**Decision:** Use flat config (`eslint.config.js`)

**Reasoning:**
- ESLint 9+ default format
- Better TypeScript support out of the box
- Cleaner, more maintainable configuration
- Future-proof (legacy config will be deprecated)
- More flexible configuration composition

**Trade-offs:**
- ✅ Modern, maintainable
- ✅ Better IDE integration
- ❌ Fewer online examples (but growing)
- ❌ Some plugins may not have updated documentation

### 2. Rule Strictness Level

**Decision:** Minimal rules (just type imports) + targeted plugins

**Reasoning:**
- Low friction introduction
- Focused on solving the specific problem
- Can gradually add more rules as needed
- Team can build muscle memory before adding stricter rules
- Avoids "big bang" linting that requires fixing hundreds of issues

**Trade-offs:**
- ✅ Quick to implement
- ✅ Won't block current work
- ✅ Catches the specific issue we found
- ❌ May miss other potential issues initially
- ❌ Will need to add more rules over time

### 3. Monorepo Configuration Strategy

**Decision:** Root-level config with packages extending via automatic discovery

**Reasoning:**
- Single source of truth for linting rules
- Consistent standards across all packages
- Easier maintenance (update once, apply everywhere)
- ESLint flat config automatically discovers itself
- Nx already configured to run lint across packages

**Trade-offs:**
- ✅ Consistency across monorepo
- ✅ Simpler maintenance
- ✅ Works seamlessly with Lerna + Nx
- ❌ Less flexibility for package-specific rules (but can override if needed)
- ❌ Must ensure rules work for all package types

### 4. Plugin Selection

**Decision:** Include import organisation and Vitest plugins

**Reasoning:**
- `eslint-plugin-import`: Prevents duplicate imports, enforces consistent ordering
- `eslint-plugin-vitest`: Test-specific best practices (only applied to test files)
- Both are commonly used and well-maintained
- Import organisation reduces merge conflicts and improves readability
- Vitest rules catch common testing mistakes

**Trade-offs:**
- ✅ Catches additional common issues
- ✅ Improves code organisation
- ✅ Test-specific rules only apply where relevant
- ❌ Slightly longer initial setup
- ❌ Minor peer dependency warning (eslint-plugin-vitest expects ESLint 8, but works with 9)

## Implementation Steps

### 1. Fix Existing Type-Only Import Issues

**Files Modified:**
- `apps/heartbeat-publisher/src/index.ts:2`
- `apps/pulse-publisher/src/index.ts:2`

**Change:**
```diff
-import { ScheduledEvent } from "aws-lambda";
+import type { ScheduledEvent } from "aws-lambda";
```

**Why this matters:**
- Type-only imports are completely erased during TypeScript compilation
- Makes it explicit that this is only used for type checking
- Enables better tree-shaking and smaller bundle sizes
- Prevents accidental runtime usage of types

### 2. Install ESLint Dependencies

**Command:**
```bash
pnpm add -D -w eslint @eslint/js typescript-eslint eslint-plugin-import eslint-plugin-vitest
```

**Dependencies:**
- `eslint` (v9.39.1): Core linting engine
- `@eslint/js` (v9.39.1): ESLint's recommended JavaScript rules
- `typescript-eslint` (v8.46.3): Modern unified TypeScript ESLint package (replaces old separate packages)
- `eslint-plugin-import` (v2.32.0): Import statement validation and organisation
- `eslint-plugin-vitest` (v0.5.4): Vitest-specific testing rules

**Why workspace root (`-w`):**
- Ensures consistent versions across all packages
- Single installation for entire monorepo
- Reduces duplication and disk usage
- Simplifies dependency management

**Note:** Minor peer dependency warning with eslint-plugin-vitest expecting ESLint 8.x. This is cosmetic; the plugin works fine with ESLint 9.x.

### 3. Create Root ESLint Flat Config

**File Created:** `eslint.config.js`

**Configuration Structure:**

1. **Ignore Patterns:**
   - `dist/`: Compiled output
   - `coverage/`: Test coverage reports
   - `.nx/`: Nx cache
   - `node_modules/`: Dependencies

2. **Base Config:**
   - ESLint recommended rules (foundation)
   - TypeScript base config (parser setup)

3. **TypeScript Rules:**
   - `@typescript-eslint/consistent-type-imports`: Enforces `import type` for type-only imports
     - `prefer: "type-imports"`: Require separate type imports
     - `fixStyle: "inline-type-imports"`: Allow inline `import { type Foo }` style
   - Import plugin rules:
     - `import/no-duplicates`: Prevent duplicate imports from same module
     - `import/first`: Imports must be at top of file
     - `import/newline-after-import`: Blank line after import block
     - `import/order`: Alphabetical order within groups (builtin, external, internal, parent, sibling, index)

4. **Vitest Rules (Test Files Only):**
   - Applied only to `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`
   - Vitest recommended rules for test best practices

**Why this configuration:**
- Minimal but effective
- Auto-fixable rules where possible
- Clear separation between production and test rules
- Organized imports reduce merge conflicts
- TypeScript-aware import resolution

### 4. Update Package Lint Scripts

**Files Modified:**
- `packages/cloudwatch-log-publisher/package.json`
- `apps/heartbeat-publisher/package.json`
- `apps/pulse-publisher/package.json`

**Change:**
```diff
-"lint": "echo 'Linting not yet configured'"
+"lint": "eslint . --max-warnings 0"
```

**Why `--max-warnings 0`:**
- Treats warnings as errors in CI
- Ensures code quality standards are maintained
- Prevents "warning debt" from accumulating
- Can be overridden locally with just `pnpm lint --max-warnings 10` if needed

**Why `.` (current directory):**
- Lints all files in the package
- ESLint automatically finds the root config
- Respects ignore patterns in config
- Works with Nx caching

## Validation Strategy

### Sequential Validation Commands

1. **Lint Check:**
   ```bash
   pnpm lerna run lint
   ```
   - Validates ESLint configuration works
   - Ensures all files pass linting rules
   - Tests that ignore patterns work correctly

2. **Build Check:**
   ```bash
   pnpm lerna run build
   ```
   - Verifies TypeScript compilation succeeds
   - Ensures type changes don't break builds
   - Validates no regressions introduced

3. **Test Check:**
   ```bash
   pnpm lerna run test
   ```
   - Confirms all tests still pass
   - Validates no runtime behaviour changed
   - Ensures test files lint correctly with Vitest rules

4. **Auto-Fix Test:**
   ```bash
   pnpm lerna run lint -- --fix
   ```
   - Tests ESLint's auto-fix capability
   - Verifies fixable issues can be corrected automatically
   - Useful for future development workflow

**Why sequential:**
- Fail fast (stop at first error)
- Clear error isolation
- Matches typical CI pipeline flow
- Easier to debug when issues occur

## Benefits

### Immediate Benefits
- ✅ Caught and fixed 2 type-only import issues
- ✅ Prevents future type-only import mistakes
- ✅ Auto-fixable (can run `--fix` to correct automatically)
- ✅ Consistent code style across packages

### Long-term Benefits
- ✅ Foundation for additional linting rules
- ✅ Better code quality and maintainability
- ✅ Reduced code review burden (tooling catches simple issues)
- ✅ Improved developer experience (immediate feedback)
- ✅ Documentation via configuration (rules as code)

### Team Benefits
- ✅ Clear standards documented in code
- ✅ Auto-fixable issues don't require manual intervention
- ✅ Consistent across all team members
- ✅ IDE integration (most IDEs auto-discover ESLint config)

## Future Enhancements

### Potential Next Steps
1. **Add more TypeScript rules** (once team is comfortable):
   - `@typescript-eslint/no-unused-vars`
   - `@typescript-eslint/no-explicit-any`
   - `@typescript-eslint/strict-boolean-expressions`

2. **Add formatting** (Prettier integration):
   - Separate concerns: ESLint for quality, Prettier for formatting
   - Can use `eslint-config-prettier` to disable conflicting rules

3. **Add pre-commit hooks** (Husky + lint-staged):
   - Run linting on staged files before commit
   - Prevents bad code from entering repository
   - Fast feedback loop

4. **Add more import rules**:
   - Enforce file extension usage
   - Restrict imports between layers (architectural boundaries)

## Command Reference

### For any staff member to action this plan:

1. **Fix imports (already done in this session):**
   ```bash
   # Manually change imports or use ESLint auto-fix after setup
   ```

2. **Install dependencies:**
   ```bash
   pnpm add -D -w eslint @eslint/js typescript-eslint eslint-plugin-import eslint-plugin-vitest
   ```

3. **Create config file:**
   ```bash
   # Create eslint.config.js at repository root with contents from step 3
   ```

4. **Update package.json files:**
   ```bash
   # Update lint script in each of the 3 packages to: "eslint . --max-warnings 0"
   ```

5. **Validate:**
   ```bash
   pnpm lerna run lint
   pnpm lerna run build
   pnpm lerna run test
   ```

6. **Test auto-fix:**
   ```bash
   pnpm lerna run lint -- --fix
   ```

## Alternatives Considered

### Alternative 1: Use TSConfig to catch type imports
**Rejected because:**
- TypeScript compiler doesn't enforce consistent import style
- ESLint provides better error messages
- ESLint can auto-fix issues
- ESLint catches broader range of issues

### Alternative 2: Strict ESLint preset from the start
**Rejected because:**
- Would require fixing many existing patterns
- High friction for team adoption
- Better to introduce gradually
- Can add more rules over time

### Alternative 3: Per-package ESLint configs
**Rejected because:**
- More maintenance overhead
- Risk of inconsistency
- Harder to update rules globally
- Monorepo benefits from unified standards

### Alternative 4: Legacy ESLint config format
**Rejected because:**
- Will be deprecated in future
- Flat config is cleaner and more maintainable
- Better TypeScript support
- Future-proof choice

## Success Criteria

This implementation is successful when:
- ✅ Both type-only imports are fixed
- ✅ `pnpm lerna run lint` passes with 0 errors/warnings
- ✅ `pnpm lerna run build` succeeds
- ✅ `pnpm lerna run test` passes
- ✅ ESLint auto-fix works correctly
- ✅ Future type-only import mistakes are caught automatically
- ✅ Team can run linting locally and in CI
- ✅ This plan and definition of excellence are committed to repository

## References

- [ESLint Flat Config Documentation](https://eslint.org/docs/latest/use/configure/configuration-files)
- [typescript-eslint Documentation](https://typescript-eslint.io/)
- [eslint-plugin-import](https://github.com/import-js/eslint-plugin-import)
- [eslint-plugin-vitest](https://github.com/veritem/eslint-plugin-vitest)
- [TypeScript Type-Only Imports](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#type-only-imports-and-export)
