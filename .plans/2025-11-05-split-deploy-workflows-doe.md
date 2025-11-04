# Definition of Excellence: Split Deploy Workflows

**Plan Reference:** `.plans/2025-11-05-split-deploy-workflows.md`
**Date:** 2025-11-05
**Target Score:** 10/10

## Overview

This document defines the criteria for considering the workflow split complete and excellent. Each criterion is scored independently, and all must achieve full marks for a 10/10 overall grade.

## Scoring Criteria

### 1. Correctness (3 points)

**3/3 - Excellent:**

- `deploy.yml` only triggers on push to main
- `manual-deploy.yml` only triggers on workflow_dispatch
- Both workflows successfully build and deploy affected packages
- No artefact download errors in either workflow
- Affected detection works correctly in both contexts
- Environment targeting works as expected

**2/3 - Good:**

- Workflows mostly work but have edge cases
- Occasional failures or incorrect behaviour
- Some conditional logic remains that shouldn't

**1/3 - Needs Improvement:**

- Workflows partially work but errors occur
- Logic is still complex or unclear
- Some scenarios not handled

**0/3 - Unacceptable:**

- Artefact errors still occur
- Workflows don't deploy successfully
- Complex conditionals remain

### 2. Simplicity (2 points)

**2/2 - Excellent:**

- No event type conditionals (if `workflow_dispatch` vs if `push`)
- No complex ref selection logic
- build-and-test always runs (no if condition)
- Deploy jobs only check if package is affected
- Each workflow has clear, single purpose
- Code is self-documenting

**1/2 - Needs Improvement:**

- Some unnecessary complexity remains
- Logic could be clearer
- Conditionals exist but are simpler than before

**0/2 - Unacceptable:**

- Still has complex conditionals
- Logic is unclear or confusing
- No meaningful simplification achieved

### 3. Testing (2 points)

**2/2 - Excellent:**

- All automatic deployment test cases pass
- All manual deployment test cases pass
- Edge cases tested and documented
- Test results documented with workflow run links
- Both workflows validated in practice

**1/2 - Needs Improvement:**

- Only some test cases executed
- Results not fully documented
- Edge cases not considered

**0/2 - Unacceptable:**

- No testing performed
- Changes pushed without verification

### 4. Documentation (2 points)

**2/2 - Excellent:**

- Commit message clearly explains the split
- Commit references the plan document
- Plan document is comprehensive
- DoE document (this file) is complete
- Workflow names clearly indicate purpose
- Comments added if any complex logic remains

**1/2 - Needs Improvement:**

- Basic documentation present but lacks detail
- Commit message doesn't reference plan
- Some context missing

**0/2 - Unacceptable:**

- No documentation
- Unclear commit messages
- Plan not created or incomplete

### 5. Maintainability (1 point)

**1/1 - Excellent:**

- Clear separation of concerns
- Each workflow is independently understandable
- Future changes to one won't affect the other
- No code duplication (or justified if present)
- Follows GitHub Actions best practices

**0/1 - Unacceptable:**

- Workflows are still coupled
- Changes are fragile
- Difficult to maintain going forward

## Detailed Test Specifications

### Automatic Deployment Tests (deploy.yml)

#### Test Case 1: Push to Main with Heartbeat Changes

**Setup:**

```sh
git checkout main
git pull origin main
git checkout -b test-auto-heartbeat
echo "// test change" >> apps/heartbeat-publisher/src/index.ts
git add apps/heartbeat-publisher/src/index.ts
git commit -m "feat: test automatic heartbeat deployment"
git push origin test-auto-heartbeat
# Create and merge PR to main
```

**Expected Behaviour:**

- Workflow triggers automatically on merge to main
- `detect-affected` detects heartbeat-publisher
- `build-and-test` runs (no if condition)
- `deploy-heartbeat` runs (heartbeat is affected)
- `deploy-pulse` skips (pulse not affected)
- Deploys to production environment

**Verification:**

- Artefact upload succeeds
- Artefact download succeeds in deploy-heartbeat
- Heartbeat deploys to prod
- Pulse does not deploy

#### Test Case 2: Push to Main with Shared Package Changes

**Setup:**

```sh
git checkout main
git checkout -b test-auto-shared
echo "// test change" >> packages/cloudwatch-log-publisher/src/index.ts
git add packages/cloudwatch-log-publisher/src/index.ts
git commit -m "feat: test automatic shared package deployment"
git push origin test-auto-shared
# Create and merge PR to main
```

**Expected Behaviour:**

- Workflow triggers automatically
- Both apps detected as affected
- `build-and-test` runs
- Both deploy jobs run
- Both deploy to production

**Verification:**

- Artefact upload succeeds
- Both deploy jobs download artefacts successfully
- Both apps deploy to prod
- No manual intervention needed

### Manual Deployment Tests (manual-deploy.yml)

#### Test Case 3: Manual Deploy from Feature Branch to Dev

**Setup:**

