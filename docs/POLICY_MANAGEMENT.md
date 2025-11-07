# Policy Management Guide

This guide explains how to manage IAM policies for the per-app, per-environment deployment architecture.

## Overview

IAM policies in this repository are managed through CloudFormation templates located in the `devops/` directory. This provides:

- **Infrastructure as Code**: All policies are version controlled
- **Consistency**: Same policies across environments with parameter variations
- **Auditability**: Changes tracked through git history
- **Automated Deployment**: CloudFormation manages policy updates

## Policy Architecture

### Policy Types

**1. Deployment Policies** (Inline policies on deployment roles)

- Scoped to specific application resources
- Managed within CloudFormation role definitions
- One policy per application per environment
- Examples:
  - `heartbeat-publisher-deploy-policy-dev`
  - `pulse-publisher-deploy-policy-exp`
  - `scryscraper-deploy-policy-prod`

**2. Policy Manager Policies** (Inline policies on policy manager roles)

- Manage IAM policies during SAM deployments
- Create and update Lambda execution roles
- Scoped to `monorepo-fem-*` namespace
- One per environment

### Policy Naming Conventions

All policies follow standardised naming patterns:

- Deployment policies: `{app-name}-deploy-policy-{environment}`
- Policy manager policies: `monorepo-fem-policy-management-{environment}`
- Resource scoping: `monorepo-fem-{app-name}-{environment}-*`

## Updating a Policy for an Application

### Scenario: Add S3 Permissions to Heartbeat Publisher

Follow these steps to update a policy:

### Step 1: Identify the CloudFormation Template

Policies are defined in the CloudFormation templates for each environment:

- Dev: `devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml`
- Exp: `devops/exp/monorepo-fem-github-actions-sam-deploy-exp.yml`
- Prod: `devops/prod/monorepo-fem-github-actions-sam-deploy-prod.yml`

### Step 2: Locate the Role Definition

Find the `HeartbeatPublisherDeployRole` resource in the template. The inline policies are defined under the `Policies` section.

### Step 3: Add the New Permissions

Add a new statement to the policy document:

```yaml
- Sid: HeartbeatS3Access
  Effect: Allow
  Action:
    - 's3:GetObject'
    - 's3:PutObject'
    - 's3:ListBucket'
  Resource:
    - !Sub 'arn:aws:s3:::monorepo-fem-heartbeat-data-${Environment}'
    - !Sub 'arn:aws:s3:::monorepo-fem-heartbeat-data-${Environment}/*'
```

**Important principles:**

- Use the `!Sub` function to inject the environment parameter
- Scope resources to the application namespace (`heartbeat-*`)
- Include a descriptive `Sid` (Statement ID)
- Follow least privilege - only grant necessary actions

### Step 4: Update All Environments

Make the same change in all three environment templates (dev, exp, prod) to maintain consistency.

### Step 5: Deploy the Updated CloudFormation Stack

Deploy the updated stack to each environment:

```sh
# Deploy to dev
aws cloudformation deploy \
  --template-file devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml \
  --stack-name monorepo-fem-devops-dev \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2

# Deploy to exp
aws cloudformation deploy \
  --template-file devops/exp/monorepo-fem-github-actions-sam-deploy-exp.yml \
  --stack-name monorepo-fem-devops-exp \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2

# Deploy to prod
aws cloudformation deploy \
  --template-file devops/prod/monorepo-fem-github-actions-sam-deploy-prod.yml \
  --stack-name monorepo-fem-devops-prod \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2
```

### Step 6: Verify the Policy Update

Verify the policy was updated successfully:

```sh
# Check the dev role's inline policies
aws iam list-role-policies \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --region ap-southeast-2

# Get the policy document
aws iam get-role-policy \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --policy-name heartbeat-publisher-deploy-policy-dev \
  --region ap-southeast-2 \
  --query 'PolicyDocument' \
  --output json
```

### Step 7: Test the Updated Policy

Test the updated policy by deploying the application:

