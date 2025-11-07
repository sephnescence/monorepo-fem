# AWS OIDC Setup for GitHub Actions

This guide explains how to configure AWS to allow GitHub Actions to deploy your Lambda functions using OpenID Connect (OIDC) authentication with a per-app, per-environment IAM role architecture.

## Why OIDC?

OIDC allows GitHub Actions to authenticate with AWS without storing long-lived credentials (access keys) in GitHub secrets. Instead, GitHub Actions receives a short-lived token from AWS that's only valid for the duration of the workflow run.

## Architecture Overview

This repository uses a **per-app, per-environment IAM role architecture** for enhanced security and least privilege access:

- **3 Applications**: heartbeat-publisher, pulse-publisher, scryscraper
- **3 Environments**: dev, exp, prod
- **9 Deployment Roles**: One dedicated role per application per environment
- **3 Policy Manager Roles**: One per environment for managing IAM policies during SAM deployments

### Architecture Diagram

```
GitHub Actions (OIDC)
    │
    ├─► Dev Environment
    │   ├─► GitHubActionsDeployRole-HeartbeatPublisher-dev
    │   ├─► GitHubActionsDeployRole-PulsePublisher-dev
    │   ├─► GitHubActionsDeployRole-ScrysScraper-dev
    │   └─► PolicyManager-dev
    │
    ├─► Exp Environment
    │   ├─► GitHubActionsDeployRole-HeartbeatPublisher-exp
    │   ├─► GitHubActionsDeployRole-PulsePublisher-exp
    │   ├─► GitHubActionsDeployRole-ScrysScraper-exp
    │   └─► PolicyManager-exp
    │
    └─► Prod Environment
        ├─► GitHubActionsDeployRole-HeartbeatPublisher-prod
        ├─► GitHubActionsDeployRole-PulsePublisher-prod
        ├─► GitHubActionsDeployRole-ScrysScraper-prod
        └─► PolicyManager-prod
```

### Why Per-App, Per-Environment Roles?

**Security Benefits:**

- **Least Privilege**: Each role can only access resources for its specific application
- **Blast Radius Reduction**: A compromised role cannot affect other applications
- **Audit Trail**: CloudTrail logs clearly show which app/environment was accessed
- **Environment Isolation**: Dev deployments cannot accidentally affect prod resources

**Operational Benefits:**

- **Clear Separation**: Developers know exactly which role is used for which deployment
- **Policy Clarity**: Each role's permissions are focused and easier to audit
- **Scalability**: Adding new applications or environments is straightforward
- **Compliance**: Easier to demonstrate compliance with security frameworks

### Role Responsibilities

**Deployment Roles** (e.g., `GitHubActionsDeployRole-HeartbeatPublisher-dev`):

- Deploy CloudFormation stacks for their specific application
- Create and update Lambda functions
- Manage CloudWatch log groups
- Configure EventBridge rules
- Access SAM deployment buckets
- **Cannot** modify IAM policies or access other applications' resources

**Policy Manager Roles** (e.g., `monorepo-fem-policy-manager-dev`):

- Manage IAM policies during SAM deployments
- Create and update IAM roles for Lambda execution
- Attach policies to roles
- **Cannot** deploy applications or Lambda functions

## Branch Strategy

This repository uses environment-specific deployment branches:

- `deploy-dev` - Triggers deployments to the development environment
- `deploy-exp` - Triggers deployments to the experimental/staging environment
- `deploy-prod` - Triggers deployments to the production environment

The `main` branch does not trigger automatic deployments. To deploy:

1. Merge your changes to `main`
2. Merge `main` into the appropriate deployment branch (`deploy-dev` → `deploy-exp` → `deploy-prod`)
3. Push the deployment branch to trigger the deployment

You can also manually trigger deployments using workflow dispatch, which allows selecting the target environment.

## Prerequisites

- AWS Account with administrator access
- AWS CLI installed and configured
- GitHub repository with Actions enabled

## Setup Steps

**For detailed bootstrap instructions, see [BOOTSTRAP_IAM_ROLES.md](./BOOTSTRAP_IAM_ROLES.md).**

The infrastructure is now managed via CloudFormation templates in the `devops/` directory. Each environment (dev, exp, prod) has its own CloudFormation stack that creates:

- GitHub OIDC provider
- Deployment roles for all applications
- Policy manager role
- Shared CloudWatch log group

### Quick Setup Overview

1. Deploy CloudFormation stacks for each environment (dev, exp, prod)
2. Retrieve role ARNs from CloudFormation outputs
3. Add role ARNs to GitHub secrets
4. Verify OIDC trust relationships
5. Test deployments

**Deploy a single environment:**

```sh
# Example: Deploy dev environment infrastructure
aws cloudformation deploy \
  --template-file devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml \
  --stack-name monorepo-fem-devops-dev \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2
```

For complete step-by-step instructions, validation commands, and troubleshooting, refer to [BOOTSTRAP_IAM_ROLES.md](./BOOTSTRAP_IAM_ROLES.md).

## Legacy Setup Instructions