```sh
git checkout -b feature-test-manual
echo "// test change" >> apps/pulse-publisher/src/index.ts
git add apps/pulse-publisher/src/index.ts
git commit -m "feat: test manual deployment"
git push origin feature-test-manual

# Trigger workflow manually
gh workflow run manual-deploy.yml \
  --field branch=feature-test-manual \
  --field environment=dev \
  --field deploy_all=false
```

**Expected Behaviour:**

- Workflow triggers manually
- Compares feature-test-manual against origin/main
- Detects pulse-publisher as affected
- `build-and-test` runs
- `deploy-pulse` runs targeting dev environment
- `deploy-heartbeat` skips

**Verification:**

- Artefact upload succeeds
- Pulse deploys to dev environment
- Heartbeat does not deploy
- Can select branch and environment

#### Test Case 4: Manual Deploy All to Staging

**Setup:**

```sh
# No changes needed - testing deploy_all option
gh workflow run manual-deploy.yml \
  --field branch=main \
  --field environment=staging \
  --field deploy_all=true
```

**Expected Behaviour:**

- Workflow triggers manually
- deploy_all forces all packages to be marked as affected
- `build-and-test` runs
- Both deploy jobs run
- Both deploy to staging environment

**Verification:**

- All packages deploy regardless of actual changes
- Deploys to staging environment
- deploy_all override works correctly

## Grading Checklist

Use this checklist when grading the implementation:

- [ ] **Correctness (3/3)**

  - [ ] deploy.yml only has push trigger
  - [ ] manual-deploy.yml only has workflow_dispatch trigger
  - [ ] No event type conditionals in either workflow
  - [ ] Both workflows build and deploy successfully
  - [ ] No artefact download errors

- [ ] **Simplicity (2/2)**

  - [ ] build-and-test has no if condition in both workflows
  - [ ] Deploy jobs only check package affection (no build-and-test.result checks needed)
  - [ ] Ref logic is straightforward (no conditionals)
  - [ ] No complex nested conditionals remain
  - [ ] Each workflow is independently readable

- [ ] **Testing (2/2)**

  - [ ] Test Case 1 executed and documented
  - [ ] Test Case 2 executed and documented
  - [ ] Test Case 3 executed and documented
  - [ ] Test Case 4 executed and documented
  - [ ] All test cases pass

- [ ] **Documentation (2/2)**

  - [ ] Plan document created and complete
  - [ ] DoE document created (this file)
  - [ ] Commit message references plan
  - [ ] Workflow names are descriptive

- [ ] **Maintainability (1/1)**
  - [ ] Clear separation between automatic and manual
  - [ ] No code duplication or justified if present
  - [ ] Future changes are isolated

## Regression Testing

After implementation, verify existing functionality still works:

### deploy.yml (Automatic)

1. **Normal Push Scenarios:**

   - Push to main with heartbeat changes → deploys heartbeat to prod
   - Push to main with pulse changes → deploys pulse to prod
   - Push to main with shared package → deploys both to prod

2. **No Workflow Dispatch:**
   - Cannot manually trigger deploy.yml
   - No environment selection available
   - No branch selection available

### manual-deploy.yml (Manual)

1. **Manual Trigger Options:**

   - Can select any branch
   - Can select dev/staging/prod environment
   - Can toggle deploy_all option

2. **No Automatic Trigger:**
   - Does not trigger on push to main
   - Only runs when manually triggered

### Both Workflows

1. **Build and Deploy:**

   - Build always runs before deploy
   - Artefacts always uploaded
   - Artefacts always available for download
   - No artefact not found errors

2. **Concurrency Control:**
   - Concurrent deployments prevented if configured
   - Queue behaviour works correctly

## Success Metrics

The implementation achieves 10/10 when:

```sh
Total Score = Correctness + Simplicity + Testing + Documentation + Maintainability
            = 3 + 2 + 2 + 2 + 1
            = 10/10
```

All criteria must achieve full marks.

## Validation Commands

Run these commands to validate the implementation:

```sh
# Validate both YAML files
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/manual-deploy.yml'))"

# Check git status
git status

# Verify commit message
git log -1 --pretty=format:"%B"

# Test automatic deployment (requires PR to main)
# Test manual deployment
gh workflow run manual-deploy.yml \
  --field branch=main \
  --field environment=dev \
  --field deploy_all=false
```

## Complexity Reduction Metrics

Measure simplification success by counting removed conditionals:

**Before (single workflow):**

- Event type checks: ~6 instances
- Ref selection logic: ~6 instances
- Input vs default checks: ~4 instances
- Complex if conditions: ~8 instances

**After (split workflows):**

- Event type checks: 0 instances
- Ref selection logic: 0 instances (hardcoded per workflow)
- Input vs default checks: 0 instances
- Complex if conditions: 0 instances

**Target:** Remove 100% of event-type conditionals and ref selection logic.

## Sign-off

When all criteria are met:

- Implementation Date: **\_\_\_**
- Final Score: **\_\_\_** / 10
- Implemented By: **\_\_\_**
- Reviewed By: **\_\_\_**
- Production Deployment Date: **\_\_\_**

**Notes:**
(Any additional observations, edge cases discovered, or future considerations)