1. Trigger a deployment workflow for heartbeat-publisher
2. Monitor the workflow for any permission errors
3. Verify the application can access the new S3 bucket

### Step 8: Commit Changes to Git

Once verified, commit the CloudFormation template changes:

```sh
git add devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml
git add devops/exp/monorepo-fem-github-actions-sam-deploy-exp.yml
git add devops/prod/monorepo-fem-github-actions-sam-deploy-prod.yml
git commit -m "Add S3 permissions to heartbeat-publisher deployment role"
git push
```

## Adding a New Application

### Scenario: Add a New "Data Processor" Application

Follow these steps to add a new application to the deployment system:

### Step 1: Create the Application Resources

In each environment's CloudFormation template, add a new role resource for the data processor:

```yaml
DataProcessorDeployRole:
  Type: AWS::IAM::Role
  Properties:
    RoleName: !Sub 'GitHubActionsDeployRole-DataProcessor-${Environment}'
    Description: !Sub 'Deployment role for data-processor ${Environment} environment'
    MaxSessionDuration: 3600

    # OIDC trust policy
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

    # Inline deployment permissions
    Policies:
      - PolicyName: !Sub 'data-processor-deploy-policy-${Environment}'
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Sid: CloudFormationAccess
              Effect: Allow
              Action:
                - 'cloudformation:CreateChangeSet'
                - 'cloudformation:CreateStack'
                - 'cloudformation:DescribeChangeSet'
                - 'cloudformation:DescribeStackEvents'
                - 'cloudformation:DescribeStackResources'
                - 'cloudformation:DescribeStacks'
                - 'cloudformation:DeleteChangeSet'
                - 'cloudformation:DeleteStack'
                - 'cloudformation:ExecuteChangeSet'
                - 'cloudformation:GetTemplate'
                - 'cloudformation:GetTemplateSummary'
                - 'cloudformation:ListChangeSets'
                - 'cloudformation:RollbackStack'
                - 'cloudformation:UpdateStack'
                - 'cloudformation:ValidateTemplate'
              Resource:
                - !Sub 'arn:aws:cloudformation:${AWSRegion}:${AWSAccountId}:stack/aws-sam-cli-managed-default-*'
                - !Sub 'arn:aws:cloudformation:${AWSRegion}:${AWSAccountId}:stack/aws-sam-cli-managed-default/*'
                - !Sub 'arn:aws:cloudformation:${AWSRegion}:${AWSAccountId}:stack/monorepo-fem-data-processor-${Environment}*/*'
                - !Sub 'arn:aws:cloudformation:${AWSRegion}:aws:transform/Serverless-2016-10-31'

            - Sid: S3DeploymentBucketAccess
              Effect: Allow
              Action:
                - 's3:CreateBucket'
                - 's3:DeleteObject'
                - 's3:GetBucketLocation'
                - 's3:GetBucketPolicy'
                - 's3:GetBucketVersioning'
                - 's3:GetObject'
                - 's3:ListBucket'
                - 's3:PutBucketPolicy'
                - 's3:PutBucketVersioning'
                - 's3:PutObject'
              Resource:
                - 'arn:aws:s3:::aws-sam-cli--monorepo-fem--*'
                - 'arn:aws:s3:::aws-sam-cli--monorepo-fem--*/*'

            - Sid: LambdaAccess
              Effect: Allow
              Action:
                - 'lambda:AddPermission'
                - 'lambda:CreateAlias'
                - 'lambda:CreateFunction'
                - 'lambda:DeleteAlias'
                - 'lambda:DeleteFunction'
                - 'lambda:GetFunction'
                - 'lambda:GetAlias'
                - 'lambda:GetFunctionConfiguration'
                - 'lambda:GetPolicy'
                - 'lambda:InvokeFunction'
                - 'lambda:ListVersionsByFunction'
                - 'lambda:PublishVersion'
                - 'lambda:RemovePermission'
                - 'lambda:TagResource'
                - 'lambda:UpdateAlias'
                - 'lambda:UntagResource'
                - 'lambda:UpdateFunctionCode'
                - 'lambda:UpdateFunctionConfiguration'
              Resource:
                - !Sub 'arn:aws:lambda:${AWSRegion}:*:function:data-processor-*'

            - Sid: IAMRoleAccess
              Effect: Allow
              Action:
                - 'iam:AttachRolePolicy'
                - 'iam:CreateRole'
                - 'iam:DeleteRole'
                - 'iam:DeleteRolePolicy'
                - 'iam:DetachRolePolicy'
                - 'iam:GetRole'
                - 'iam:GetRolePolicy'
                - 'iam:PassRole'
                - 'iam:PutRolePolicy'
                - 'iam:TagRole'
                - 'iam:UntagRole'
              Resource:
                - !Sub 'arn:aws:iam::*:role/data-processor-*'

            - Sid: CloudWatchAccess
              Effect: Allow
              Action:
                - 'cloudwatch:PutMetricAlarm'
                - 'cloudwatch:DeleteAlarms'
                - 'cloudwatch:DescribeAlarms'
                - 'logs:CreateLogGroup'
                - 'logs:DeleteLogGroup'
                - 'logs:DescribeLogGroups'
                - 'logs:PutRetentionPolicy'
                - 'logs:DeleteRetentionPolicy'
                - 'logs:TagLogGroup'
                - 'logs:UntagLogGroup'
              Resource:
                - !Sub 'arn:aws:logs:${AWSRegion}:${AWSAccountId}:log-group:/aws/lambda/data-processor-*'
                - !Sub 'arn:aws:logs:${AWSRegion}:${AWSAccountId}:log-group:/aws/lambda/data-processor-*:*'

    Tags:
      - Key: Name
        Value: !Sub 'GitHubActionsDeployRole-DataProcessor-${Environment}'
      - Key: Environment
        Value: !Ref Environment
      - Key: Application
        Value: data-processor
      - Key: ManagedBy
        Value: CloudFormation
```