**Note:** The following instructions describe the manual setup process that was used before CloudFormation templates were introduced. This is kept for reference only. Use the CloudFormation-based approach documented in [BOOTSTRAP_IAM_ROLES.md](./BOOTSTRAP_IAM_ROLES.md) instead.

<details>
<summary>Click to expand legacy manual setup instructions</summary>

### 1. Create GitHub OIDC Provider in AWS (Legacy)

Run this command to create the OIDC identity provider:

```sh
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --region ap-southeast-2
```

**Note:** The thumbprint value is GitHub's current certificate thumbprint. GitHub will notify if this changes.

### 2. Create IAM Policy for Deployment (Legacy)

Create a file named `.github/github-actions-deploy-policy.json`: (Refer to the existing one for the most up to date version. Failing that, check AWS directly)

**Note on S3 bucket resources:** The S3 bucket ARNs use wildcards (`aws-sam-cli-managed-default-samclisourcebucket-*`) because SAM CLI automatically creates managed buckets with a random suffix when `resolve_s3 = true` is set in `samconfig.toml`. Both Lambda packages (`heartbeat-publisher` and `pulse-publisher`) use this setting, so SAM will create and manage the deployment bucket automatically.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFormationAccess",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:DescribeStackResources",
        "cloudformation:GetTemplate",
        "cloudformation:ValidateTemplate",
        "cloudformation:CreateChangeSet",
        "cloudformation:DescribeChangeSet",
        "cloudformation:ExecuteChangeSet",
        "cloudformation:DeleteChangeSet",
        "cloudformation:ListChangeSets",
        "cloudformation:RollbackStack"
      ],
      "Resource": [
        "arn:aws:cloudformation:ap-southeast-2:*:stack/heartbeat-publisher-*/*",
        "arn:aws:cloudformation:ap-southeast-2:*:stack/pulse-publisher-*/*"
      ]
    },
    {
      "Sid": "S3DeploymentBucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:GetBucketVersioning",
        "s3:PutBucketVersioning",
        "s3:GetBucketPolicy",
        "s3:PutBucketPolicy"
      ],
      "Resource": [
        "arn:aws:s3:::aws-sam-cli-managed-default-samclisourcebucket-*",
        "arn:aws:s3:::aws-sam-cli-managed-default-samclisourcebucket-*/*"
      ]
    },
    {
      "Sid": "LambdaAccess",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "lambda:ListVersionsByFunction",
        "lambda:PublishVersion",
        "lambda:CreateAlias",
        "lambda:UpdateAlias",
        "lambda:DeleteAlias",
        "lambda:GetAlias",
        "lambda:InvokeFunction",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:GetPolicy",
        "lambda:TagResource",
        "lambda:UntagResource"
      ],
      "Resource": [
        "arn:aws:lambda:ap-southeast-2:*:function:heartbeat-publisher-*",
        "arn:aws:lambda:ap-southeast-2:*:function:pulse-publisher-*"
      ]
    },
    {
      "Sid": "IAMRoleAccess",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PassRole",
        "iam:TagRole",
        "iam:UntagRole"
      ],
      "Resource": [
        "arn:aws:iam::*:role/heartbeat-publisher-*",
        "arn:aws:iam::*:role/pulse-publisher-*"
      ]
    },
    {
      "Sid": "CloudWatchAccess",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:DeleteLogGroup",
        "logs:DescribeLogGroups",
        "logs:PutRetentionPolicy",
        "logs:DeleteRetentionPolicy",
        "logs:TagLogGroup",
        "logs:UntagLogGroup",
        "cloudwatch:PutMetricAlarm",
        "cloudwatch:DeleteAlarms",
        "cloudwatch:DescribeAlarms",
        "cloudwatch:PutDashboard",
        "cloudwatch:DeleteDashboards",
        "cloudwatch:GetDashboard"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EventBridgeAccess",
      "Effect": "Allow",
      "Action": [
        "events:PutRule",
        "events:DeleteRule",
        "events:DescribeRule",
        "events:PutTargets",
        "events:RemoveTargets",
        "events:ListTargetsByRule",
        "events:EnableRule",
        "events:DisableRule"
      ],
      "Resource": [
        "arn:aws:events:ap-southeast-2:*:rule/heartbeat-publisher-*",
        "arn:aws:events:ap-southeast-2:*:rule/pulse-publisher-*"
      ]
    }
  ]
}
```

Create the policy:

```sh
aws iam create-policy \
  --policy-name GitHubActionsDeployPolicy \
  --policy-document file://.github/github-actions-deploy-policy.json \
  --region ap-southeast-2
```

**Save the policy ARN** from the output - you'll need it in the next step.

### 3. Create IAM Role for GitHub Actions

Create a file named `.github/github-trust-policy.json` (Update `token.actions.githubusercontent.com:sub`: replace `YOUR_GITHUB_ORG` and `YOUR_REPO_NAME`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": [
            "repo:sephnescence/monorepo-fem:ref:refs/heads/deploy-dev",
            "repo:sephnescence/monorepo-fem:ref:refs/heads/deploy-exp",
            "repo:sephnescence/monorepo-fem:ref:refs/heads/deploy-prod"
          ]
        }
      }
    }
  ]
}
```

