# DevOps Infrastructure

CloudFormation templates for IAM and CloudWatch infrastructure.

See [../docs/AWS_OIDC_SETUP.md](../docs/AWS_OIDC_SETUP.md) for architecture overview.

## Resources Created Per Environment

1. **OIDC Provider** - GitHub Actions authentication without long-lived credentials
2. **PolicyManager IAM Role** - Manages IAM policies during SAM deployments
3. **Deployment IAM Roles** - Three roles (HeartbeatPublisher, PulsePublisher, ScrysScraper)
4. **Shared Metrics CloudWatch Log Group** - Centralised application metrics

Resources are scoped to `monorepo-fem-*` namespace with environment-specific naming.

## Directory Structure

```
/devops/
  ├── dev/
  │   └── monorepo-fem-github-actions-sam-deploy-dev.yml
  ├── exp/
  │   └── monorepo-fem-github-actions-sam-deploy-exp.yml
  └── prod/
      └── monorepo-fem-github-actions-sam-deploy-prod.yml
```

## Role Permissions Summary

See CloudFormation templates in this directory for complete policy definitions.

**PolicyManager Role:**
- Create/update IAM policies for `monorepo-fem-*` resources
- Attach policies to `monorepo-fem-*` roles
- Pass roles to AWS services (required for SAM deployments)
- Deploy CloudFormation stacks for `monorepo-fem-*` applications
- Cannot delete policies or manage resources outside namespace

**Deployment Roles:** (HeartbeatPublisher, PulsePublisher, ScrysScraper)
- Scoped to application-specific resources only
- Trust policy: Only `deploy-<env>` branch from `sephnescence/monorepo-fem`
- See templates for detailed permissions per application

**OIDC Provider:** `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`
- Subject: `repo:sephnescence/monorepo-fem:ref:refs/heads/deploy-<env>`

**Metrics Log Group:** `/aws/metrics/monorepo-fem-<env>`
- Apps can create streams and write logs
- Apps cannot modify log group or access other apps' streams

## Bootstrap Process

### Prerequisites

1. **OIDC Provider** - Must be set up in AWS account (one-time setup, already done if GitHub Actions are working)
2. **AWS CLI** - Installed and configured with appropriate credentials
3. **Authorisation** - Only trusted persons with AWS admin access should perform bootstrap
4. **AWS Account ID** - Set the AWS_ACCOUNT_ID environment variable before running deployment commands:

```bash
# Get your AWS account ID
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Verify it's set correctly
echo $AWS_ACCOUNT_ID
```

### Initial Deployment

The CloudFormation stacks must be deployed manually the first time. After that, the workflow will automatically detect their existence.

#### Deploy Dev Environment

```bash
aws cloudformation create-stack \
  --stack-name monorepo-fem-devops-dev \
  --template-body file://devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2 \
  --parameters \
    ParameterKey=GitHubOrganization,ParameterValue=sephnescence \
    ParameterKey=GitHubRepository,ParameterValue=monorepo-fem \
    ParameterKey=Environment,ParameterValue=dev \
    ParameterKey=DeploymentBranch,ParameterValue=deploy-dev \
    ParameterKey=AWSAccountId,ParameterValue=${AWS_ACCOUNT_ID} \
    ParameterKey=AWSRegion,ParameterValue=ap-southeast-2
```

#### Deploy Exp Environment

```bash
aws cloudformation create-stack \
  --stack-name monorepo-fem-devops-exp \
  --template-body file://devops/exp/monorepo-fem-github-actions-sam-deploy-exp.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2 \
  --parameters \
    ParameterKey=GitHubOrganization,ParameterValue=sephnescence \
    ParameterKey=GitHubRepository,ParameterValue=monorepo-fem \
    ParameterKey=Environment,ParameterValue=exp \
    ParameterKey=DeploymentBranch,ParameterValue=deploy-exp \
    ParameterKey=AWSAccountId,ParameterValue=${AWS_ACCOUNT_ID} \
    ParameterKey=AWSRegion,ParameterValue=ap-southeast-2
```

#### Deploy Prod Environment

```bash
aws cloudformation create-stack \
  --stack-name monorepo-fem-devops-prod \
  --template-body file://devops/prod/monorepo-fem-github-actions-sam-deploy-prod.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2 \
  --parameters \
    ParameterKey=GitHubOrganization,ParameterValue=sephnescence \
    ParameterKey=GitHubRepository,ParameterValue=monorepo-fem \
    ParameterKey=Environment,ParameterValue=prod \
    ParameterKey=DeploymentBranch,ParameterValue=deploy-prod \
    ParameterKey=AWSAccountId,ParameterValue=${AWS_ACCOUNT_ID} \
    ParameterKey=AWSRegion,ParameterValue=ap-southeast-2
```

### Verify Deployment

Check stack status:

