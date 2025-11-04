# Plan: Fix Manual Deployment Build Dependencies

**Date**: 2025-11-05
**Status**: Proposed
**Target**: `.github/workflows/deploy.yml`

## Problem Analysis

### Root Cause

The deployment jobs (`deploy-heartbeat` and `deploy-pulse`) download pre-built artefacts but don't ensure workspace dependencies are built before running `sam build`. When SAM invokes esbuild to bundle the Lambda function, esbuild can't resolve `@monorepo-fem/cloudwatch-log-publisher` because its `dist/index.js` doesn't exist in the deployment job's file system.

### Why This Happens

1. The `build-and-test` job creates build artefacts and uploads them
2. Deployment jobs download these artefacts
3. When `sam build` runs, it executes `esbuild.config.js`
4. esbuild tries to bundle `@monorepo-fem/cloudwatch-log-publisher` from `node_modules`
5. The package.json points to `./dist/index.js` which doesn't exist (wasn't built in this job)
6. Build fails with: `ERROR: Could not resolve "@monorepo-fem/cloudwatch-log-publisher"`

### Current Workflow Flow

```sh
build-and-test job:
  ├─ Install dependencies
  ├─ Build affected packages (using Nx)
  ├─ Test affected packages
  └─ Upload artefacts (packages/*/dist/, apps/*/dist/)

deploy-pulse job:
  ├─ Checkout
  ├─ Install dependencies
  ├─ Download artefacts ❌ (doesn't guarantee dist/ structure)
  ├─ Validate SAM template
  ├─ SAM Build
  │   └─ Runs esbuild.config.js
  │       └─ Tries to import @monorepo-fem/cloudwatch-log-publisher
  │           └─ Looks for dist/index.js ❌ FAILS
  └─ SAM Deploy (never reached)
```

## Solution Approaches Considered

### Option 1: Rebuild Workspace Dependencies Before SAM Build (Recommended)

Before running `sam build`, explicitly build the workspace dependencies that the Lambda function requires.

**Pros**:

- Simple and reliable
- Leverages pnpm's workspace resolution
- Matches local development workflow
- Easy to understand and maintain
- No changes to application code or build configs

**Cons**:

- Slightly longer build time in deployment jobs (estimated +30-60s per job)
- Rebuilds code that was already built in `build-and-test` job

**Risk Level**: Low - This is how local development works

### Option 2: Fix Artefact Paths and Trust the Download

Ensure artefacts are downloaded to exact locations and rely on them being available.

**Pros**:

- Faster deployment (no rebuild)
- More efficient use of CI/CD time

**Cons**:

- Fragile - depends on GitHub Actions artefact system behaviour
- Artefact extraction paths can be unpredictable
- Hard to debug when it fails
- Might need complex path manipulation

**Risk Level**: Medium - Artefact handling is a common source of CI/CD issues

### Option 3: Bundle Dependencies as Externals

Change esbuild config to treat workspace deps as external, then copy them manually into the Lambda package.

**Pros**:

- More explicit control over what gets bundled
- Could optimize bundle size

**Cons**:

- Requires significant refactoring of build process
- Changes deployment architecture
- More complex SAM template (need to package additional files)
- Would need to manage runtime paths differently

**Risk Level**: High - Changes fundamental architecture

### Recommendation

**Option 1** is recommended because:

1. It's the most reliable approach
2. It requires minimal changes (just adding one step per deployment job)
3. It's easy for any team member to understand and maintain
4. The performance impact is acceptable (~30-60s per deployment is negligible)
5. It matches the mental model of local development

## Detailed Implementation Plan

### Changes Required

Add a build step to both `deploy-heartbeat` and `deploy-pulse` jobs that builds workspace dependencies before SAM attempts to bundle the Lambda function.

### Deploy Heartbeat Job

**Location**: `.github/workflows/deploy.yml` lines ~177-191
**Insert After**: "Download build artefacts" step (currently line ~181)
**Insert Before**: "Validate SAM template" step (currently line ~191)

**New Step**:

```yaml
- name: Build workspace dependencies
  run: pnpm --filter @monorepo-fem/cloudwatch-log-publisher build
```

**Reasoning**:

- The `--filter` flag builds only the specific package we need
- This runs after artefacts are downloaded (in case they're useful)
- This runs before SAM build (when the dependency is needed)
- Keeps the job fast by not rebuilding everything

### Deploy Pulse Job

**Location**: `.github/workflows/deploy.yml` lines ~327-341
**Insert After**: "Download build artefacts" step (currently line ~331)
**Insert Before**: "Validate SAM template" step (currently line ~341)

**New Step**:

```yaml
- name: Build workspace dependencies
  run: pnpm --filter @monorepo-fem/cloudwatch-log-publisher build
```

**Reasoning**: Same as heartbeat - pulse-publisher explicitly depends on `@monorepo-fem/cloudwatch-log-publisher` as shown in its package.json line 28.

### Alternative Approach: Use Lerna/pnpm with Dependencies

If you want a more robust solution that automatically handles the entire dependency graph:

```yaml
- name: Build workspace dependencies
  run: pnpm --filter pulse-publisher... build
```

The `...` suffix tells pnpm to build the package and all its workspace dependencies. This is more maintainable because:

- It automatically handles the dependency graph
- If you add more workspace dependencies later, they're automatically built
- No need to manually list each dependency

**Trade-off**: Might build more than strictly necessary, but ensures correctness.

### Updated Workflow Flow

```sh
deploy-pulse job:
  ├─ Checkout
  ├─ Install dependencies
  ├─ Download artefacts (optional at this point)
  ├─ Build workspace dependencies ✓ NEW STEP
  │   └─ Builds @monorepo-fem/cloudwatch-log-publisher
  │       └─ Creates dist/index.js
  ├─ Validate SAM template
  ├─ SAM Build ✓
  │   └─ Runs esbuild.config.js
  │       └─ Imports @monorepo-fem/cloudwatch-log-publisher ✓
  │           └─ Finds dist/index.js ✓ SUCCESS
  └─ SAM Deploy ✓
```

## Testing Strategy

### Pre-Merge Testing

1. **Manual workflow trigger**: Use workflow_dispatch to manually trigger deployment to dev environment
2. **Watch for errors**: Monitor GitHub Actions logs for "Could not resolve" errors
3. **Verify builds**: Check that workspace dependencies build successfully
4. **Verify deployment**: Ensure Lambda functions deploy and pass health checks

### Validation Commands

Run locally to verify the fix would work:

```sh
# Clean start
pnpm install --frozen-lockfile

# Build workspace dependency
pnpm --filter @monorepo-fem/cloudwatch-log-publisher build

# Build app (should succeed)
pnpm --filter pulse-publisher build

# Verify dist exists
ls -la packages/cloudwatch-log-publisher/dist/
```

Expected output: Should see `index.js`, `index.d.ts`, and other build artefacts.

### Regression Testing

After the fix is merged:

1. Make a small change to `cloudwatch-log-publisher` package
2. Commit and push to main
3. Verify automatic deployment detects the change and deploys successfully
4. Verify affected detection still works correctly

## Implementation Steps

1. **Edit workflow file**: Add the new build step to both deployment jobs
2. **Commit changes**: Use descriptive commit message referencing this plan
3. **Test manually**: Trigger workflow_dispatch for dev environment
4. **Verify success**: Check GitHub Actions logs and deployment status
5. **Monitor**: Watch first automatic deployment after merge

## Rollback Plan

If the fix doesn't work or causes issues:

1. **Immediate**: Revert the commit that added the build steps
2. **Alternative**: Temporarily disable manual deployments while investigating
3. **Investigation**: Check if workspace dependencies are being built correctly
4. **Fallback**: Consider Option 2 or Option 3 if Option 1 proves insufficient

## Success Criteria

- [ ] Manual workflow dispatch completes without build errors
- [ ] Heartbeat deployment succeeds
- [ ] Pulse deployment succeeds
- [ ] No "Could not resolve" errors in logs
- [ ] Lambda functions pass health checks
- [ ] Deployment completes without manual intervention
- [ ] Build time increase is less than 90 seconds per job

## References

- [GitHub Actions Artefacts](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts)
- [pnpm filtering](https://pnpm.io/filtering)
- [esbuild bundling](https://esbuild.github.io/api/#bundle)