### Step 2: Add CloudFormation Output

Add an output for the new role's ARN:

```yaml
Outputs:
  # ... existing outputs ...

  DataProcessorDeployRoleArn:
    Description: ARN of the Data Processor deployment role
    Value: !GetAtt DataProcessorDeployRole.Arn
    Export:
      Name: !Sub 'monorepo-fem-data-processor-deploy-role-arn-${Environment}'
```

### Step 3: Deploy the Updated Stack

Deploy the stack to create the new role:

```sh
aws cloudformation deploy \
  --template-file devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml \
  --stack-name monorepo-fem-devops-dev \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2
```

### Step 4: Retrieve the New Role ARN

```sh
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`DataProcessorDeployRoleArn`].OutputValue' \
  --output text
```

### Step 5: Add GitHub Secret

```sh
gh secret set AWS_DEPLOY_ROLE_ARN_DATAPROCESSOR_DEV \
  --body "arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-DataProcessor-dev"
```

### Step 6: Create GitHub Workflow

Create `.github/workflows/deploy-data-processor.yml`:

```yaml
name: Deploy Data Processor

on:
  push:
    branches:
      - deploy-dev
      - deploy-exp
      - deploy-prod
    paths:
      - 'apps/data-processor/**'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        type: choice
        options:
          - dev
          - exp
          - prod

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets[format('AWS_DEPLOY_ROLE_ARN_DATAPROCESSOR_{0}', github.event.inputs.environment || 'DEV')] }}
          aws-region: ap-southeast-2

      - name: Deploy SAM application
        run: |
          sam build --template apps/data-processor/template.yaml
          sam deploy --config-env ${{ github.event.inputs.environment || 'dev' }}
```

### Step 7: Test the New Application

Test deployment using workflow dispatch.

## Validating Policy Changes

After updating policies, validate them to ensure they're correct:

### Validate CloudFormation Template Syntax

```sh
aws cloudformation validate-template \
  --template-body file://devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml \
  --region ap-southeast-2
```

### Check Policy Size Limits

