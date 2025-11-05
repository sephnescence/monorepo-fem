# Plan: Refactor to Reusable Workflows with Explicit Secret Passing

## Context

Currently, the deployment workflows (deploy-pulse.yml, deploy-heartbeat.yml, and deploy.yml) are failing with AWS credential errors. The root cause is that these workflows use the `environment:` block for GitHub environment protection, but the AWS secrets aren't being passed through correctly.

The workflows are structured as standalone workflows that reference `secrets.AWS_OIDC_DEPLOY_ROLE_ARN`, but when using GitHub Environments, secrets need to be either:

1. Configured at the environment level in GitHub Settings, OR
2. Passed explicitly from a calling workflow

We're choosing option 2 to make the secret flow explicit and maintainable.

## Problem Statement

- **Current issue**: `aws-actions/configure-aws-credentials@v4` fails with "Credentials could not be loaded"
- **Root cause**: Workflows use `environment:` blocks but secrets aren't available in that scope
- **Affected files**: deploy-pulse.yml:93, deploy-heartbeat.yml:93, deploy.yml:188 and deploy.yml:338

## Architectural Decision

We will create reusable workflows that accept secrets as explicit inputs. This approach:

- Makes secret flow transparent and auditable
- Allows future team members to understand exactly what credentials are being used
- Enables better testing and validation (can pass different credentials for different environments)
- Follows GitHub's recommended pattern for shared workflows in monorepos

## Solution Architecture

### Phase 1: Create Reusable Workflow Foundation

Create `.github/workflows/reusable-deploy-lambda.yml` - a reusable workflow that handles the common deployment pattern for our Lambda functions.

**Key design decisions:**

1. **Inputs over environment variables**: Use workflow inputs for configuration (app name, environment) to make calls explicit
2. **Explicit secret passing**: Require caller to pass AWS credentials rather than assuming they exist
3. **Single responsibility**: This workflow handles deploy only, not build/test (those remain in callers)

**Why separate build from deploy:**

- Build artefacts are environment-agnostic
- Allows parallel deployment to multiple environments from same build
- Reduces deployment time (no rebuild needed)
- Follows AWS SAM best practices

### Phase 2: Update Individual Deployment Workflows

Modify deploy-pulse.yml and deploy-heartbeat.yml to:

1. Keep their build-and-test jobs (these are app-specific)
2. Replace deploy job with call to reusable workflow
3. Explicitly pass secrets using `secrets:` parameter

**Critical implementation detail:**
When calling a reusable workflow from a job that uses `environment:`, the environment-level secrets ARE available to pass to the reusable workflow. This is the key - the caller job gets secrets from its environment, then explicitly passes them to the reusable workflow.

### Phase 3: Update Orchestration Workflow

Modify deploy.yml to:

1. Keep detect-affected and build-and-test jobs (orchestration-specific)
2. Replace deploy-heartbeat and deploy-pulse jobs with calls to reusable workflow
3. Explicitly pass secrets from environment scope

## Implementation Steps

### Step 1: Create Reusable Workflow

**File**: `.github/workflows/reusable-deploy-lambda.yml`

**Command**: Create this file manually (no CLI tool available for GitHub Actions workflow creation)

**Structure**:

```yaml
name: Reusable Lambda Deployment

on:
  workflow_call:
    inputs:
      app-name:
        description: "Name of the app to deploy (e.g., pulse-publisher)"
        required: true
        type: string
      environment:
        description: "Target environment (dev/staging/prod)"
        required: true
        type: string
      working-directory:
        description: "Working directory for the app"
        required: true
        type: string
      output-key:
        description: "CloudFormation output key for function name"
        required: true
        type: string
    secrets:
      aws-oidc-role-arn:
        description: "AWS OIDC role ARN for deployment"
        required: true

jobs:
  deploy:
    name: Deploy to ${{ inputs.environment }}
    runs-on: ubuntu-latest
    # Note: environment block is in the CALLER, not here
    steps:
      # ... deployment steps ...
```

**Key points**:

- Uses `workflow_call` trigger (not `workflow_dispatch`)
- Secrets are defined in `secrets:` section, not referenced directly
- `required: true` ensures callers don't forget to pass secrets
- Environment block intentionally NOT in reusable workflow (stays in caller for proper secret scoping)

**Why environment stays in caller:**

- GitHub resolves environment secrets at the job level that declares `environment:`
- Moving environment to reusable workflow would require secrets configured at environment level
- Keeping environment in caller lets us pass repository-level secrets that are available in environment scope

### Step 2: Update deploy-pulse.yml

**File**: `.github/workflows/deploy-pulse.yml`

**Changes**:

1. Keep `build-and-test` job as-is (lines 27-57)
2. Replace `deploy` job (lines 60-206) with:

```yaml
deploy:
  name: Deploy to ${{ github.event.inputs.environment }}
  needs: build-and-test
  uses: ./.github/workflows/reusable-deploy-lambda.yml
  with:
    app-name: pulse-publisher
    environment: ${{ github.event.inputs.environment }}
    working-directory: apps/pulse-publisher
    output-key: PulsePublisherFunction
  secrets:
    aws-oidc-role-arn: ${{ secrets.AWS_OIDC_DEPLOY_ROLE_ARN }}
  # IMPORTANT: environment block goes here for secret resolution
  # GitHub will resolve secrets from this environment, then pass to reusable workflow
```

**Reasoning:**

- `uses: ./.github/workflows/...` references local reusable workflow
- `with:` passes configuration inputs
- `secrets:` explicitly passes AWS credentials
- Environment protection still applies at this level

**WAIT - Critical correction:**
Actually, I need to reconsider. When a job uses `uses:` to call a reusable workflow, you can't also use `environment:` on that same job. The environment protection needs to be declared in the reusable workflow itself OR we need a different structure.

Let me revise the approach...

## Revised Solution Architecture

After deeper consideration of GitHub Actions constraints:

**Problem:** A job can't both call a reusable workflow (`uses:`) AND declare an environment block. They're mutually exclusive.

**Solution Options:**

**Option A: Environment in reusable workflow**

- Reusable workflow declares `environment: ${{ inputs.environment }}`
- Secrets must be configured at environment level in GitHub Settings
- This defeats our purpose of explicit secret passing

**Option B: Split into two workflows (recommended)**

- Create reusable workflow for deployment steps ONLY (no environment block)
- Calling workflow has a job with `environment:` that gets secrets, then calls reusable workflow
- This is actually what we're already trying to do, but needs correct syntax

**Option C: Composite Actions**

- Create a composite action (not workflow) for shared logic
- Job can use `environment:` and call composite action steps
- More complex but maximum flexibility

**Recommended: Option B with corrected understanding**

The key insight: When you have a job with `environment:`, that job can call a reusable workflow and pass the environment's secrets to it. The environment protection happens at the calling job level.

## Corrected Implementation

### Step 1: Create Reusable Workflow (No environment block)

```yaml
name: Reusable Lambda Deployment

on:
  workflow_call:
    inputs:
      app-name:
        required: true
        type: string
      environment:
        required: true
        type: string
      working-directory:
        required: true
        type: string
      output-key:
        required: true
        type: string
      artefact-name:
        required: true
        type: string
    secrets:
      aws-oidc-role-arn:
        required: true

jobs:
  deploy:
    name: Deploy ${{ inputs.app-name }} to ${{ inputs.environment }}
    runs-on: ubuntu-latest
    steps:
      # All the deployment steps from current workflows
      # Download artefacts, configure AWS, SAM build/deploy, health checks
```

### Step 2: Update deploy-pulse.yml

```yaml
jobs:
  build-and-test:
    # ... existing build job ...

  deploy:
    name: Deploy to ${{ github.event.inputs.environment }}
    needs: build-and-test
    # This job declares environment for protection and secret access
    environment:
      name: ${{ github.event.inputs.environment }}
      url: https://ap-southeast-2.console.aws.amazon.com/cloudformation/home?region=ap-southeast-2#/stacks
    permissions:
      id-token: write
      contents: read
    # This job calls reusable workflow and passes secrets
    uses: ./.github/workflows/reusable-deploy-lambda.yml
    with:
      app-name: pulse-publisher
      environment: ${{ github.event.inputs.environment }}
      working-directory: apps/pulse-publisher
      output-key: PulsePublisherFunction
      artefact-name: pulse-build-artefacts
    secrets:
      aws-oidc-role-arn: ${{ secrets.AWS_OIDC_DEPLOY_ROLE_ARN }}
```

**Wait, I need to verify this syntax...**

Actually, I'm not certain this syntax is correct. Let me think through GitHub Actions syntax more carefully:

- A job can have `uses:` OR `steps:`, not both
- A job CAN have `environment:` with `uses:`
- The environment is resolved BEFORE calling the reusable workflow
- Secrets from that environment are available to pass to the reusable workflow

Yes, this should work. The syntax is:

```yaml
job-name:
  environment: env-name # Gets secrets from this environment
  uses: ./.github/workflows/reusable.yml # Calls reusable workflow
  with: { ... } # Passes inputs
  secrets: { ... } # Passes secrets (which came from environment above)
```

## Final Implementation Plan

### Step 1: Create `.github/workflows/reusable-deploy-lambda.yml`

