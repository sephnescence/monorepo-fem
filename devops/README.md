# DevOps Infrastructure

This directory contains CloudFormation templates for managing the IAM and CloudWatch infrastructure for the monorepo-fem project.

## Overview

Each environment (dev, exp, prod) has its own CloudFormation template that creates:

1. **OIDC Provider** - GitHub Actions authentication without long-lived credentials
2. **PolicyManager IAM Role** - Used by GitHub Actions to manage IAM policies during deployments
3. **Deployment IAM Roles** - Three separate roles for deploying each application
   - HeartbeatPublisher deployment role
   - PulsePublisher deployment role
   - ScrysScraper deployment role
4. **Shared Metrics CloudWatch Log Group** - Centralised logging for application metrics

All resources are scoped to the `monorepo-fem-*` namespace and environment-specific naming to ensure least-privilege access and prevent cross-environment access.

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

## Resources Created

### PolicyManager Role

The PolicyManager role has permissions to:

- **Create and update IAM policies** for `monorepo-fem-*` resources
- **Attach policies** to `monorepo-fem-*` roles
- **Pass roles** to AWS services (required for SAM deployments)
- **Deploy CloudFormation stacks** for `monorepo-fem-*` applications
- **Manage Lambda functions** with `monorepo-fem-*` naming
- **Configure EventBridge rules** for scheduled executions
- **Manage S3 buckets** for SAM deployment artefacts

The role does **not** have permissions to:

- Delete policies (decommissioning apps is out of scope)
- Manage resources outside the `monorepo-fem-*` namespace

### Deployment Roles

Each application has its own dedicated deployment role with permissions scoped to only that application's resources. This enforces least-privilege at the role level.

#### HeartbeatPublisher Deployment Role

**Role Name**: `GitHubActionsDeployRole-HeartbeatPublisher-<env>`

Permissions scoped to:
- CloudFormation stacks matching `monorepo-fem-heartbeat-publisher-*`
- Lambda functions matching `heartbeat-publisher-*`
- IAM roles matching `heartbeat-publisher-*`
- EventBridge rules matching `heartbeat-publisher-*`
- CloudWatch logs matching `/aws/lambda/heartbeat-publisher-*` and `/monorepo-fem/heartbeats-*`
- SAM deployment S3 buckets (`aws-sam-cli-managed-default-*`)

Trust policy: Only `deploy-<env>` branch from `sephnescence/monorepo-fem` repository

#### PulsePublisher Deployment Role

**Role Name**: `GitHubActionsDeployRole-PulsePublisher-<env>`

Permissions scoped to:
- CloudFormation stacks matching `monorepo-fem-pulse-publisher-*`
- Lambda functions matching `pulse-publisher-*`
- IAM roles matching `pulse-publisher-*`
- EventBridge rules matching `pulse-publisher-*`
- CloudWatch logs matching `/aws/lambda/pulse-publisher-*` and `/monorepo-fem/pulse-*`
- SAM deployment S3 buckets (`aws-sam-cli-managed-default-*`)

Trust policy: Only `deploy-<env>` branch from `sephnescence/monorepo-fem` repository

#### ScrysScraper Deployment Role

**Role Name**: `GitHubActionsDeployRole-ScrysScraper-<env>`

Permissions scoped to:
- CloudFormation stacks matching `monorepo-fem-scryscraper-*`
- Lambda functions matching `scryscraper-*`
- IAM roles matching `scryscraper-*`
- EventBridge rules matching `scryscraper-*`
- CloudWatch logs matching `/aws/lambda/scryscraper-*`
- DynamoDB tables matching `monorepo-fem-scryscraper-*`
- S3 buckets matching `monorepo-fem-scryscraper-cache-*`
- SAM deployment S3 buckets (`aws-sam-cli-managed-default-*`)

Trust policy: Only `deploy-<env>` branch from `sephnescence/monorepo-fem` repository

**Note**: ScrysScraper has additional permissions for DynamoDB and S3 cache buckets specific to its scraping functionality.

### OIDC Provider

**Provider URL**: `https://token.actions.githubusercontent.com`

The OIDC provider is created as part of each environment's CloudFormation template and allows GitHub Actions to assume AWS IAM roles without storing long-lived AWS credentials.

All deployment roles trust this OIDC provider and enforce that:
1. The token audience is `sts.amazonaws.com`
2. The subject claim matches `repo:sephnescence/monorepo-fem:ref:refs/heads/deploy-<env>`

This ensures that only workflows running on the correct branch can assume the roles.

### Metrics Log Group

Each environment has a shared CloudWatch log group: `/aws/metrics/monorepo-fem-<env>`

Applications can:

- **Create log streams** with app-specific names (e.g., `heartbeat-publisher-20251107-123456`)
- **Write logs** to their own log streams

Applications cannot:

- Modify the log group itself
- Access log streams created by other applications

## Bootstrap Process

### Prerequisites

1. **OIDC Provider** - Must be set up in AWS account (one-time setup, already done if GitHub Actions are working)
2. **AWS CLI** - Installed and configured with appropriate credentials
3. **Authorisation** - Only trusted persons with AWS admin access should perform bootstrap

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
    ParameterKey=AWSAccountId,ParameterValue=395380602678 \
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
    ParameterKey=AWSAccountId,ParameterValue=395380602678 \
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
    ParameterKey=AWSAccountId,ParameterValue=395380602678 \
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
    ParameterKey=AWSAccountId,ParameterValue=395380602678 \
    ParameterKey=AWSRegion,ParameterValue=ap-southeast-2
