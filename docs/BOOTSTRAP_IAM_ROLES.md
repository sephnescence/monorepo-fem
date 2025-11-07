# Bootstrap IAM Roles for Deployment

This runbook provides step-by-step instructions for manually bootstrapping the IAM infrastructure required for per-app, per-environment AWS deployments.

## Overview

The bootstrap process creates:

- GitHub OIDC provider for authentication
- PolicyManager role for managing IAM policies during deployments
- Deployment roles for each application (heartbeat-publisher, pulse-publisher, scryscraper)
- Shared CloudWatch log group for metrics
- One complete infrastructure stack per environment (dev, exp, prod)

## Prerequisites

Before starting the bootstrap process, ensure you have:

- AWS Account with administrator access
- AWS CLI installed and configured (`aws --version`)
- Appropriate AWS credentials configured (`aws sts get-caller-identity`)
- GitHub repository access (to add secrets later)
- This repository cloned locally

**Verify your AWS configuration:**

```sh
# Check AWS CLI is installed
aws --version

# Verify you're authenticated with the correct account
aws sts get-caller-identity

# Verify your region (should be ap-southeast-2)
aws configure get region

# Set AWS_ACCOUNT_ID environment variable for use in deployment commands
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Verify it's set correctly
echo $AWS_ACCOUNT_ID
```

Expected output should show your AWS account ID and the ap-southeast-2 region.

## Bootstrap Process

### Step 1: Deploy Development Infrastructure Stack

Navigate to the repository root and deploy the dev infrastructure:

```sh
# Deploy dev environment infrastructure
aws cloudformation deploy \
  --template-file devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml \
  --stack-name monorepo-fem-devops-dev \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2 \
  --parameter-overrides \
    GitHubOrganization=sephnescence \
    GitHubRepository=monorepo-fem \
    Environment=dev \
    DeploymentBranch=deploy-dev \
    AWSAccountId=${AWS_ACCOUNT_ID} \
    AWSRegion=ap-southeast-2
```

**What this creates:**

- OIDC provider for GitHub Actions authentication
- PolicyManager role for policy management
- HeartbeatPublisher deployment role
- PulsePublisher deployment role
- ScrysScraper deployment role
- Shared metrics CloudWatch log group

**Wait for completion:**

```sh
# Monitor stack creation progress
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].StackStatus' \
  --output text
```

Wait until the status is `CREATE_COMPLETE`.

**Validation checkpoint:**

```sh
# Verify the stack was created successfully
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].[StackName,StackStatus]' \
  --output table
```

### Step 2: Deploy Experimental Infrastructure Stack

Deploy the exp infrastructure:

```sh
# Deploy exp environment infrastructure
aws cloudformation deploy \
  --template-file devops/exp/monorepo-fem-github-actions-sam-deploy-exp.yml \
  --stack-name monorepo-fem-devops-exp \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2 \
  --parameter-overrides \
    GitHubOrganization=sephnescence \
    GitHubRepository=monorepo-fem \
    Environment=exp \
    DeploymentBranch=deploy-exp \
    AWSAccountId=${AWS_ACCOUNT_ID} \
    AWSRegion=ap-southeast-2
```

**Wait for completion:**

```sh
# Monitor stack creation progress
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-exp \
  --region ap-southeast-2 \
  --query 'Stacks[0].StackStatus' \
  --output text
```

Wait until the status is `CREATE_COMPLETE`.

**Validation checkpoint:**

```sh
# Verify the stack was created successfully
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-exp \
  --region ap-southeast-2 \
  --query 'Stacks[0].[StackName,StackStatus]' \
  --output table
```

### Step 3: Deploy Production Infrastructure Stack

Deploy the prod infrastructure:

```sh
# Deploy prod environment infrastructure
aws cloudformation deploy \
  --template-file devops/prod/monorepo-fem-github-actions-sam-deploy-prod.yml \
  --stack-name monorepo-fem-devops-prod \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2 \
  --parameter-overrides \
    GitHubOrganization=sephnescence \
    GitHubRepository=monorepo-fem \
    Environment=prod \
    DeploymentBranch=deploy-prod \
    AWSAccountId=${AWS_ACCOUNT_ID} \
    AWSRegion=ap-southeast-2
```

**Wait for completion:**

```sh
# Monitor stack creation progress
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-prod \
  --region ap-southeast-2 \
  --query 'Stacks[0].StackStatus' \
  --output text
```

Wait until the status is `CREATE_COMPLETE`.

**Validation checkpoint:**

```sh
# Verify the stack was created successfully
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-prod \
  --region ap-southeast-2 \
  --query 'Stacks[0].[StackName,StackStatus]' \
  --output table
```

### Step 4: Retrieve CloudFormation Outputs (Role ARNs)