**Important:** The `StringLike` condition restricts the role to only be assumable from the three deployment branches (`deploy-dev`, `deploy-exp`, `deploy-prod`). This is a security best practice that prevents deployments from feature branches.

Create the role:

```sh
aws iam create-role \
  --role-name GitHubActionsDeployRole \
  --assume-role-policy-document file://.github/github-trust-policy.json \
  --region ap-southeast-2
```

**Save the role ARN** from the output.

### 4. Attach Policy to Role

Replace `POLICY_ARN` with the ARN from step 2:

```sh
aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn POLICY_ARN
```

### 5. Configure GitHub Secret

1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Name: `AWS_DEPLOY_ROLE_ARN`
5. Value: The role ARN from step 3 (format: `arn:aws:iam::123456789012:role/GitHubActionsDeployRole`)
6. Click "Add secret"

## Verification

Test the setup by pushing a change to one of the deployment branches (`deploy-dev`, `deploy-exp`, or `deploy-prod`) and checking if the deployment workflow can authenticate with AWS.

You can also test locally using the AWS CLI:

```sh
# Get your AWS account ID
aws sts get-caller-identity --query Account --output text

# Verify the OIDC provider exists
aws iam list-open-id-connect-providers

# Verify the role exists
aws iam get-role --role-name GitHubActionsDeployRole
```

## Security Considerations

1. **Least Privilege:** The policy only grants permissions needed for SAM deployments
2. **Resource Restrictions:** Actions are scoped to specific CloudFormation stacks and Lambda functions
3. **Branch Restrictions:** The role can only be assumed from the deployment branches (`deploy-dev`, `deploy-exp`, `deploy-prod`), preventing deployments from feature branches
4. **Short-lived Tokens:** Tokens expire after the workflow completes
5. **No Long-lived Credentials:** No access keys stored in GitHub
6. **Environment Isolation:** Each deployment branch targets a specific environment, allowing for progressive deployment testing

## Troubleshooting

### "Not authorized to perform sts:AssumeRoleWithWebIdentity"

Check that:

- The OIDC provider is created in the correct AWS account
- The trust policy's `token.actions.githubusercontent.com:sub` matches your repository
- The GitHub secret `AWS_DEPLOY_ROLE_ARN` contains the correct role ARN

### "Access Denied" during deployment

Check that:

- The IAM policy is attached to the role
- The policy grants necessary permissions (CloudFormation, Lambda, S3, etc.)
- Resource ARNs in the policy match your stack names

### Thumbprint errors

If you get thumbprint validation errors, get the current thumbprint:

```sh
echo | openssl s_client -servername token.actions.githubusercontent.com \
  -connect token.actions.githubusercontent.com:443 2>/dev/null | \
  openssl x509 -fingerprint -noout | \
  sed 's/://g' | \
  awk -F= '{print tolower($2)}'
```

</details>

## Policy Validation

The deployment workflows include policy validation to detect drift between source policies (in CloudFormation templates) and deployed policies (in AWS). This helps ensure:

- Policies remain consistent with the infrastructure-as-code definitions
- Manual policy changes are detected and flagged
- Security posture is maintained over time

For details on managing policies, see [POLICY_MANAGEMENT.md](./POLICY_MANAGEMENT.md).

## Adding a New Application

To add a new application to the deployment system:

1. Create CloudFormation resources for the new app in each environment template
2. Define IAM policies scoped to the new app's resources
3. Update GitHub workflows to use the new role ARN
4. Add new GitHub secrets for the role ARNs
5. Test deployment in dev environment first

For detailed instructions, see the "Adding a New App" section in [POLICY_MANAGEMENT.md](./POLICY_MANAGEMENT.md).

## Monitoring and Auditing

**CloudWatch Logs:**

All Lambda functions log to CloudWatch log groups with standardised naming:

- `/aws/lambda/{app-name}-{environment}-*`

**CloudTrail:**

All role assumptions and API calls are logged in CloudTrail. Use CloudTrail to:

- Audit which roles are being used
- Detect unauthorised access attempts
- Track policy changes
- Monitor deployment activity

**IAM Access Analyser:**

Use IAM Access Analyser to:

- Identify external access to resources
- Detect unused permissions
- Validate least privilege implementation

## Resources

- [BOOTSTRAP_IAM_ROLES.md](./BOOTSTRAP_IAM_ROLES.md) - Detailed setup instructions
- [POLICY_MANAGEMENT.md](./POLICY_MANAGEMENT.md) - Policy management guide
- [TESTING_PLAN_IAM_SPLIT.md](./TESTING_PLAN_IAM_SPLIT.md) - Testing strategy
- [TROUBLESHOOTING_DEPLOYMENTS.md](./TROUBLESHOOTING_DEPLOYMENTS.md) - Common issues
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS IAM OIDC Identity Providers](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [SAM CLI Reference](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-command-reference.html)
- [AWS CloudFormation Best Practices](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/best-practices.html)
