# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD automation.

## Workflows Overview

### Deployment Workflows

- **deploy-heartbeat.yml** - Builds, tests, and deploys the Heartbeat Publisher Lambda function
- **deploy-pulse.yml** - Builds, tests, and deploys the Pulse Publisher Lambda function
- **deploy-scryscraper.yml** - Builds, tests, and deploys the Scryscraper Lambda function
- **reusable-deploy-lambda.yml** - Reusable workflow for Lambda deployments (called by the above)

### Monitoring Workflows

- **daily-drift-detection.yml** - Runs daily to detect policy drift across all apps and environments

### Environment Strategy

Deployments are triggered by:

1. **Branch push**: Pushing to `deploy-dev`, `deploy-exp`, or `deploy-prod` branches
2. **Manual dispatch**: Using the workflow_dispatch trigger with environment selection

Each workflow:

1. Builds and tests the application
2. Uploads build artefacts
3. Deploys to the target environment using app-specific and environment-specific IAM roles

## Policy Validation

### Overview

Policy validation ensures that deployed IAM policies match the policy files stored in the repository. This helps maintain policy-as-code discipline and detects policy drift.

Policy validation runs in two contexts:

1. **During deployment** - Before each deployment, the reusable workflow validates policy drift
2. **Daily monitoring** - A scheduled workflow runs daily to check all apps and environments

### How It Works

1. **Policy files**: Each app has a policy file in `.github/policies/`:
   - `heartbeat-publisher-deploy-policy.json`
   - `pulse-publisher-deploy-policy.json`
   - `scryscraper-deploy-policy.json`

2. **Validation process**:
   - The workflow uses the deployment role (which has read access to IAM policies)
   - Retrieves the current deployed policy from the deployment role
   - Normalises both policies (substitutes placeholders like `${AWS_ACCOUNT_ID}`)
   - Compares the policies using semantic JSON comparison
   - Reports any differences

3. **When validation runs**:
   - **During deployment**: In the "Validate IAM policy drift" step of the reusable workflow
   - **Daily**: Via the `daily-drift-detection.yml` workflow (scheduled for 2:00 AM UTC / 12:00 PM AEST)

### Validation Behaviour

#### Development and Experimental Environments

- Policy differences generate a **warning** only
- The workflow continues and deployment proceeds
- This allows experimentation with policy changes in lower environments

#### Production Environment

- Policy differences generate an **error**
- The workflow **fails** and deployment is blocked
- This enforces policy sync between repository and deployed infrastructure

### Interpreting Validation Output

#### No Drift

```
✓ Policies are identical
```

The deployed policy matches the repository policy. No action needed.

#### Drift Detected (Dev/Exp)

```
⚠️  Policy differences detected:
[diff output]
The deployed policy differs from the repository policy.
This may be intentional (e.g., testing in lower environment).
Review the differences above to determine if action is needed.
```

**Action**: Review the differences. If the repository policy is correct, update the deployed policy manually (see troubleshooting guide). If the deployed policy is correct, update the repository policy file and commit.

#### Drift Detected (Prod)

```
❌ ERROR: Policy drift detected in production environment
[diff output]
```

**Action**: The deployment is blocked. You must resolve the policy difference before deploying:

1. Review the differences
2. Update either the repository policy file or the deployed policy manually
3. Re-run the deployment after the policy is in sync

### Why Validation Doesn't Fail in Dev/Exp

Policy validation in dev/exp generates warnings instead of failures because:

- Allows testing policy changes before committing them to the repository
- Enables experimentation without blocking deployments
- Provides visibility without enforcing strict sync
- Lower environments may intentionally have different policies for testing

### Why Validation Doesn't Block Deployments (Skip on Error)

If the policy validation step itself fails (e.g., network issues, permissions issues), the deployment continues because:

- Infrastructure issues shouldn't block application deployments
- Policy validation is informational, not critical to deployment success
- Warnings are logged for investigation
- First-time deployments may not have existing policies to validate

## Environment-Specific Secrets

Each app and environment combination requires specific GitHub secrets:

### Deployment Role Secrets (Per App, Per Environment)