After all stacks are deployed, retrieve the role ARNs that GitHub Actions will use:

```sh
# Get all dev role ARNs
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`HeartbeatPublisherDeployRoleArn` || OutputKey==`PulsePublisherDeployRoleArn` || OutputKey==`ScryScraperDeployRoleArn`].[OutputKey,OutputValue]' \
  --output table

# Get all exp role ARNs
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-exp \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`HeartbeatPublisherDeployRoleArn` || OutputKey==`PulsePublisherDeployRoleArn` || OutputKey==`ScryScraperDeployRoleArn`].[OutputKey,OutputValue]' \
  --output table

# Get all prod role ARNs
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-prod \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`HeartbeatPublisherDeployRoleArn` || OutputKey==`PulsePublisherDeployRoleArn` || OutputKey==`ScryScraperDeployRoleArn`].[OutputKey,OutputValue]' \
  --output table
```

**Record these ARNs** - you'll need them for GitHub secrets in the next step.

Expected output format:

```
arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-HeartbeatPublisher-dev
arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-PulsePublisher-dev
arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-ScrysScraper-dev
```

### Step 5: Add Role ARNs to GitHub Secrets

Add the role ARNs as GitHub repository secrets. You can do this via the GitHub UI or CLI.

**Option A: GitHub CLI (recommended):**

```sh
# Install GitHub CLI if not already installed: https://cli.github.com/

# Authenticate with GitHub
gh auth login

# Add dev environment secrets
gh secret set AWS_DEPLOY_ROLE_ARN_HEARTBEAT_DEV --body "arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-HeartbeatPublisher-dev"
gh secret set AWS_DEPLOY_ROLE_ARN_PULSE_DEV --body "arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-PulsePublisher-dev"
gh secret set AWS_DEPLOY_ROLE_ARN_SCRYSCRAPER_DEV --body "arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-ScrysScraper-dev"

# Add exp environment secrets
gh secret set AWS_DEPLOY_ROLE_ARN_HEARTBEAT_EXP --body "arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-HeartbeatPublisher-exp"
gh secret set AWS_DEPLOY_ROLE_ARN_PULSE_EXP --body "arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-PulsePublisher-exp"
gh secret set AWS_DEPLOY_ROLE_ARN_SCRYSCRAPER_EXP --body "arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-ScrysScraper-exp"

# Add prod environment secrets
gh secret set AWS_DEPLOY_ROLE_ARN_HEARTBEAT_PROD --body "arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-HeartbeatPublisher-prod"
gh secret set AWS_DEPLOY_ROLE_ARN_PULSE_PROD --body "arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-PulsePublisher-prod"
gh secret set AWS_DEPLOY_ROLE_ARN_SCRYSCRAPER_PROD --body "arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-ScrysScraper-prod"
```

**Option B: GitHub Web UI:**

1. Navigate to your repository on GitHub
2. Go to Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Add each secret with the corresponding name and ARN value:
   - `AWS_DEPLOY_ROLE_ARN_HEARTBEAT_DEV`
   - `AWS_DEPLOY_ROLE_ARN_PULSE_DEV`
   - `AWS_DEPLOY_ROLE_ARN_SCRYSCRAPER_DEV`
   - `AWS_DEPLOY_ROLE_ARN_HEARTBEAT_EXP`
   - `AWS_DEPLOY_ROLE_ARN_PULSE_EXP`
   - `AWS_DEPLOY_ROLE_ARN_SCRYSCRAPER_EXP`
   - `AWS_DEPLOY_ROLE_ARN_HEARTBEAT_PROD`
   - `AWS_DEPLOY_ROLE_ARN_PULSE_PROD`
   - `AWS_DEPLOY_ROLE_ARN_SCRYSCRAPER_PROD`

**Validation checkpoint:**

```sh
# Verify secrets were added (lists secret names only, not values)
gh secret list
```

### Step 6: Verify OIDC Trust Relationships

Verify that the OIDC provider and trust relationships are configured correctly:

```sh
# Verify OIDC provider exists
aws iam list-open-id-connect-providers --region ap-southeast-2

# Verify dev roles exist and have correct trust policies
aws iam get-role --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev --region ap-southeast-2 --query 'Role.AssumeRolePolicyDocument'
aws iam get-role --role-name GitHubActionsDeployRole-PulsePublisher-dev --region ap-southeast-2 --query 'Role.AssumeRolePolicyDocument'
aws iam get-role --role-name GitHubActionsDeployRole-ScrysScraper-dev --region ap-southeast-2 --query 'Role.AssumeRolePolicyDocument'

# Verify exp roles exist
aws iam get-role --role-name GitHubActionsDeployRole-HeartbeatPublisher-exp --region ap-southeast-2 --query 'Role.RoleName'
aws iam get-role --role-name GitHubActionsDeployRole-PulsePublisher-exp --region ap-southeast-2 --query 'Role.RoleName'
aws iam get-role --role-name GitHubActionsDeployRole-ScrysScraper-exp --region ap-southeast-2 --query 'Role.RoleName'

# Verify prod roles exist
aws iam get-role --role-name GitHubActionsDeployRole-HeartbeatPublisher-prod --region ap-southeast-2 --query 'Role.RoleName'
aws iam get-role --role-name GitHubActionsDeployRole-PulsePublisher-prod --region ap-southeast-2 --query 'Role.RoleName'
aws iam get-role --role-name GitHubActionsDeployRole-ScrysScraper-prod --region ap-southeast-2 --query 'Role.RoleName'
```