IAM has limits on policy sizes:

- Inline policy: 10,240 characters
- Managed policy: 6,144 characters

Check policy size:

```sh
# Get policy document and count characters
aws iam get-role-policy \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --policy-name heartbeat-publisher-deploy-policy-dev \
  --query 'length(PolicyDocument)' \
  --region ap-southeast-2
```

If approaching the limit, consider:

- Removing unnecessary permissions
- Using wildcards more efficiently (carefully!)
- Splitting into managed policies

### Validate with IAM Policy Simulator

Test policy permissions before deployment:

```sh
# Test if role can create Lambda function
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --action-names lambda:CreateFunction \
  --resource-arns arn:aws:lambda:ap-southeast-2:${AWS_ACCOUNT_ID}:function:heartbeat-publisher-dev-test
```

### Run IAM Access Analyser

Check for security issues:

```sh
# Create analyser if needed
aws accessanalyzer create-analyzer \
  --analyzer-name monorepo-fem-analyser \
  --type ACCOUNT \
  --region ap-southeast-2

# Check for findings
aws accessanalyzer list-findings \
  --analyzer-arn arn:aws:access-analyzer:ap-southeast-2:${AWS_ACCOUNT_ID}:analyzer/monorepo-fem-analyser \
  --region ap-southeast-2
```

## Handling Policy Drift

Policy drift occurs when deployed policies differ from the CloudFormation source.

### Detecting Policy Drift

CloudFormation can detect drift:

```sh
# Start drift detection
aws cloudformation detect-stack-drift \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2

# Get drift detection status
aws cloudformation describe-stack-drift-detection-status \
  --stack-drift-detection-id <detection-id> \
  --region ap-southeast-2

# View drift details
aws cloudformation describe-stack-resource-drifts \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2 \
  --query 'StackResourceDrifts[?ResourceType==`AWS::IAM::Role`]'
```

### Resolving Policy Drift

**Option 1: Revert Manual Changes**

If policies were manually modified in AWS console:

```sh
# Update stack to reapply source policies
aws cloudformation update-stack \
  --stack-name monorepo-fem-devops-dev \
  --template-body file://devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2
```

**Option 2: Update Source to Match Deployment**

If the manual change should be kept:

1. Update the CloudFormation template to match the deployed policy
2. Commit the change to git
3. Deploy the updated template

### When to Update Deployed Policies Manually

**Never update policies manually in production.**

Manual updates may be acceptable in dev for:

- Emergency fixes during development
- Testing permission changes before codifying
- Troubleshooting deployment issues

Always follow up manual changes with CloudFormation template updates.

## Policy Best Practices

### 1. Principle of Least Privilege

Grant only the minimum permissions necessary:

```yaml
# Good: Specific resources
Resource:
  - !Sub 'arn:aws:lambda:${AWSRegion}:${AWSAccountId}:function:heartbeat-publisher-*'

# Bad: Too permissive
Resource:
  - '*'
```

### 2. Use Resource-Level Permissions

Scope permissions to specific resources:

```yaml
# Good: Resource-scoped
- Effect: Allow
  Action:
    - 's3:GetObject'
  Resource:
    - 'arn:aws:s3:::monorepo-fem-heartbeat-data-dev/*'

# Bad: Account-wide
- Effect: Allow
  Action:
    - 's3:GetObject'
  Resource:
    - '*'
```

### 3. Use Conditions When Appropriate

Add conditions to further restrict access:

```yaml
- Effect: Allow
  Action:
    - 's3:PutObject'
  Resource:
    - 'arn:aws:s3:::monorepo-fem-heartbeat-data-dev/*'
  Condition:
    StringEquals:
      's3:x-amz-server-side-encryption': 'AES256'
```

### 4. Document Policy Intent

Use descriptive `Sid` values:

```yaml
- Sid: AllowHeartbeatLambdaDeployment
  Effect: Allow
  Action:
    - 'lambda:UpdateFunctionCode'
  Resource:
    - !Sub 'arn:aws:lambda:${AWSRegion}:${AWSAccountId}:function:heartbeat-publisher-*'
```

