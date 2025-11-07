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

## Setup

**For complete bootstrap instructions, see [BOOTSTRAP_IAM_ROLES.md](./BOOTSTRAP_IAM_ROLES.md) or [../devops/README.md](../devops/README.md).**

Infrastructure is managed via CloudFormation templates in the `devops/` directory.

## Legacy Setup Instructions

**Note:** The following instructions describe the manual setup process that was used before CloudFormation templates were introduced. This is kept for reference only. Use the CloudFormation-based approach documented in [BOOTSTRAP_IAM_ROLES.md](./BOOTSTRAP_IAM_ROLES.md) instead.

**CloudFormation Templates (Source of Truth):**

The authoritative definition of OIDC roles and trust policies can be found in:

- [devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml](../devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml)
- [devops/exp/monorepo-fem-github-actions-sam-deploy-exp.yml](../devops/exp/monorepo-fem-github-actions-sam-deploy-exp.yml)
- [devops/prod/monorepo-fem-github-actions-sam-deploy-prod.yml](../devops/prod/monorepo-fem-github-actions-sam-deploy-prod.yml)

These templates define:
- The GitHub OIDC provider configuration
- Per-app deployment roles with scoped permissions
- Trust policies that restrict access to specific deployment branches
- The exact permissions each application role has

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

### 2. Create IAM Policies for Deployment (Legacy, Per-App Architecture)

**Note:** With the per-app architecture, each application has its own deployment policy scoped to only its resources. The CloudFormation templates (referenced above) define these policies inline within each role.

For manual setup, you would create separate policies for each application. For example, a policy for `heartbeat-publisher`:

Create a file named `.github/heartbeat-publisher-deploy-policy.json`:

**Note on S3 bucket resources:** The S3 bucket ARNs use wildcards (`aws-sam-cli--monorepo-fem--*`) because SAM CLI automatically creates managed buckets with a random suffix when `resolve_s3 = true` is set in `samconfig.toml`. SAM will create and manage the deployment bucket automatically.

**Reference:** For the actual policies in use, see the inline `Policies` sections in the CloudFormation templates listed above.

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
        "arn:aws:s3:::aws-sam-cli--monorepo-fem--*",
        "arn:aws:s3:::aws-sam-cli--monorepo-fem--*/*"
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

### 3. Create IAM Roles for GitHub Actions (Per-App Architecture)

**Note:** You need to create separate roles for each application and environment combination.

**Reference:** See the CloudFormation templates listed above for the exact trust policy structure used in production. The examples below are simplified for illustration.

For example, to create a role for the `heartbeat-publisher` application in the `dev` environment:

Create a file named `.github/github-trust-policy-heartbeat-publisher-dev.json`:

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
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/YOUR_REPO_NAME:ref:refs/heads/deploy-dev"
        }
      }
    }
  ]
}
```

**Important Security Notes:**

- Each role is scoped to a **single deployment branch** (e.g., `deploy-dev`, `deploy-exp`, or `deploy-prod`)
- This prevents deployments from feature branches or wrong environments
- The trust policy uses `StringLike` to match the specific branch pattern

Create the role with the standardised naming convention:

```sh
aws iam create-role \
  --role-name AWS-OIDC-ROLE-ARN--monorepo-fem--heartbeat-publisher--dev \
  --assume-role-policy-document file://.github/github-trust-policy-heartbeat-publisher-dev.json \
  --region ap-southeast-2