**Expected trust policy structure:**

Each role should have a trust policy that:

- Allows `sts:AssumeRoleWithWebIdentity`
- Principal is the OIDC provider: `arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com`
- Condition restricts to the correct deployment branch (deploy-dev, deploy-exp, or deploy-prod)
- Condition restricts to your repository: `repo:sephnescence/monorepo-fem:ref:refs/heads/<branch>`

### Step 7: Test with Workflow Dispatch

Test the deployment by manually triggering a workflow:

1. Navigate to your repository on GitHub
2. Go to Actions tab
3. Select the deployment workflow (e.g., "Deploy Heartbeat Publisher")
4. Click "Run workflow"
5. Select the target environment (dev)
6. Click "Run workflow"

Monitor the workflow execution:

- Verify OIDC authentication succeeds
- Verify the role is assumed correctly
- Verify the deployment completes successfully

**Check workflow logs for:**

- `Assuming role: arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-HeartbeatPublisher-dev`
- `Successfully assumed role`
- `Deployment completed successfully`

### Step 8: Verify Deployment Success

After the workflow completes, verify the deployment:

```sh
# Check dev deployment stacks exist
aws cloudformation list-stacks \
  --region ap-southeast-2 \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?starts_with(StackName, `monorepo-fem-`)].StackName' \
  --output table

# Check Lambda functions were created
aws lambda list-functions \
  --region ap-southeast-2 \
  --query 'Functions[?starts_with(FunctionName, `heartbeat-publisher-`) || starts_with(FunctionName, `pulse-publisher-`) || starts_with(FunctionName, `scryscraper-`)].FunctionName' \
  --output table

# Verify CloudWatch log groups exist
aws logs describe-log-groups \
  --region ap-southeast-2 \
  --log-group-name-prefix /aws/lambda/ \
  --query 'logGroups[?starts_with(logGroupName, `/aws/lambda/heartbeat-publisher-`) || starts_with(logGroupName, `/aws/lambda/pulse-publisher-`) || starts_with(logGroupName, `/aws/lambda/scryscraper-`)].logGroupName' \
  --output table
```

## Validation Checklist

Use this checklist to verify the bootstrap process completed successfully:

- [ ] Dev infrastructure stack created (`CREATE_COMPLETE`)
- [ ] Exp infrastructure stack created (`CREATE_COMPLETE`)
- [ ] Prod infrastructure stack created (`CREATE_COMPLETE`)
- [ ] All role ARNs retrieved from CloudFormation outputs
- [ ] All 9 GitHub secrets added (3 apps x 3 environments)
- [ ] OIDC provider exists in AWS
- [ ] OIDC trust policies verified for all roles
- [ ] Test deployment successful for at least one app in dev
- [ ] Lambda functions created in dev environment
- [ ] CloudWatch log groups created

## Troubleshooting

### CloudFormation Stack Creation Fails

**Error:** `User is not authorised to perform: cloudformation:CreateStack`

**Solution:** Ensure your AWS credentials have administrator access or the necessary permissions to create IAM roles and OIDC providers.

```sh
# Verify your permissions
aws sts get-caller-identity
aws iam get-user --user-name $(aws sts get-caller-identity --query 'Arn' --output text | cut -d'/' -f2)
```

### OIDC Provider Already Exists

**Error:** `EntityAlreadyExists: Provider with url https://token.actions.githubusercontent.com already exists`

**Solution:** This is fine - the OIDC provider can be shared across multiple roles. The CloudFormation template will use the existing provider. If the stack fails, check if an OIDC provider already exists:

```sh
aws iam list-open-id-connect-providers
```

If you need to delete the existing provider (DANGER: this will break other workflows using it):

```sh
aws iam delete-open-id-connect-provider \
  --open-id-connect-provider-arn arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com
```

### Role ARN Not Found in CloudFormation Outputs

**Error:** Role ARN is missing from CloudFormation outputs

**Solution:** The stack may have failed to create completely. Check the stack events:

```sh
aws cloudformation describe-stack-events \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2 \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].[ResourceType,ResourceStatusReason]' \
  --output table
```