### 5. Regular Policy Audits

Periodically review policies for:

- Unused permissions
- Overly permissive wildcards
- Outdated resource references
- Security best practices

### 6. Test in Dev First

Always test policy changes in dev before exp/prod:

1. Update dev CloudFormation template
2. Deploy to dev
3. Test thoroughly
4. Update exp and prod templates
5. Deploy to exp and prod sequentially

## Common Policy Patterns

### Lambda Deployment Pattern

```yaml
- Sid: LambdaDeployment
  Effect: Allow
  Action:
    - 'lambda:CreateFunction'
    - 'lambda:UpdateFunctionCode'
    - 'lambda:UpdateFunctionConfiguration'
    - 'lambda:GetFunction'
    - 'lambda:GetFunctionConfiguration'
  Resource:
    - !Sub 'arn:aws:lambda:${AWSRegion}:${AWSAccountId}:function:${ApplicationName}-*'
```

### CloudWatch Logs Pattern

```yaml
- Sid: CloudWatchLogs
  Effect: Allow
  Action:
    - 'logs:CreateLogGroup'
    - 'logs:PutRetentionPolicy'
    - 'logs:DescribeLogGroups'
  Resource:
    - !Sub 'arn:aws:logs:${AWSRegion}:${AWSAccountId}:log-group:/aws/lambda/${ApplicationName}-*'
```

### S3 Bucket Pattern

```yaml
- Sid: S3BucketAccess
  Effect: Allow
  Action:
    - 's3:CreateBucket'
    - 's3:GetBucketLocation'
    - 's3:ListBucket'
  Resource:
    - !Sub 'arn:aws:s3:::monorepo-fem-${ApplicationName}-*'

- Sid: S3ObjectAccess
  Effect: Allow
  Action:
    - 's3:GetObject'
    - 's3:PutObject'
  Resource:
    - !Sub 'arn:aws:s3:::monorepo-fem-${ApplicationName}-*/*'
```

### DynamoDB Pattern

```yaml
- Sid: DynamoDBTableAccess
  Effect: Allow
  Action:
    - 'dynamodb:CreateTable'
    - 'dynamodb:DescribeTable'
    - 'dynamodb:UpdateTable'
  Resource:
    - !Sub 'arn:aws:dynamodb:${AWSRegion}:${AWSAccountId}:table/monorepo-fem-${ApplicationName}-*'
```

## Troubleshooting

### Policy Too Large

**Error:** `Policy document length 10500 exceeds maximum 10240`

**Solution:**

1. Review policy for redundant statements
2. Use wildcards more efficiently
3. Consider splitting functionality across multiple roles

### Access Denied After Policy Update

**Error:** `AccessDenied: User is not authorized to perform: lambda:CreateFunction`

**Solution:**

1. Check CloudFormation deployment succeeded
2. Verify the policy document in AWS console
3. Check for typos in resource ARNs
4. Ensure IAM changes have propagated (can take up to 5 minutes)

```sh
# Check when role was last modified
aws iam get-role \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --query 'Role.CreateDate' \
  --region ap-southeast-2
```

### Policy Validation Fails

**Error:** `Template validation failed`

**Solution:**

1. Check YAML syntax (indentation, quotes)
2. Verify IAM action names (check AWS documentation)
3. Ensure resource ARNs use correct format
4. Validate with `aws cloudformation validate-template`

## Resources

- [AWS IAM Policy Reference](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies.html)
- [CloudFormation IAM Role Documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-iam-role.html)
- [IAM Policy Simulator](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_testing-policies.html)
- [AWS Service Authorization Reference](https://docs.aws.amazon.com/service-authorization/latest/reference/reference.html)
- [BOOTSTRAP_IAM_ROLES.md](./BOOTSTRAP_IAM_ROLES.md)
- [TROUBLESHOOTING_DEPLOYMENTS.md](./TROUBLESHOOTING_DEPLOYMENTS.md)
