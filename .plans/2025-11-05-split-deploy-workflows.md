# Plan: Split Deploy Workflows

**Date:** 2025-11-05
**Status:** Pending Review
**Author:** Claude Code
**Reviewer:** Blake Taylor

## Problem Statement

The current `deploy.yml` workflow tries to handle both automatic deployments (on push to main) and manual deployments (workflow_dispatch) in a single file. This creates complex conditional logic that's error-prone and difficult to maintain.

The complexity stems from trying to determine:

- Which event triggered the workflow (push vs manual)
- What base/head refs to use for Nx affected detection
- Whether to use user-provided inputs or defaults

## Root Cause

Attempting to handle two distinct use cases in one workflow:

1. **Automatic deployment:** Push to main → detect affected → build → deploy
2. **Manual deployment:** User triggers → choose environment/branch → detect affected → build → deploy

These have different:

- Trigger mechanisms
- Input requirements
- Environment targets
- Affected detection logic

## Proposed Solution

Split into two separate workflow files:

### 1. `deploy.yml` - Automatic Deployments Only

**Trigger:** Push to main branch only
**Purpose:** Automatically deploy affected packages to production when main is updated
**Environment:** Always production
**Affected detection:** Compare HEAD against HEAD~1

**Benefits:**

- Simple, straightforward logic
- No conditional checks needed
- Always runs build-and-test before deploy
- Clear purpose: production deployments from main

### 2. `manual-deploy.yml` - Manual Deployments Only

**Trigger:** workflow_dispatch only
**Purpose:** Allow manual deployments to any environment from any branch
**Environment:** User-selected (dev/staging/prod)
**Affected detection:** Compare selected branch against main

**Benefits:**

- Clear manual control
- Supports dev/staging environments
- Can deploy from feature branches
- Optional "deploy all" override

## Implementation Steps

### Step 1: Create `manual-deploy.yml`

Extract the workflow_dispatch configuration from `deploy.yml` into a new file.

Key changes:

- Remove push trigger
- Keep only workflow_dispatch trigger
- Remove all event type conditionals
- Simplify ref logic (always use inputs)

### Step 2: Simplify `deploy.yml`

Remove manual deployment support from the automatic workflow.

Key changes:

- Remove workflow_dispatch trigger
- Remove all input definitions
- Remove event type conditionals
- Hardcode environment to "prod"
- Simplify affected detection (always HEAD vs HEAD~1)

### Step 3: Update Affected Detection Logic

**deploy.yml (automatic):**

```yaml
BASE_REF="origin/main~1"
HEAD_REF="HEAD"
```

**manual-deploy.yml:**

```yaml
BASE_REF="origin/main"
HEAD_REF="${{ github.event.inputs.branch }}"
```

No conditionals needed - each workflow knows its context.

### Step 4: Remove Complex Conditionals

Both workflows can simplify their job dependencies:

**build-and-test:** Always runs (no if condition needed)
**deploy jobs:** Only check if package is affected (no need to check build-and-test result)

Since build-and-test always runs in both workflows, artefacts will always exist.

### Step 5: Test Both Workflows

**Test automatic deployment:**

1. Push to main with app changes
2. Verify affected detection works
3. Verify deploy to production

**Test manual deployment:**

1. Trigger from feature branch
2. Select dev environment
3. Verify deploy to dev
4. Test "deploy all" option

## File Structure

```sh
.github/workflows/
├── deploy.yml           # Automatic: main → prod
├── manual-deploy.yml    # Manual: any branch → dev/staging/prod
├── hourly-tests.yml     # Unchanged
└── daily-coverage.yml   # Unchanged
```

## Benefits of This Approach

1. **Clarity:** Each workflow has a single, clear purpose
2. **Simplicity:** No complex conditionals checking event types
3. **Maintainability:** Changes to automatic deployment don't affect manual (and vice versa)
4. **Documentation Over Memorisation:** The file name tells you what it does
5. **No Artefact Issues:** Build always runs before deploy in both workflows

## Validation Criteria

Refer to: `.plans/2025-11-05-split-deploy-workflows-doe.md`

The implementation must:

1. ✅ Create working manual-deploy.yml workflow
2. ✅ Simplify deploy.yml to remove manual deployment logic
3. ✅ Both workflows build and deploy successfully
4. ✅ No artefact download errors in either workflow
5. ✅ Pass all test cases for both workflows

## Commands to Execute

The reader should execute these commands:

### Create manual-deploy.yml

```sh
# Copy current deploy.yml as starting point
cp .github/workflows/deploy.yml .github/workflows/manual-deploy.yml
```

Then manually edit `manual-deploy.yml` following the plan's guidance to:

- Remove push trigger (keep only workflow_dispatch)
- Simplify logic for manual deployment context

### Update deploy.yml

Manually edit `deploy.yml` following the plan's guidance to:

- Remove workflow_dispatch trigger (keep only push)
- Remove input definitions
- Simplify logic for automatic deployment context

### Validate syntax

```sh
# Validate both workflow files
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/manual-deploy.yml'))"
```

### Commit changes

```sh
git add .github/workflows/deploy.yml .github/workflows/manual-deploy.yml
git commit -m "Split deploy workflows for clarity

Separate automatic deployments (push to main) from manual deployments
(workflow_dispatch) into distinct workflow files. This eliminates complex
conditional logic and makes each workflow's purpose clear.

- deploy.yml: Automatic deployments to prod on push to main
- manual-deploy.yml: Manual deployments to any environment from any branch

See: .plans/2025-11-05-split-deploy-workflows.md"
```

## Example: Simplified deploy.yml Structure

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  detect-affected:
    # Detect what changed comparing HEAD to HEAD~1

  build-and-test:
    needs: detect-affected
    # Always runs - no if condition

  deploy-heartbeat:
    needs: [detect-affected, build-and-test]
    if: needs.detect-affected.outputs.has-heartbeat == 'true'
    # Simple condition - just check if affected

  deploy-pulse:
    needs: [detect-affected, build-and-test]
    if: needs.detect-affected.outputs.has-pulse == 'true'
    # Simple condition - just check if affected
```

## Example: manual-deploy.yml Structure

```yaml
name: Manual Deploy

on:
  workflow_dispatch:
    inputs:
      branch:
        description: "Branch to deploy"
        required: true
        default: "main"
      environment:
        description: "Target environment"
        required: true
        type: choice
        options: [dev, staging, prod]
      deploy_all:
        description: "Deploy all packages"
        type: boolean

jobs:
  detect-affected:
    # Compare inputs.branch against origin/main

  build-and-test:
    needs: detect-affected
    # Always runs - no if condition

  deploy-heartbeat:
    needs: [detect-affected, build-and-test]
    if: needs.detect-affected.outputs.has-heartbeat == 'true'
    environment: ${{ github.event.inputs.environment }}

  deploy-pulse:
    needs: [detect-affected, build-and-test]
    if: needs.detect-affected.outputs.has-pulse == 'true'
    environment: ${{ github.event.inputs.environment }}
```

## Reasoning

This aligns with several principles from CLAUDE.md:

1. **Communication Over Implementation:** Clear file names communicate intent
2. **Documentation Over Memorisation:** Workflow purpose is obvious from structure
3. **Clarity Over Cleverness:** Simple, straightforward logic instead of complex conditionals
4. **Design for Unknown Maintainers:** Any team member can understand these workflows

## Questions for Reviewer

1. Should manual-deploy.yml support deploying to production, or only dev/staging?
2. Do you want to keep the concurrency control on both workflows?
3. Should we add any additional validation to prevent accidental production deploys from non-main branches?