```

**Repeat this process** for each app/environment combination:

- `AWS-OIDC-ROLE-ARN--monorepo-fem--heartbeat-publisher--dev`
- `AWS-OIDC-ROLE-ARN--monorepo-fem--heartbeat-publisher--exp`
- `AWS-OIDC-ROLE-ARN--monorepo-fem--heartbeat-publisher--prod`
- `AWS-OIDC-ROLE-ARN--monorepo-fem--pulse-publisher--dev`
- `AWS-OIDC-ROLE-ARN--monorepo-fem--pulse-publisher--exp`
- `AWS-OIDC-ROLE-ARN--monorepo-fem--pulse-publisher--prod`
- `AWS-OIDC-ROLE-ARN--monorepo-fem--scryscraper--dev`
- `AWS-OIDC-ROLE-ARN--monorepo-fem--scryscraper--exp`
- `AWS-OIDC-ROLE-ARN--monorepo-fem--scryscraper--prod`

Each role should trust the corresponding deployment branch:
- `deploy-dev` for dev roles
- `deploy-exp` for exp roles
- `deploy-prod` for prod roles

**Save the role ARNs** from the output - you'll need them when configuring GitHub secrets.

### 4. Attach Policies to Roles

For each role created in step 3, attach the corresponding application-specific policy.

Example for the `heartbeat-publisher` dev role:

```sh
aws iam attach-role-policy \
  --role-name AWS-OIDC-ROLE-ARN--monorepo-fem--heartbeat-publisher--dev \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/heartbeat-publisher-deploy-policy
```

Repeat for each app/environment combination, ensuring each role gets the policy scoped to its application.

**Note:** The CloudFormation approach (recommended) defines policies inline within each role, eliminating the need for separate policy management.

### 5. Configure GitHub Secrets (Per-App Architecture)

With the per-app architecture, you need to configure secrets for each application and environment combination.

**Naming Convention:**

Secrets follow the pattern: `AWS_OIDC_ROLE_ARN__<REPOSITORY>__<APP>__<ENVIRONMENT>`

**Required Secrets:**

For each app/environment combination, add the corresponding role ARN:

| Secret Name | Example Value |
|-------------|---------------|
| `AWS_OIDC_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__DEV` | `arn:aws:iam::123456789012:role/AWS-OIDC-ROLE-ARN--monorepo-fem--heartbeat-publisher--dev` |
| `AWS_OIDC_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__EXP` | `arn:aws:iam::123456789012:role/AWS-OIDC-ROLE-ARN--monorepo-fem--heartbeat-publisher--exp` |
| `AWS_OIDC_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__PROD` | `arn:aws:iam::123456789012:role/AWS-OIDC-ROLE-ARN--monorepo-fem--heartbeat-publisher--prod` |
| `AWS_OIDC_ROLE_ARN__MONOREPO_FEM__PULSE_PUBLISHER__DEV` | `arn:aws:iam::123456789012:role/AWS-OIDC-ROLE-ARN--monorepo-fem--pulse-publisher--dev` |
| `AWS_OIDC_ROLE_ARN__MONOREPO_FEM__PULSE_PUBLISHER__EXP` | `arn:aws:iam::123456789012:role/AWS-OIDC-ROLE-ARN--monorepo-fem--pulse-publisher--exp` |
| `AWS_OIDC_ROLE_ARN__MONOREPO_FEM__PULSE_PUBLISHER__PROD` | `arn:aws:iam::123456789012:role/AWS-OIDC-ROLE-ARN--monorepo-fem--pulse-publisher--prod` |
| `AWS_OIDC_ROLE_ARN__MONOREPO_FEM__SCRYSCRAPER__DEV` | `arn:aws:iam::123456789012:role/AWS-OIDC-ROLE-ARN--monorepo-fem--scryscraper--dev` |
| `AWS_OIDC_ROLE_ARN__MONOREPO_FEM__SCRYSCRAPER__EXP` | `arn:aws:iam::123456789012:role/AWS-OIDC-ROLE-ARN--monorepo-fem--scryscraper--exp` |
| `AWS_OIDC_ROLE_ARN__MONOREPO_FEM__SCRYSCRAPER__PROD` | `arn:aws:iam::123456789012:role/AWS-OIDC-ROLE-ARN--monorepo-fem--scryscraper--prod` |

**To add each secret:**

1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Enter the secret name from the table above
5. Enter the corresponding role ARN as the value
6. Click "Add secret"
7. Repeat for all app/environment combinations

**Usage in Workflows:**

GitHub Actions workflows reference these secrets dynamically based on the target environment. For example, the heartbeat-publisher deployment workflow uses:

```yaml
secrets:
  aws-oidc-role-arn: ${{
    (needs.build-and-test.outputs.environment == 'dev' && secrets.AWS_OIDC_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__DEV) ||
    (needs.build-and-test.outputs.environment == 'exp' && secrets.AWS_OIDC_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__EXP) ||
    (needs.build-and-test.outputs.environment == 'prod' && secrets.AWS_OIDC_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__PROD)
  }}