```

Replace `<env>` with `dev`, `exp`, or `prod`.

## Workflow Integration

The `.github/workflows/reusable-deploy-lambda.yml` workflow automatically checks for the PolicyManager role before deployment:

1. **Role exists** - Deployment proceeds normally
2. **Role missing** - Workflow:
   - Creates a PR with bootstrap instructions
   - Outputs PR URL
   - Exits gracefully with a warning
   - Does not fail the build

This ensures that deployments cannot proceed without proper infrastructure, while providing clear guidance on how to resolve the issue.

## Troubleshooting

### OIDC Authentication Failures

If GitHub Actions cannot assume the role:

1. Verify the OIDC provider exists:
   ```bash
   aws iam list-open-id-connect-providers
   ```

2. Check the trust policy on the role:
   ```bash
   aws iam get-role --role-name monorepo-fem-policy-manager-<env>
   ```

3. Ensure the deployment branch matches the trust policy:
   - Dev: `deploy-dev`
   - Exp: `deploy-exp`
   - Prod: `deploy-prod`

### Permission Denied Errors

If the PolicyManager role cannot perform an action:

1. Check CloudTrail for the specific denied action
2. Verify the action is scoped to `monorepo-fem-*` resources
3. Update the CloudFormation template if needed
4. Redeploy the stack using the update command above

### Stack Creation Failures

If stack creation fails:

1. Check the CloudFormation events:
   ```bash
   aws cloudformation describe-stack-events \
     --stack-name monorepo-fem-devops-<env> \
     --region ap-southeast-2
   ```

2. Common issues:
   - **Role already exists** - Delete the old role or use update-stack instead
   - **Insufficient permissions** - Ensure your AWS credentials have admin access
   - **Parameter validation** - Check that all parameter values are correct

## Security Considerations

1. **Least Privilege** - All permissions are scoped to `monorepo-fem-*` resources
2. **Environment Isolation** - Each environment has separate roles and log groups
3. **Branch Protection** - OIDC trust policies enforce branch-based access
4. **No Deletion Permissions** - PolicyManager cannot delete policies or resources
5. **Audit Trail** - All actions are logged in CloudTrail

## Adding a New Application Deployment Role

When adding a new application to the monorepo, follow these steps:

1. **Create IAM policy JSON** in `.github/policies/<app-name>-deploy-policy.json`:
   - Use existing policies as templates
   - Scope all permissions to the app's resources (e.g., `<app-name>-*`)
   - Include all necessary AWS services (CloudFormation, Lambda, S3, etc.)
   - Use placeholders: `${AWS_ACCOUNT_ID}`, `${AWS_REGION}`, `${ENVIRONMENT}`

2. **Add role to CloudFormation templates**:
   - Add a new `AWS::IAM::Role` resource in each environment template
   - Name the role: `GitHubActionsDeployRole-<AppName>-${Environment}`
   - Set `MaxSessionDuration: 3600` (1 hour)
   - Configure OIDC trust policy:
     ```yaml
     AssumeRolePolicyDocument:
       Version: '2012-10-17'
       Statement:
         - Effect: Allow
           Principal:
             Federated: !GetAtt GitHubOIDCProvider.Arn
           Action: 'sts:AssumeRoleWithWebIdentity'
           Condition:
             StringEquals:
               'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com'
             StringLike:
               'token.actions.githubusercontent.com:sub': !Sub 'repo:${GitHubOrganization}/${GitHubRepository}:ref:refs/heads/${DeploymentBranch}'
     ```
   - Inline the policy from step 1, converting placeholders to CloudFormation intrinsic functions
   - Add appropriate tags (Name, Environment, Application, ManagedBy)

3. **Add CloudFormation outputs**:
   ```yaml
   <AppName>DeployRoleArn:
     Description: ARN of the <App Name> deployment role
     Value: !GetAtt <AppName>DeployRole.Arn
     Export:
       Name: !Sub 'monorepo-fem-<app-name>-deploy-role-arn-${Environment}'
   ```

4. **Update all three environment templates** (dev, exp, prod)

5. **Validate templates**:
   ```bash
   aws cloudformation validate-template \
     --template-body file://devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml \
     --region ap-southeast-2
   ```

6. **Update CloudFormation stacks**:
   ```bash
   aws cloudformation update-stack \
     --stack-name monorepo-fem-devops-dev \
     --template-body file://devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml \
     --capabilities CAPABILITY_NAMED_IAM \
     --region ap-southeast-2
   ```

7. **Retrieve and add GitHub secrets**:
   ```bash
   APP_DEPLOY_ARN_DEV=$(aws cloudformation describe-stacks \
     --stack-name monorepo-fem-devops-dev \
     --region ap-southeast-2 \
     --query 'Stacks[0].Outputs[?OutputKey==`<AppName>DeployRoleArn`].OutputValue' \
     --output text)

   gh secret set AWS_<APP_NAME>_DEPLOY_ROLE_ARN_DEV --body "$APP_DEPLOY_ARN_DEV"
   ```

8. **Update GitHub workflows** to use the new role ARN

9. **Document the new role** in this README under "Deployment Roles"

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

## Future Enhancements

Potential improvements to consider:

1. **CloudFormation Drift Detection** - Automated detection of manual changes
2. **Cross-Region Replication** - For disaster recovery
3. **Cost Allocation Tags** - For better cost tracking
4. **SNS Notifications** - Alert on stack failures
5. **Automated Testing** - Validate templates before deployment
