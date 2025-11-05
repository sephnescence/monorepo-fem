# Definition of Excellence: Reusable Workflows Refactoring

This document defines the criteria for grading the implementation of the reusable workflows refactoring. Work will be iteratively improved until it achieves a 10/10 grade across all criteria.

## Scoring Rubric

Each criterion is scored 0-10. Overall grade is the average. A score of 10/10 is required before considering the work complete.

## 1. Functional Correctness (Weight: 25%)

### 10/10 Criteria:
- ✅ All three workflows (deploy-pulse.yml, deploy-heartbeat.yml, deploy.yml) run without errors
- ✅ AWS credentials are successfully passed and authenticated via OIDC
- ✅ Deployments succeed to all three environments (dev, staging, prod)
- ✅ Lambda functions are deployed and pass health checks
- ✅ CloudWatch alarms are monitored and no false positives
- ✅ Build artefacts are correctly uploaded and downloaded between jobs
- ✅ Failure cleanup logic still works (ROLLBACK_COMPLETE handling)

### Red Flags (automatic 0/10):
- ❌ Any workflow fails with credential errors
- ❌ Deployment succeeds but Lambda function doesn't work
- ❌ Secrets are accidentally logged or exposed
- ❌ Breaking changes to existing deployments

### Validation Method:
```bash
# Run each workflow manually via GitHub Actions UI
# 1. Deploy Pulse Publisher -> dev environment -> Should succeed
# 2. Deploy Heartbeat Publisher -> dev environment -> Should succeed
# 3. Push to main -> Should trigger deploy.yml -> Should succeed

# Verify Lambda functions work
aws lambda invoke --function-name pulse-publisher-dev /tmp/test.json
aws lambda invoke --function-name heartbeat-publisher-dev /tmp/test.json
```

## 2. Code Quality & Maintainability (Weight: 20%)

### 10/10 Criteria:
- ✅ Reusable workflow has clear, descriptive input parameters
- ✅ All inputs and secrets are properly documented with descriptions
- ✅ No code duplication between workflows (DRY principle)
- ✅ Consistent naming conventions (kebab-case for inputs, SCREAMING_SNAKE_CASE for secrets in env)
- ✅ Comments explain non-obvious decisions
- ✅ Step names are clear and descriptive
- ✅ Working directories are explicit, not assumed

### Red Flags (automatic 0/10):
- ❌ Copy-pasted code blocks instead of using reusable workflow
- ❌ Hardcoded values that should be parameters
- ❌ Missing input descriptions
- ❌ Inconsistent formatting

### Validation Method:
```bash
# Manual code review
# Check: Are there any duplicated step sequences?
# Check: Are all magic strings parameterised?
# Check: Would a new team member understand this?
```

## 3. Documentation & Clarity (Weight: 20%)

### 10/10 Criteria:
- ✅ Plan document clearly explains the "why" behind decisions
- ✅ Trade-offs are explicitly documented
- ✅ Each workflow file has comments explaining its purpose
- ✅ Reusable workflow has header comments explaining usage
- ✅ Secret passing is explained with comments
- ✅ Validation commands are provided
- ✅ Rollback plan is documented

### Red Flags (automatic 0/10):
- ❌ Future maintainer would need to ask questions to understand
- ❌ No explanation of why environment block is in caller vs reusable workflow
- ❌ Secrets flow is unclear

### Validation Method:
```bash
# Ask someone unfamiliar with the codebase to review
# Questions they shouldn't need to ask:
# - Why are secrets passed explicitly?
# - Why is environment in caller not reusable workflow?
# - How do I add a new Lambda deployment?
# - What happens if deployment fails?
```

## 4. Security & Best Practices (Weight: 20%)

### 10/10 Criteria:
- ✅ Secrets are never logged or exposed
- ✅ Secrets are passed explicitly, not assumed from environment
- ✅ Minimum required permissions (id-token: write, contents: read)
- ✅ OIDC is used instead of long-lived credentials
- ✅ `required: true` on all sensitive inputs/secrets
- ✅ AWS region is explicit, not assumed
- ✅ Environment protection is preserved (approval gates work)

### Red Flags (automatic 0/10):
- ❌ Secrets visible in logs
- ❌ Overly permissive permissions (e.g., contents: write when not needed)
- ❌ Secrets optional when they should be required
- ❌ Environment protection bypassed

### Validation Method:
```bash
# Check workflow run logs in GitHub Actions
# Verify: No secret values are visible in any step output
# Verify: AWS credentials are obtained via OIDC, not access keys

# Check environment settings
# Verify: Dev/staging/prod environments still require approval if configured
```

## 5. Testing & Validation (Weight: 15%)

### 10/10 Criteria:
- ✅ All linting passes: `pnpm lerna run lint`
- ✅ All builds succeed: `pnpm lerna run build`
- ✅ All tests pass: `pnpm lerna run test`
- ✅ Manual workflow dispatch tested for each workflow
- ✅ Automatic deployment (push to main) tested
- ✅ All three environments tested (dev, staging, prod)
- ✅ Failure scenarios tested (e.g., invalid stack, rollback)

### Red Flags (automatic 0/10):
- ❌ Tests not run before declaring complete
- ❌ Only tested one environment
- ❌ Didn't test failure scenarios

### Validation Method:
```bash
# Run validation suite
pnpm lerna run lint
pnpm lerna run build
pnpm lerna run test

# Test happy path
# - Manually trigger deploy-pulse.yml -> dev -> Should succeed
# - Push to main -> Should deploy to dev -> Should succeed

# Test failure path
# - Force a deployment failure -> Should trigger cleanup
# - Verify ROLLBACK_COMPLETE handling works
```

## Overall Grading

Calculate overall grade:
```
Overall = (Functional * 0.25) + (Code Quality * 0.20) + (Documentation * 0.20) + (Security * 0.20) + (Testing * 0.15)
```

**Minimum acceptable grade: 10/10**

If grade < 10, iterate on the weakest area first, then re-evaluate.

## Iterative Improvement Process

1. **First pass**: Implement based on plan
2. **Self-review**: Grade against this rubric
3. **Identify gaps**: Focus on lowest-scoring criteria
4. **Improve**: Address gaps systematically
5. **Re-grade**: Repeat until 10/10
6. **User validation**: Have Blake test and provide feedback
7. **Final adjustments**: Address any real-world issues discovered

## Known Edge Cases to Test

1. **First-time stack creation**: Does deployment work when stack doesn't exist?
2. **Stack update**: Does deployment work when updating existing stack?
3. **Rollback scenario**: Does cleanup work when deployment fails?
4. **Concurrent deployments**: Does concurrency control work correctly?
5. **Artefact persistence**: Are build artefacts correctly passed between jobs?
6. **Health check failure**: Does deployment fail fast if Lambda health check fails?
7. **Alarm triggering**: Does deployment catch CloudWatch alarms?

## Exit Criteria

Implementation is complete when:
- ✅ Overall grade is 10/10
- ✅ All edge cases tested
- ✅ Blake has reviewed and approved the approach
- ✅ At least one successful deployment to each environment
- ✅ No outstanding questions or confusion about implementation

## Post-Implementation Monitoring

After merge, monitor:
1. First automatic deployment (push to main) - does it work?
2. First manual deployment to staging - does approval gate work?
3. First deployment failure - does cleanup work correctly?
4. Team feedback - any confusion about how to use this?

If issues found, treat as bugs and fix immediately. Update this definition if new criteria emerge.