```bash
# Dev
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].StackStatus'

# Exp
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-exp \
  --region ap-southeast-2 \
  --query 'Stacks[0].StackStatus'

# Prod
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-prod \
  --region ap-southeast-2 \
  --query 'Stacks[0].StackStatus'
```

Expected output: `"CREATE_COMPLETE"`

### Retrieve Outputs

After successful deployment, retrieve the stack outputs:

```bash
# Dev
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs'

# Exp
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-exp \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs'

# Prod
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-prod \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs'
```

### Add Outputs to GitHub Secrets

The following secrets need to be added to the GitHub repository.

#### Secret Naming Convention

Secrets follow this naming pattern:

```
AWS_OIDC_<ROLE_TYPE>_ROLE_ARN__<REPOSITORY>__<APP>__<ENVIRONMENT>
```

Where:
- `ROLE_TYPE`: `DEPLOY` or `POLICY_MANAGER`
- `REPOSITORY`: `MONOREPO_FEM` (repository name in SCREAMING_SNAKE_CASE)
- `APP`: App name in SCREAMING_SNAKE_CASE (only for deploy roles)
- `ENVIRONMENT`: `DEV`, `EXP`, or `PROD`

Components are separated by double underscores (`__`) for clarity.

#### Required Secrets

| Secret Name | CloudFormation Output | Environment |
|------------|----------------------|-------------|
| `AWS_OIDC_POLICY_MANAGER_ROLE_ARN__MONOREPO_FEM__DEV` | `PolicyManagerRoleArn` | dev |
| `AWS_OIDC_POLICY_MANAGER_ROLE_ARN__MONOREPO_FEM__EXP` | `PolicyManagerRoleArn` | exp |
| `AWS_OIDC_POLICY_MANAGER_ROLE_ARN__MONOREPO_FEM__PROD` | `PolicyManagerRoleArn` | prod |
| `AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__DEV` | `HeartbeatPublisherDeployRoleArn` | dev |
| `AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__EXP` | `HeartbeatPublisherDeployRoleArn` | exp |
| `AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__PROD` | `HeartbeatPublisherDeployRoleArn` | prod |
| `AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__PULSE_PUBLISHER__DEV` | `PulsePublisherDeployRoleArn` | dev |
| `AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__PULSE_PUBLISHER__EXP` | `PulsePublisherDeployRoleArn` | exp |
| `AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__PULSE_PUBLISHER__PROD` | `PulsePublisherDeployRoleArn` | prod |
| `AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__SCRYSCRAPER__DEV` | `ScryScraperDeployRoleArn` | dev |
| `AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__SCRYSCRAPER__EXP` | `ScryScraperDeployRoleArn` | exp |
| `AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__SCRYSCRAPER__PROD` | `ScryScraperDeployRoleArn` | prod |

To add secrets via GitHub CLI:

```bash
# Get the policy manager role ARN from CloudFormation output
POLICY_MANAGER_ARN_DEV=$(aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`PolicyManagerRoleArn`].OutputValue' \
  --output text)

# Add to GitHub secrets
gh secret set AWS_OIDC_POLICY_MANAGER_ROLE_ARN__MONOREPO_FEM__DEV --body "$POLICY_MANAGER_ARN_DEV"

# Repeat for exp and prod
POLICY_MANAGER_ARN_EXP=$(aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-exp \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`PolicyManagerRoleArn`].OutputValue' \
  --output text)

gh secret set AWS_OIDC_POLICY_MANAGER_ROLE_ARN__MONOREPO_FEM__EXP --body "$POLICY_MANAGER_ARN_EXP"

POLICY_MANAGER_ARN_PROD=$(aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-prod \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`PolicyManagerRoleArn`].OutputValue' \
  --output text)

gh secret set AWS_OIDC_POLICY_MANAGER_ROLE_ARN__MONOREPO_FEM__PROD --body "$POLICY_MANAGER_ARN_PROD"

# Get deployment role ARNs for dev
HB_DEPLOY_ARN_DEV=$(aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`HeartbeatPublisherDeployRoleArn`].OutputValue' \
  --output text)

PULSE_DEPLOY_ARN_DEV=$(aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`PulsePublisherDeployRoleArn`].OutputValue' \
  --output text)

SCRY_DEPLOY_ARN_DEV=$(aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ScryScraperDeployRoleArn`].OutputValue' \
  --output text)

# Add deployment role secrets for dev
gh secret set AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__DEV --body "$HB_DEPLOY_ARN_DEV"
gh secret set AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__PULSE_PUBLISHER__DEV --body "$PULSE_DEPLOY_ARN_DEV"
gh secret set AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__SCRYSCRAPER__DEV --body "$SCRY_DEPLOY_ARN_DEV"