```
AWS_OIDC_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__DEV
AWS_OIDC_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__EXP
AWS_OIDC_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__PROD

AWS_OIDC_ROLE_ARN__MONOREPO_FEM__PULSE_PUBLISHER__DEV
AWS_OIDC_ROLE_ARN__MONOREPO_FEM__PULSE_PUBLISHER__EXP
AWS_OIDC_ROLE_ARN__MONOREPO_FEM__PULSE_PUBLISHER__PROD

AWS_OIDC_ROLE_ARN__MONOREPO_FEM__SCRYSCRAPER__DEV
AWS_OIDC_ROLE_ARN__MONOREPO_FEM__SCRYSCRAPER__EXP
AWS_OIDC_ROLE_ARN__MONOREPO_FEM__SCRYSCRAPER__PROD
```

### Retrieving Role ARNs

After deploying DevOps infrastructure via CloudFormation, retrieve the role ARNs:

```bash
# Get deployment role ARNs
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`HeartbeatPublisherDeployRoleArn`].OutputValue' \
  --output text
```

See `devops/README.md` for detailed instructions.

### Secret Naming Convention

The naming convention is:

```
AWS_OIDC_ROLE_ARN__<REPOSITORY>__<APP>__<ENVIRONMENT>
```

Where:

- `REPOSITORY`: `MONOREPO_FEM` (repository name in SCREAMING_SNAKE_CASE)
- `APP`: App name in SCREAMING_SNAKE_CASE
- `ENVIRONMENT`: `DEV`, `EXP`, or `PROD`

Components are separated by double underscores (`__`) for clarity.

## Reusable Workflow: reusable-deploy-lambda.yml

### Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `app-name` | Yes | Name of the app (e.g., `heartbeat-publisher`) |
| `environment` | Yes | Target environment (`dev`, `exp`, `prod`) |
| `working-directory` | Yes | App's working directory (e.g., `apps/heartbeat-publisher`) |
| `output-key` | Yes | CloudFormation output key for function name |
| `artefact-name` | Yes | Name of the build artefact to download |
| `policy-file` | Yes | Path to IAM policy file (e.g., `.github/policies/heartbeat-publisher-deploy-policy.json`) |

### Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `aws-oidc-role-arn` | Yes | App-specific and environment-specific deployment role ARN |

### Workflow Steps

1. Checkout code
2. Setup pnpm and Node.js
3. Install dependencies
4. Download build artefacts
5. Configure AWS credentials (assume deployment role)
6. **Validate IAM policy drift**
7. Validate SAM template
8. Check if stack exists
9. SAM build
10. SAM deploy
11. Get deployment info from CloudFormation outputs
12. Health check (invoke Lambda)
13. Monitor CloudWatch alarms
14. Clean up on failure (if needed)

## Daily Drift Detection

### Overview

The `daily-drift-detection.yml` workflow runs automatically every day at 2:00 AM UTC (12:00 PM AEST) to check for policy drift across all apps and environments.

### How It Works

The workflow runs separate jobs for each app and environment combination:

- **Heartbeat Publisher**: dev, exp, prod
- **Pulse Publisher**: dev, exp, prod
- **Scryscraper**: dev, exp, prod

Each job:

1. Authenticates using the app-specific and environment-specific OIDC role
2. Retrieves the deployed policy from the IAM role
3. Compares it with the repository policy file
4. Reports any differences as warnings (dev/exp) or errors (prod)

### Behaviour

- **Dev/Exp environments**: Drift generates warnings but jobs continue
- **Prod environments**: Drift generates errors and jobs fail
- Jobs are independent - failure in one doesn't affect others
- Can be triggered manually via workflow_dispatch for on-demand checks

### Why Daily Checks?

Daily drift detection provides early warning of policy changes that may have been made manually outside of the deployment process, allowing teams to:

- Catch manual policy changes before they cause issues
- Maintain policy-as-code discipline
- Audit policy changes over time
- Identify security drift in production environments

## Troubleshooting

For troubleshooting policy validation issues, see `.github/workflows/TROUBLESHOOTING.md`.