**Manual creation required** (no CLI tool)

Include these sections:

1. `workflow_call` trigger with inputs and secrets definitions
2. Single `deploy` job (no environment block here)
3. Steps: checkout, setup, download artefacts, configure AWS, SAM validate/build/deploy, health checks, cleanup

### Step 2: Update `.github/workflows/deploy-pulse.yml`

**Command**: Edit the file manually

Changes:

- Keep `build-and-test` job (lines 27-57) unchanged
- Replace `deploy` job (lines 60-206) with call to reusable workflow
- Keep permissions, environment, and concurrency at appropriate levels

### Step 3: Update `.github/workflows/deploy-heartbeat.yml`

**Command**: Edit the file manually

Changes:

- Keep `build-and-test` job (lines 27-57) unchanged
- Replace `deploy` job (lines 60-206) with call to reusable workflow
- Keep permissions, environment, and concurrency at appropriate levels

### Step 4: Update `.github/workflows/deploy.yml`

**Command**: Edit the file manually

Changes:

- Keep `detect-affected` job (lines 30-95) unchanged
- Keep `build-and-test` job (lines 97-151) unchanged
- Replace `deploy-heartbeat` job (lines 153-300) with call to reusable workflow
- Replace `deploy-pulse` job (lines 302-450) with call to reusable workflow
- Keep `deployment-summary` job (lines 453-477) with updated needs

### Step 5: Validate Changes

**Commands to run:**

1. `pnpm lerna run lint` - Ensure no linting issues
2. `pnpm lerna run build` - Ensure builds succeed
3. `pnpm lerna run test` - Ensure tests pass
4. Manual validation: Trigger deploy-pulse.yml workflow in GitHub Actions UI to test

## Trade-offs and Alternatives Considered

### Why not Composite Actions?

- **Pro**: More granular control, can be used within jobs alongside other steps
- **Con**: More complex to implement, harder to maintain, can't use `runs-on` or `environment` directly
- **Decision**: Reusable workflows are simpler and sufficient for our needs

### Why not configure secrets at environment level?

- **Pro**: Simpler code, no workflow changes needed
- **Con**: Less visible, harder to audit, requires GitHub UI configuration for each environment
- **Decision**: Explicit passing in code makes it clearer for future maintainers

### Why not keep workflows as-is and just configure environments?

- **Pro**: No code changes needed
- **Con**: Doesn't reduce duplication, harder to maintain three similar workflows
- **Decision**: Refactoring provides long-term maintainability benefits

## Risks and Mitigations

### Risk 1: Syntax errors in workflow YAML

- **Impact**: Workflows fail to run
- **Mitigation**: Use GitHub's workflow YAML schema validation, test with workflow_dispatch first
- **Detection**: GitHub will show syntax errors immediately

### Risk 2: Secrets not available in environment

- **Impact**: Deployment still fails with credential errors
- **Mitigation**: Verify secrets are configured at repository level and accessible from environments
- **Detection**: Test with dev environment first before staging/prod

### Risk 3: Breaking existing deployments

- **Impact**: Can't deploy critical fixes
- **Mitigation**: Keep this PR as draft, test thoroughly, have rollback plan
- **Detection**: Test all three environments before merging

## Success Criteria

1. ✅ deploy-pulse.yml workflow runs successfully with manual trigger
2. ✅ deploy-heartbeat.yml workflow runs successfully with manual trigger
3. ✅ deploy.yml workflow runs successfully on push to main
4. ✅ AWS credentials are passed correctly and deployment succeeds
5. ✅ All three environments (dev/staging/prod) work correctly
6. ✅ Code duplication reduced (single reusable workflow vs three copies of deploy logic)
7. ✅ Linting, build, and tests still pass

## Validation Commands

After implementation:

```bash
# Validate linting
pnpm lerna run lint

# Validate builds
pnpm lerna run build

# Validate tests
pnpm lerna run test

# Manual validation in GitHub Actions
# 1. Go to Actions tab
# 2. Select "Deploy Pulse Publisher" workflow
# 3. Click "Run workflow"
# 4. Select "dev" environment
# 5. Verify deployment succeeds
# 6. Check CloudFormation stack in AWS console
```

## Rollback Plan

If deployment fails:

1. Revert this PR/commit
2. Previous workflow files are in git history
3. Existing CloudFormation stacks are not affected
4. Can deploy from previous commit while investigating

## Future Enhancements

After this refactoring is proven:

1. Consider extracting build-and-test to reusable workflow too (more DRY)
2. Add retry logic to health checks
3. Consider using matrix strategy for multi-environment deployments
4. Add notifications (Slack/email) for deployment status
