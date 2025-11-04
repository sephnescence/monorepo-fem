# Deployment Guide

This document explains the CD (Continuous Deployment) strategy for the monorepo and how to deploy Lambda functions.

## Table of Contents

- [CD Strategy](#cd-strategy)
- [How Affected Detection Works](#how-affected-detection-works)
- [Automatic Deployment](#automatic-deployment)
- [Manual Deployment](#manual-deployment)
- [Safeguards and Rollback](#safeguards-and-rollback)
- [Deployment Workflow Details](#deployment-workflow-details)

## CD Strategy

### Event-Driven Deployment

We use **event-driven deployment**: every merge to `main` triggers automated deployment of affected packages.

**Key Principles:**

1. **Deploy only what changed** - Nx detects affected packages based on git diff
2. **Immediate feedback** - Deployments happen within minutes of merge
3. **Easy correlation** - Each deployment maps to a specific commit
4. **Automated safeguards** - Health checks and rollback on failure

### Why Event-Driven vs Scheduled?

| Aspect             | Event-Driven (Our Choice)   | Scheduled                       |
| ------------------ | --------------------------- | ------------------------------- |
| Feedback time      | 2-5 minutes                 | Hours                           |
| Change correlation | 1 commit = 1 deployment     | Multiple commits per deployment |
| Debugging          | Easy to identify cause      | Harder to pinpoint issue        |
| Lambda fit         | Perfect (quick deployments) | Overkill for serverless         |

## How Affected Detection Works

Nx builds a dependency graph of your packages:

```sh
cloudwatch-log-publisher (library)
↑ (depended on by)
├─ heartbeat-publisher (lambda)
└─ pulse-publisher (lambda)
```

### Example Scenarios

## Scenario 1: Change to cloudwatch-log-publisher

```sh
# Files changed
packages/cloudwatch-log-publisher/src/publisher.ts

# Affected packages detected
- @monorepo-fem/cloudwatch-log-publisher
- heartbeat-publisher (depends on cloudwatch-log-publisher)
- pulse-publisher (depends on cloudwatch-log-publisher)

# Deployments triggered
✓ heartbeat-publisher
✓ pulse-publisher
```

## Scenario 2: Change to heartbeat-publisher only

```sh
# Files changed
apps/heartbeat-publisher/src/index.ts

# Affected packages detected
- heartbeat-publisher

# Deployments triggered
✓ heartbeat-publisher
✗ pulse-publisher (not affected, skipped)
```

## Scenario 3: Change to pulse-publisher only

```sh
# Files changed
apps/pulse-publisher/src/index.ts

# Affected packages detected
- pulse-publisher

# Deployments triggered
✗ heartbeat-publisher (not affected, skipped)
✓ pulse-publisher
```

## Scenario 4: Change to docs or GitHub workflows

```sh
# Files changed
docs/DEPLOYMENT.md

# Affected packages detected
(none)

# Deployments triggered
(no deployments, build/test runs but deployment is skipped)
```

## Automatic Deployment

### Prerequisites

Before automatic deployment works, you must complete AWS OIDC setup. See [AWS_OIDC_SETUP.md](./AWS_OIDC_SETUP.md).

### How It Works

1. **Developer merges PR to `main`**

   ```sh
   git checkout main
   git pull
   # PR is merged via GitHub UI or git merge
   ```

2. **GitHub Actions triggers** (`.github/workflows/deploy.yml`)

   - Detects affected packages
   - Builds and tests affected packages
   - Deploys affected Lambda functions to production

3. **Deployment process for each Lambda**

   - SAM build (bundles code + dependencies)
   - SAM deploy (updates CloudFormation stack)
   - Health check (invokes Lambda)
   - Alarm monitoring (checks CloudWatch alarms for 2 minutes)

4. **Success or rollback**
   - ✅ **Success:** Deployment complete, Lambda running new code
   - ❌ **Failure:** Automatic CloudFormation stack rollback to previous version

### Viewing Deployment Status

- **GitHub Actions:** Go to Actions tab in your repository
- **CloudFormation:** AWS Console > CloudFormation > Stacks
- **Lambda Functions:** AWS Console > Lambda > Functions

## Manual Deployment

For local testing or emergency deployments, you can deploy manually.

### Deploy to Dev Environment

```sh
# Deploy heartbeat-publisher to dev
cd apps/heartbeat-publisher
pnpm deploy:dev

# Deploy pulse-publisher to dev
cd apps/pulse-publisher
pnpm deploy:dev
```

### Deploy to Staging Environment

```sh
# Deploy heartbeat-publisher to staging
cd apps/heartbeat-publisher
pnpm deploy:staging

# Deploy pulse-publisher to staging
cd apps/pulse-publisher
pnpm deploy:staging
```

### Deploy to Production Environment

**⚠️ Warning:** Manual production deploys bypass safeguards. Use only in emergencies.

```sh
# Deploy heartbeat-publisher to production
cd apps/heartbeat-publisher
pnpm deploy:prod

# Deploy pulse-publisher to production
cd apps/pulse-publisher
pnpm deploy:prod
```

### Deploy Individual Steps

If you need more control:

```sh
# 1. Build the Lambda code
pnpm build

# 2. Build SAM artefacts
pnpm sam:build

# 3. Deploy to specific environment
pnpm sam:deploy:dev     # or staging, prod
```

## Safeguards and Rollback

### Pre-Deployment Safeguards

✅ **Full test suite runs** on affected packages
✅ **Build verification** ensures code compiles
✅ **Concurrent deployment prevention** - only one deployment at a time

### Post-Deployment Safeguards

✅ **Health check** - Lambda is invoked with empty payload
✅ **CloudWatch alarm monitoring** - Checks for errors/throttles/timeouts for 2 minutes
✅ **Automatic rollback** - CloudFormation reverts to previous version on failure

### CloudWatch Alarms Monitored

Each Lambda has these alarms (defined in `template.yaml`):

1. **Error Alarm** - Triggers on any Lambda error (threshold: 1 error)
2. **Throttle Alarm** - Triggers on concurrent execution limit (threshold: 1 throttle)
3. **Duration Alarm** - Triggers if execution takes >80% of timeout (threshold: 3200ms for 4s timeout)

If any alarm enters ALARM state within 2 minutes of deployment, the workflow fails and triggers rollback.

### Manual Rollback

If you need to rollback manually:

```sh
# Via CloudFormation Console
1. Go to CloudFormation > Stacks
2. Select the stack (e.g., heartbeat-publisher-prod)
3. Click "Stack actions" > "Continue rollback" or "Delete stack"

# Via AWS CLI
aws cloudformation rollback-stack --stack-name heartbeat-publisher-prod
```

### Rollback Considerations

- CloudFormation maintains stack history
- Previous Lambda versions are retained (via versioning)
- Log groups and CloudWatch resources persist across rollbacks
- EventBridge rules may need manual clean up if rollback fails

## Deployment Workflow Details

### Workflow Jobs

The deployment workflow (`.github/workflows/deploy.yml`) consists of 5 jobs:

#### 1. detect-affected

- Detects which packages changed since last deployment
- Uses Nx: `nx show projects --affected --base=origin/main~1`
- Outputs boolean flags for each package

#### 2. build-and-test

- Runs only if affected packages exist
- Builds affected packages in dependency order
- Runs tests for affected packages
- Uploads build artefacts for deployment jobs

#### 3. deploy-heartbeat

- Runs only if heartbeat-publisher or cloudwatch-log-publisher affected
- Downloads build artefacts
- Authenticates with AWS using OIDC
- Runs SAM build + deploy
- Performs health checks
- Monitors CloudWatch alarms
- Triggers rollback on failure

#### 4. deploy-pulse

- Runs only if pulse-publisher or cloudwatch-log-publisher affected
- Same process as deploy-heartbeat
- Runs in parallel with deploy-heartbeat (no dependency)

#### 5. deployment-summary

- Generates summary of deployment results
- Shows which packages were deployed and their status

### Workflow Concurrency

```yaml
concurrency:
  group: production-deployment
  cancel-in-progress: false
```

This ensures:

- Only one deployment runs at a time
- Subsequent merges queue (don't cancel in-progress deployments)
- Prevents race conditions and partial deployments

### Environment Configuration

The workflow uses GitHub Environments:

```yaml
environment:
  name: production
  url: https://ap-southeast-2.console.aws.amazon.com/cloudformation/...
```

Benefits:

- Protection rules (can require manual approval)
- Environment-specific secrets
- Deployment history tracking
- URL to view deployment in AWS Console

## Troubleshooting

### Deployment Failed: Authentication Error

**Cause:** AWS OIDC not configured or GitHub secret missing

**Solution:**

1. Verify GitHub secret `AWS_DEPLOY_ROLE_ARN` exists
2. Follow [AWS_OIDC_SETUP.md](./AWS_OIDC_SETUP.md)

### Deployment Failed: Health Check

**Cause:** Lambda invocation failed after deployment

**Solution:**

1. Check CloudWatch Logs for the Lambda function
2. Look for errors in the function code
3. Verify Lambda has necessary permissions
4. Check if environment variables are set correctly

### Deployment Failed: Alarms Triggered

**Cause:** CloudWatch alarms entered ALARM state post-deployment

**Solution:**

1. Check which alarm triggered (workflow logs show alarm name)
2. Review CloudWatch metrics for the Lambda
3. Check CloudWatch Logs for errors
4. Rollback is automatic, but investigate root cause

### Affected Detection Not Working

**Cause:** Git history missing or Nx cache issues

**Solution:**

```sh
# Locally, verify affected detection works
npx nx show projects --affected --base=main~1

# Clear Nx cache
npx nx reset
```

### Manual Deployment Fails

**Cause:** Missing dependencies or AWS credentials

**Solution:**

```sh
# Ensure dependencies are installed
pnpm install

# Build cloudwatch-log-publisher first (workspace dependency)
cd packages/cloudwatch-log-publisher
pnpm build

# Then build the Lambda
cd ../../apps/heartbeat-publisher
pnpm build

# Deploy
pnpm sam:build
pnpm sam:deploy:dev
```

## Best Practices

1. ✅ **Merge small, frequent changes** - Easier to debug failures
2. ✅ **Monitor CloudWatch** - Check logs after merges
3. ✅ **Test locally first** - Deploy to dev environment before merging
4. ✅ **Use feature flags** - For gradual rollouts of risky changes
5. ✅ **Review deployment summaries** - Check GitHub Actions output
6. ❌ **Don't bypass safeguards** - Don't use `--force` or skip tests
7. ❌ **Don't manual deploy to prod** - Let CI/CD handle it (unless emergency)

## CI vs CD

This repository has both:

### Continuous Integration (CI)

- `.github/workflows/hourly-tests.yml` - Runs tests hourly on main
- `.github/workflows/daily-coverage.yml` - Generates coverage daily
- Runs on PRs (if PR workflow exists)

### Continuous Deployment (CD)

- `.github/workflows/deploy.yml` - Deploys on merge to main
- Only deploys affected packages
- Includes automated safeguards and rollback

## Related Documentation

- [AWS OIDC Setup](./AWS_OIDC_SETUP.md) - Required before first deployment
- [Nx Documentation](https://nx.dev/concepts/affected) - Understanding affected detection
- [SAM CLI Reference](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-command-reference.html)