# Repeat for exp environment
HB_DEPLOY_ARN_EXP=$(aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-exp \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`HeartbeatPublisherDeployRoleArn`].OutputValue' \
  --output text)

PULSE_DEPLOY_ARN_EXP=$(aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-exp \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`PulsePublisherDeployRoleArn`].OutputValue' \
  --output text)

SCRY_DEPLOY_ARN_EXP=$(aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-exp \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ScryScraperDeployRoleArn`].OutputValue' \
  --output text)

gh secret set AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__EXP --body "$HB_DEPLOY_ARN_EXP"
gh secret set AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__PULSE_PUBLISHER__EXP --body "$PULSE_DEPLOY_ARN_EXP"
gh secret set AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__SCRYSCRAPER__EXP --body "$SCRY_DEPLOY_ARN_EXP"

# Repeat for prod environment
HB_DEPLOY_ARN_PROD=$(aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-prod \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`HeartbeatPublisherDeployRoleArn`].OutputValue' \
  --output text)

PULSE_DEPLOY_ARN_PROD=$(aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-prod \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`PulsePublisherDeployRoleArn`].OutputValue' \
  --output text)

SCRY_DEPLOY_ARN_PROD=$(aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-prod \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ScryScraperDeployRoleArn`].OutputValue' \
  --output text)

gh secret set AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__PROD --body "$HB_DEPLOY_ARN_PROD"
gh secret set AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__PULSE_PUBLISHER__PROD --body "$PULSE_DEPLOY_ARN_PROD"
gh secret set AWS_OIDC_DEPLOY_ROLE_ARN__MONOREPO_FEM__SCRYSCRAPER__PROD --body "$SCRY_DEPLOY_ARN_PROD"
```

Alternatively, add secrets via GitHub web interface:

1. Navigate to: `https://github.com/sephnescence/monorepo-fem/settings/secrets/actions`
2. Click "New repository secret"
3. Add each secret with the corresponding ARN value

## Updating Templates

To update an existing stack:

```bash
aws cloudformation update-stack \
  --stack-name monorepo-fem-devops-<env> \
  --template-body file://devops/<env>/monorepo-fem-github-actions-sam-deploy-<env>.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2 \
  --parameters \
    ParameterKey=GitHubOrganization,ParameterValue=sephnescence \
    ParameterKey=GitHubRepository,ParameterValue=monorepo-fem \
    ParameterKey=Environment,ParameterValue=<env> \
    ParameterKey=DeploymentBranch,ParameterValue=deploy-<env> \
    ParameterKey=AWSAccountId,ParameterValue=${AWS_ACCOUNT_ID} \
    ParameterKey=AWSRegion,ParameterValue=ap-southeast-2
```

Replace `<env>` with `dev`, `exp`, or `prod`.

## Troubleshooting

See [../docs/TROUBLESHOOTING_DEPLOYMENTS.md](../docs/TROUBLESHOOTING_DEPLOYMENTS.md) for comprehensive troubleshooting guidance.

**Quick checks:**
- OIDC provider exists: `aws iam list-open-id-connect-providers`
- Check role trust policy: `aws iam get-role --role-name monorepo-fem-policy-manager-<env>`
- View stack events: `aws cloudformation describe-stack-events --stack-name monorepo-fem-devops-<env>`

## Security Considerations

1. **Least Privilege** - All permissions are scoped to `monorepo-fem-*` resources
2. **Environment Isolation** - Each environment has separate roles and log groups
3. **Branch Protection** - OIDC trust policies enforce branch-based access
4. **No Deletion Permissions** - PolicyManager cannot delete policies or resources
5. **Audit Trail** - All actions are logged in CloudTrail

## Adding a New Application

See [../docs/POLICY_MANAGEMENT.md](../docs/POLICY_MANAGEMENT.md) for instructions on adding a new application's deployment role.

## Resource Naming Conventions

All resources follow these patterns:

### IAM Roles
- **PolicyManager**: `monorepo-fem-policy-manager-<env>`
- **Deployment Roles**: `GitHubActionsDeployRole-<AppName>-<env>`

### CloudFormation
- **DevOps Stacks**: `monorepo-fem-devops-<env>`
- **App Stacks**: `monorepo-fem-<app-name>-<env>`

### CloudWatch Logs
- **Metrics Log Group**: `/aws/metrics/monorepo-fem-<env>`
- **Lambda Log Groups**: `/aws/lambda/<app-name>-*`
- **App-specific Log Groups**: `/monorepo-fem/<app-type>-*`
- **Log Streams**: `<app-name>-<timestamp>`

### OIDC Provider
- **Provider ARN**: `arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com`

This ensures consistent naming and easy identification of resources across all environments.

## Retention Policies

- **Dev/Exp Log Groups**: 7 days retention
- **Prod Log Group**: 30 days retention
- **All Resources**: Retain on delete (prevent accidental data loss)

