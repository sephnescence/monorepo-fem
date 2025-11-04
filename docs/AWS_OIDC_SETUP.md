# AWS OIDC Setup for GitHub Actions

This guide explains how to configure AWS to allow GitHub Actions to deploy your Lambda functions using OpenID Connect (OIDC) authentication.

## Why OIDC?

OIDC allows GitHub Actions to authenticate with AWS without storing long-lived credentials (access keys) in GitHub secrets. Instead, GitHub Actions receives a short-lived token from AWS that's only valid for the duration of the workflow run.

## Prerequisites

- AWS Account with administrator access
- AWS CLI installed and configured
- GitHub repository with Actions enabled

## Setup Steps

### 1. Create GitHub OIDC Provider in AWS

Run this command to create the OIDC identity provider:

```sh
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --region ap-southeast-2
```

**Note:** The thumbprint value is GitHub's current certificate thumbprint. GitHub will notify if this changes.

### 2. Create IAM Policy for Deployment

Create a file named `github-actions-deploy-policy.json`:

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
  --policy-document file://github-actions-deploy-policy.json \
  --region ap-southeast-2
```

**Save the policy ARN** from the output - you'll need it in the next step.

### 3. Create IAM Role for GitHub Actions

Create a file named `github-trust-policy.json` (replace `YOUR_GITHUB_ORG` and `YOUR_REPO_NAME`):

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
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/YOUR_REPO_NAME:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

**Important:** The `StringLike` condition restricts the role to only be assumable from the `main` branch. This is a security best practice.

Create the role:

```sh
aws iam create-role \
  --role-name GitHubActionsDeployRole \
  --assume-role-policy-document file://github-trust-policy.json \
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

Test the setup by pushing a change to the `main` branch and checking if the deployment workflow can authenticate with AWS.

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
3. **Branch Restrictions:** The role can only be assumed from the `main` branch
4. **Short-lived Tokens:** Tokens expire after the workflow completes
5. **No Long-lived Credentials:** No access keys stored in GitHub

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

## Resources

- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS IAM OIDC Identity Providers](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [SAM CLI Reference](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-command-reference.html)
