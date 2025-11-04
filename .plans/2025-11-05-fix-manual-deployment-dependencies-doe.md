# Definition of Excellence: Fix Manual Deployment Build Dependencies

**Date**: 2025-11-05
**Related Plan**: `2025-11-05-fix-manual-deployment-dependencies.md`

## Scoring Criteria

This implementation will be considered excellent (10/10) when ALL criteria below are met.

---

## 1. Functional Requirements (4 points)

### 1.1 Manual Workflow Dispatch Succeeds (1 point)

**Test**: Trigger workflow using workflow_dispatch for dev environment

**Validation**:

```sh
# Via GitHub UI:
# 1. Go to Actions tab
# 2. Select "Deploy" workflow
# 3. Click "Run workflow"
# 4. Select "dev" environment
# 5. Click "Run workflow"
```

**Success Criteria**:

- [ ] Workflow completes with green checkmark
- [ ] All jobs complete successfully
- [ ] No red X marks in the workflow run

**Evidence**: Screenshot or link to successful workflow run

---

### 1.2 Heartbeat Deployment Succeeds (1 point)

**Test**: Verify heartbeat-publisher deployment job completes

**Validation**:
Check GitHub Actions logs for the `deploy-heartbeat` job

**Success Criteria**:

- [ ] "Build workspace dependencies" step completes successfully
- [ ] "SAM Build" step completes without errors
- [ ] "SAM Deploy" step completes successfully
- [ ] No "Could not resolve" errors appear in logs
- [ ] CloudFormation stack reaches UPDATE_COMPLETE or CREATE_COMPLETE state

**Evidence**: Log excerpt showing successful build and deployment

---

### 1.3 Pulse Deployment Succeeds (1 point)

**Test**: Verify pulse-publisher deployment job completes

**Validation**:
Check GitHub Actions logs for the `deploy-pulse` job

**Success Criteria**:

- [ ] "Build workspace dependencies" step completes successfully
- [ ] "SAM Build" step completes without errors
- [ ] "SAM Deploy" step completes successfully
- [ ] No "Could not resolve" errors appear in logs
- [ ] CloudFormation stack reaches UPDATE_COMPLETE or CREATE_COMPLETE state

**Evidence**: Log excerpt showing successful build and deployment

---

### 1.4 Lambda Functions Are Healthy (1 point)

**Test**: Verify deployed Lambda functions are invocable

**Validation**:
Check the "Health check - Invoke Lambda" steps in deployment jobs

**Success Criteria**:

- [ ] Heartbeat Lambda returns status code 200
- [ ] Pulse Lambda returns status code 200
- [ ] No function errors in the response
- [ ] CloudWatch Alarms step passes (no alarms in ALARM state)

**Evidence**: Health check log output showing successful invocations

---

## 2. Correctness (3 points)

### 2.1 No Resolution Errors (1 point)

**Test**: Search GitHub Actions logs for resolution errors

**Validation**:

```sh
# In GitHub Actions logs, search for:
"Could not resolve"
"was not found on the file system"
"Build failed"
```

**Success Criteria**:

- [ ] Zero occurrences of "Could not resolve @monorepo-fem/cloudwatch-log-publisher"
- [ ] Zero occurrences of module resolution errors
- [ ] esbuild completes successfully

**Evidence**: Confirmation that search returns no results

---

### 2.2 Dependencies Built Before SAM (1 point)

**Test**: Verify build order in GitHub Actions logs

**Validation**:
Check the timing and order of steps in deployment jobs

**Success Criteria**:

- [ ] "Build workspace dependencies" runs after "Download build artefacts"
- [ ] "Build workspace dependencies" runs before "SAM Build"
- [ ] Log shows: "Building Lambda function with esbuild..." followed by "Build completed successfully!"
- [ ] `dist/` directory exists for cloudwatch-log-publisher before SAM build runs

**Evidence**: Log timestamps showing correct execution order

---

### 2.3 Zero Manual Intervention Required (1 point)

**Test**: Deployment completes without human interaction

**Validation**:
Review entire workflow run from start to finish

**Success Criteria**:

- [ ] No workflow pauses or waits for approval (except environment protection rules)
- [ ] No failed steps requiring retry
- [ ] No manual fixes needed after deployment
- [ ] Workflow runs end-to-end automatically

**Evidence**: Clean workflow run with no intervention points

---

## 3. Performance (1 point)

### 3.1 Acceptable Build Time Increase (1 point)

**Test**: Compare deployment time before and after changes

**Validation**:

```sh
# Compare workflow run times:
# Before: Find a recent successful manual deployment (if any exist)
# After: Current workflow run time

# Check individual step times in GitHub Actions
```

**Success Criteria**:

- [ ] "Build workspace dependencies" step completes in less than 90 seconds
- [ ] Total deployment job time increases by less than 2 minutes
- [ ] Overall workflow remains under 10 minutes (reasonable threshold)

**Evidence**:

- Time shown in "Build workspace dependencies" step
- Total job duration from GitHub Actions

**Acceptable Performance**:

- Excellent: < 60 seconds added
- Good: 60-90 seconds added
- Acceptable: 90-120 seconds added
- Poor: > 120 seconds added

---

## 4. Maintainability (2 points)

### 4.1 No Application Code Changes (1 point)

**Test**: Review git diff for the fix

**Validation**:

```sh
git diff HEAD~1 HEAD
```

**Success Criteria**:

- [ ] Only `.github/workflows/deploy.yml` is modified
- [ ] No changes to `esbuild.config.js` files
- [ ] No changes to `package.json` files
- [ ] No changes to application source code
- [ ] No changes to build scripts

**Evidence**: Git diff showing only workflow changes

**Reasoning**: The fix should be isolated to the CI/CD pipeline, not mixed with application changes. This makes it easy to understand, review, and potentially revert.

---

### 4.2 Documentation and Knowledge Transfer (1 point)

**Test**: Review commit message and plan documentation

**Validation**:
Check git commit for this change

**Success Criteria**:

- [ ] Commit message references this plan file
- [ ] Commit message explains why the change was needed (not just what changed)
- [ ] Plan file exists in `.plans/` directory
- [ ] Definition of Excellence file exists in `.plans/` directory
- [ ] Any team member can understand the change from documentation alone

**Example Commit Message**:

```sh
Fix manual deployment build dependencies

Add workspace dependency build step before SAM build in deployment
jobs to ensure @monorepo-fem/cloudwatch-log-publisher dist/ exists
when esbuild attempts to bundle Lambda functions.

Fixes the "Could not resolve" error in manual workflow deployments.

See .plans/2025-11-05-fix-manual-deployment-dependencies.md for
detailed reasoning and alternatives considered.
```

**Evidence**: Commit message follows best practices for future maintainers

---

## Grading System

### Point Allocation

- **Functional Requirements**: 4 points
- **Correctness**: 3 points
- **Performance**: 1 point
- **Maintainability**: 2 points
- **Total**: 10 points

### Grade Interpretation

- **10/10**: Perfect implementation, all criteria met
- **9/10**: Excellent, minor issue in one area
- **8/10**: Very good, small gaps in 1-2 areas
- **7/10**: Good, noticeable gaps but functional
- **6/10**: Acceptable, works but needs improvement
- **< 6/10**: Needs significant revision

### Minimum Acceptance Criteria

To be considered "complete", the implementation MUST achieve:

- All Functional Requirements (4/4 points)
- All Correctness criteria (3/3 points)
- Minimum 1/2 Maintainability points

Performance can be traded off if necessary, but must not exceed 180 seconds added time.

---

## Validation Workflow

### Step 1: Pre-Deployment Checklist

```sh
# Verify changes are minimal
git status
git diff .github/workflows/deploy.yml

# Verify plan files exist
ls -la .plans/2025-11-05-fix-manual-deployment-dependencies*
```

### Step 2: Trigger Manual Deployment

1. Commit and push changes to a branch
2. Create PR for review
3. After approval, merge to main
4. Manually trigger workflow_dispatch for dev environment
5. Monitor workflow run in GitHub Actions

### Step 3: Collect Evidence

- [ ] Take screenshot of successful workflow run
- [ ] Save relevant log excerpts
- [ ] Note build time metrics
- [ ] Document any issues encountered

### Step 4: Grade Implementation

Go through each criterion above and mark as complete or incomplete.

### Step 5: Iterate if Needed

If score is below 8/10:

1. Identify which criteria failed
2. Implement fixes
3. Re-test
4. Re-grade

Repeat until score reaches 8/10 or above.

---

## Post-Implementation Review

After achieving 10/10, answer these questions for continuous improvement:

1. **What went well?**

   - Document what worked perfectly

2. **What could be improved?**

   - Even with 10/10, there might be future optimisations

3. **What did we learn?**

   - Capture insights for future similar tasks

4. **Would we change our approach next time?**
   - Reflect on alternatives considered

---

## Success Declaration

Implementation is declared excellent when:

```sh
Functional Requirements:    4/4 ✓
Correctness:                3/3 ✓
Performance:                1/1 ✓
Maintainability:            2/2 ✓
─────────────────────────────────
TOTAL SCORE:              10/10 ✓

Status: EXCELLENT - Ready for production
```

Signed off by: [Your name]
Date: [Date of sign-off]
Evidence: [Links to workflow runs and documentation]