```

This ensures each deployment uses the correct role for its app and environment.

**Example Workflow Files:**
- [.github/workflows/deploy-heartbeat.yml](../.github/workflows/deploy-heartbeat.yml)
- [.github/workflows/deploy-pulse.yml](../.github/workflows/deploy-pulse.yml)
- [.github/workflows/deploy-scryscraper.yml](../.github/workflows/deploy-scryscraper.yml)

## Verification

Test the setup by pushing a change to one of the deployment branches (`deploy-dev`, `deploy-exp`, or `deploy-prod`) and checking if the deployment workflow can authenticate with AWS.

You can also test locally using the AWS CLI:

```sh
# Get your AWS account ID
aws sts get-caller-identity --query Account --output text

# Verify the OIDC provider exists
aws iam list-open-id-connect-providers

# Verify a specific app role exists (example: heartbeat-publisher dev)
aws iam get-role --role-name AWS-OIDC-ROLE-ARN--monorepo-fem--heartbeat-publisher--dev

# List all OIDC roles for this repository
aws iam list-roles --query 'Roles[?starts_with(RoleName, `AWS-OIDC-ROLE-ARN--monorepo-fem--`)].RoleName' --output table
```

## Security Considerations

**Per-App Architecture Benefits:**

1. **Least Privilege:** Each role grants only the permissions needed for its specific application
2. **Resource Restrictions:** Actions are scoped to specific app resources (e.g., `heartbeat-publisher-*` resources only)
3. **Blast Radius Reduction:** A compromised role for one app cannot affect other applications
4. **Branch Restrictions:** Each role can only be assumed from its specific deployment branch (`deploy-dev`, `deploy-exp`, or `deploy-prod`)
5. **Environment Isolation:** Dev roles cannot access exp or prod resources, and vice versa
6. **Short-lived Tokens:** Tokens expire after the workflow completes
7. **No Long-lived Credentials:** No access keys stored in GitHub
8. **Audit Trail:** CloudTrail logs clearly identify which app/environment role was used
9. **Progressive Deployment:** Deploy to dev, then exp, then prod with separate roles for each stage

**Key Security Features:**

- Each role trusts only one deployment branch
- Policies use resource-level restrictions (ARN patterns like `heartbeat-publisher-*`)
- No role can modify IAM policies for other applications
- All role assumptions are logged in CloudTrail

## Troubleshooting

### "Not authorized to perform sts:AssumeRoleWithWebIdentity"

Check that:

- The OIDC provider is created in the correct AWS account
- The trust policy's `token.actions.githubusercontent.com:sub` matches your repository and deployment branch
- The correct GitHub secret for your app and environment is configured (e.g., `AWS_OIDC_ROLE_ARN__MONOREPO_FEM__HEARTBEAT_PUBLISHER__DEV`)
- The secret contains the correct role ARN for that specific app and environment
- You're deploying from the correct branch (dev roles require `deploy-dev` branch, etc.)

### "Access Denied" during deployment

Check that:

- The IAM policy is attached to the correct app-specific role
- The policy grants necessary permissions for that specific application (CloudFormation, Lambda, S3, etc.)
- Resource ARNs in the policy match your app's resource naming pattern (e.g., `heartbeat-publisher-*`)
- You're using the correct role for the app you're deploying (not mixing up app roles)
- The role has permissions for the specific environment you're deploying to

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

## Policy Management

For managing IAM policies and adding new applications, see [POLICY_MANAGEMENT.md](./POLICY_MANAGEMENT.md).

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

## Related Documentation

- [BOOTSTRAP_IAM_ROLES.md](./BOOTSTRAP_IAM_ROLES.md) - Setup instructions
- [POLICY_MANAGEMENT.md](./POLICY_MANAGEMENT.md) - Policy management
- [TROUBLESHOOTING_DEPLOYMENTS.md](./TROUBLESHOOTING_DEPLOYMENTS.md) - Common issues
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS IAM OIDC Providers](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