Fix any errors and re-run the deployment.

### GitHub Secret Addition Fails

**Error:** `gh: command not found` or authentication issues

**Solution:** Install GitHub CLI and authenticate:

```sh
# Install GitHub CLI (macOS)
brew install gh

# Install GitHub CLI (Linux)
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# Authenticate
gh auth login
```

Alternatively, use the GitHub web UI to add secrets manually.

### Workflow Fails with "Not Authorised" Error

**Error:** `User is not authorised to perform: sts:AssumeRoleWithWebIdentity`

**Solution:** Check the trust policy and GitHub secrets:

1. Verify the GitHub secret contains the correct role ARN
2. Verify the workflow is running from the correct branch (deploy-dev, deploy-exp, or deploy-prod)
3. Verify the trust policy restricts to the correct repository and branch

```sh
# Check trust policy
aws iam get-role \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --query 'Role.AssumeRolePolicyDocument' \
  --output json
```

The trust policy should include:

```json
{
  "Condition": {
    "StringLike": {
      "token.actions.githubusercontent.com:sub": "repo:sephnescence/monorepo-fem:ref:refs/heads/deploy-dev"
    }
  }
}
```

### Lambda Deployment Fails with Permission Denied

**Error:** `AccessDenied: User is not authorised to perform: lambda:CreateFunction`

**Solution:** The deployment role may be missing necessary permissions. Check the role's policies:

```sh
# List attached policies
aws iam list-attached-role-policies \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev

# Check inline policies
aws iam list-role-policies \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev

# Get inline policy document
aws iam get-role-policy \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --policy-name heartbeat-publisher-deploy-policy-dev
```

Verify the policy includes the necessary Lambda permissions.

## Next Steps

After successful bootstrap:

1. Review the [TESTING_PLAN_IAM_SPLIT.md](./TESTING_PLAN_IAM_SPLIT.md) to test each deployment scenario
2. Review [POLICY_MANAGEMENT.md](./POLICY_MANAGEMENT.md) to understand how to manage policies
3. Review [TROUBLESHOOTING_DEPLOYMENTS.md](./TROUBLESHOOTING_DEPLOYMENTS.md) for common deployment issues
4. Consider creating a CloudWatch dashboard for monitoring deployments
5. Set up CloudTrail logging for auditing role usage

## Rollback

If you need to rollback the bootstrap process:

```sh
# Delete all CloudFormation stacks (this will delete all roles and resources)
aws cloudformation delete-stack --stack-name monorepo-fem-devops-prod --region ap-southeast-2
aws cloudformation delete-stack --stack-name monorepo-fem-devops-exp --region ap-southeast-2
aws cloudformation delete-stack --stack-name monorepo-fem-devops-dev --region ap-southeast-2

# Wait for deletion to complete
aws cloudformation wait stack-delete-complete --stack-name monorepo-fem-devops-prod --region ap-southeast-2
aws cloudformation wait stack-delete-complete --stack-name monorepo-fem-devops-exp --region ap-southeast-2
aws cloudformation wait stack-delete-complete --stack-name monorepo-fem-devops-dev --region ap-southeast-2

# Remove GitHub secrets
gh secret delete AWS_DEPLOY_ROLE_ARN_HEARTBEAT_DEV
gh secret delete AWS_DEPLOY_ROLE_ARN_PULSE_DEV
gh secret delete AWS_DEPLOY_ROLE_ARN_SCRYSCRAPER_DEV
gh secret delete AWS_DEPLOY_ROLE_ARN_HEARTBEAT_EXP
gh secret delete AWS_DEPLOY_ROLE_ARN_PULSE_EXP
gh secret delete AWS_DEPLOY_ROLE_ARN_SCRYSCRAPER_EXP
gh secret delete AWS_DEPLOY_ROLE_ARN_HEARTBEAT_PROD
gh secret delete AWS_DEPLOY_ROLE_ARN_PULSE_PROD
gh secret delete AWS_DEPLOY_ROLE_ARN_SCRYSCRAPER_PROD
```

Note: The OIDC provider is shared and may be used by other workflows. Only delete it if you're certain no other workflows depend on it.

## Security Considerations

- The bootstrap process requires elevated AWS permissions (ability to create IAM roles and OIDC providers)
- Only trusted personnel should perform the bootstrap
- Role ARNs are not sensitive, but should be kept organised
- GitHub secrets are encrypted and only accessible to workflows
- OIDC trust policies restrict role assumption to specific branches and repositories
- Monitor CloudTrail logs for unexpected role usage

## Additional Resources

- [AWS CloudFormation User Guide](https://docs.aws.amazon.com/cloudformation/)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS IAM Roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)
- [AWS SAM CLI Reference](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-command-reference.html)
