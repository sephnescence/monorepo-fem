# DevOps Infrastructure

This directory contains CloudFormation templates for managing the IAM and CloudWatch infrastructure for the monorepo-fem project.

## Overview

Each environment (dev, exp, prod) has its own CloudFormation template that creates:

1. **PolicyManager IAM Role** - Used by GitHub Actions to manage IAM policies during deployments
2. **Shared Metrics CloudWatch Log Group** - Centralised logging for application metrics
3. **OIDC Trust Policies** - Secure authentication from GitHub Actions to AWS

All resources are scoped to the `monorepo-fem-*` namespace to ensure least-privilege access.

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

The following secrets need to be added to the GitHub repository:

| Secret Name | CloudFormation Output | Environment |
|------------|----------------------|-------------|
| `AWS_POLICY_MANAGER_ROLE_ARN_DEV` | `PolicyManagerRoleArn` | dev |
| `AWS_POLICY_MANAGER_ROLE_ARN_EXP` | `PolicyManagerRoleArn` | exp |
| `AWS_POLICY_MANAGER_ROLE_ARN_PROD` | `PolicyManagerRoleArn` | prod |

To add secrets via GitHub CLI:

```bash
# Get the role ARN from CloudFormation output
ROLE_ARN_DEV=$(aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`PolicyManagerRoleArn`].OutputValue' \
  --output text)

# Add to GitHub secrets
gh secret set AWS_POLICY_MANAGER_ROLE_ARN_DEV --body "$ROLE_ARN_DEV"

# Repeat for exp and prod
ROLE_ARN_EXP=$(aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-exp \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`PolicyManagerRoleArn`].OutputValue' \
  --output text)

gh secret set AWS_POLICY_MANAGER_ROLE_ARN_EXP --body "$ROLE_ARN_EXP"

ROLE_ARN_PROD=$(aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-prod \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`PolicyManagerRoleArn`].OutputValue' \
  --output text)

gh secret set AWS_POLICY_MANAGER_ROLE_ARN_PROD --body "$ROLE_ARN_PROD"
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

## Resource Naming Conventions

All resources follow this pattern:

- **IAM Roles**: `monorepo-fem-policy-manager-<env>`
- **CloudFormation Stacks**: `monorepo-fem-devops-<env>`
- **Log Groups**: `/aws/metrics/monorepo-fem-<env>`
- **Log Streams**: `<app-name>-<timestamp>` (e.g., `heartbeat-publisher-20251107-123456`)

This ensures consistent naming and easy identification of resources.

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
