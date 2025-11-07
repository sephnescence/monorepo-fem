# Developer Onboarding Guide

Welcome to the monorepo-fem project! This guide will help you understand the deployment architecture and get started with developing and deploying applications.

## Table of Contents

- [System Overview](#system-overview)
- [Architecture Concepts](#architecture-concepts)
- [Development Workflow](#development-workflow)
- [Deployment Process](#deployment-process)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)
- [Getting Help](#getting-help)

## System Overview

This is a monorepo containing multiple serverless applications deployed to AWS Lambda using GitHub Actions and OIDC authentication.

**Applications:**

- **heartbeat-publisher**: Scheduled Lambda function that publishes heartbeat events
- **pulse-publisher**: Scheduled Lambda function that publishes pulse events
- **scryscraper**: Lambda function for web scraping operations

**Environments:**

- **dev**: Development environment for testing changes
- **exp**: Experimental/staging environment for pre-production validation
- **prod**: Production environment serving real users

**Key Technologies:**

- AWS Lambda (serverless functions)
- AWS SAM (Serverless Application Model)
- CloudFormation (infrastructure as code)
- GitHub Actions (CI/CD)
- OIDC (authentication without long-lived credentials)
- pnpm (package manager)
- TypeScript/JavaScript

## Architecture Concepts

### Per-App, Per-Environment IAM Roles

Each application has a dedicated IAM role for each environment. This provides:

- **Least privilege security**: Apps can only access their own resources
- **Blast radius reduction**: Issues in one app don't affect others
- **Clear audit trails**: CloudTrail logs show exactly which app accessed what

**Example roles:**

- `GitHubActionsDeployRole-HeartbeatPublisher-dev`
- `GitHubActionsDeployRole-PulsePublisher-exp`
- `GitHubActionsDeployRole-ScrysScraper-prod`

### Branch-Based Deployments

Deployments are triggered by pushing to environment-specific branches:

```
main (development branch, no deployments)
  ↓
deploy-dev (triggers dev deployments)
  ↓
deploy-exp (triggers exp deployments)
  ↓
deploy-prod (triggers prod deployments)
```

**Typical flow:**

1. Develop on feature branches
2. Merge to `main` via pull request
3. Merge `main` to `deploy-dev` to deploy to dev
4. After testing, merge `deploy-dev` to `deploy-exp`
5. After validation, merge `deploy-exp` to `deploy-prod`

### Infrastructure as Code

All infrastructure is defined in CloudFormation templates:

- `devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml`
- `devops/exp/monorepo-fem-github-actions-sam-deploy-exp.yml`
- `devops/prod/monorepo-fem-github-actions-sam-deploy-prod.yml`

Application resources are defined in SAM templates:

- `apps/heartbeat-publisher/template.yaml`
- `apps/pulse-publisher/template.yaml`
- `apps/scryscraper/template.yaml`

## Development Workflow

### Setting Up Your Development Environment

**1. Clone the repository:**

```sh
git clone https://github.com/sephnescence/monorepo-fem.git
cd monorepo-fem
```

**2. Install pnpm** (if not already installed):

```sh
npm install -g pnpm
```

**3. Install dependencies:**

```sh
pnpm install
```

**4. Install AWS CLI** (if not already installed):

```sh
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

**5. Install SAM CLI:**

```sh
# macOS
brew install aws-sam-cli

# Linux
pip install aws-sam-cli
```

**6. Configure AWS credentials** (for local testing):

```sh
aws configure

# Enter your AWS access key ID, secret access key, region (ap-southeast-2), and output format (json)
```

### Working on an Application

**1. Create a feature branch:**

```sh
git checkout -b feature/my-new-feature
```

**2. Make changes to the application:**

Navigate to the app directory and modify code:

```sh
cd apps/heartbeat-publisher
# Edit src/index.ts or other files
```

**3. Test locally with SAM:**

```sh
# Build the application
sam build --template apps/heartbeat-publisher/template.yaml

# Test with a sample event
sam local invoke HeartbeatPublisherFunction --event events/test-event.json

# Start a local API (if applicable)
sam local start-api --template apps/heartbeat-publisher/template.yaml
```

**4. Run linting and tests:**

```sh
# From repository root
pnpm run lint
pnpm run build
pnpm run test
```

**5. Commit changes:**

```sh
git add .
git commit -m "Add new feature to heartbeat-publisher"
git push origin feature/my-new-feature
```

**6. Create a pull request:**

- Go to GitHub
- Create PR from your feature branch to `main`
- Request review from team members
- Address any feedback

**7. Merge to main:**

Once approved, merge your PR to `main`.

## Deployment Process

### Deploying to Dev

**Option 1: Automatic deployment via branch push:**

```sh
# Merge main to deploy-dev
git checkout deploy-dev
git merge main
git push origin deploy-dev

# This triggers the GitHub Actions workflow
```

**Option 2: Manual deployment via workflow dispatch:**

1. Go to GitHub Actions
2. Select the deployment workflow (e.g., "Deploy Heartbeat Publisher")
3. Click "Run workflow"
4. Select environment: dev
5. Click "Run workflow"

**Monitor deployment:**

- Go to GitHub Actions
- Find the running workflow
- Monitor progress and logs
- Verify deployment succeeds

**Verify in AWS:**

```sh
# Check Lambda function was updated
aws lambda get-function \
  --function-name heartbeat-publisher-dev-function \
  --region ap-southeast-2 \
  --query 'Configuration.[FunctionName,LastModified,State]'

# Check CloudWatch logs
aws logs tail /aws/lambda/heartbeat-publisher-dev-function --follow
```

### Deploying to Exp

After testing in dev:

```sh
git checkout deploy-exp
git merge deploy-dev
git push origin deploy-exp
```

### Deploying to Prod

After validation in exp:

```sh
git checkout deploy-prod
git merge deploy-exp
git push origin deploy-prod
```

**IMPORTANT:** Always test in dev and exp before deploying to prod!

## Common Tasks

### Adding a New Lambda Function to an Existing App

**1. Update the SAM template** (`apps/heartbeat-publisher/template.yaml`):

```yaml
Resources:
  NewFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: heartbeat-publisher-new-function
      Handler: src/new-handler.handler
      Runtime: nodejs18.x
      Timeout: 30
      Events:
        Schedule:
          Type: Schedule
          Properties:
            Schedule: rate(5 minutes)
```

**2. Create the handler** (`apps/heartbeat-publisher/src/new-handler.ts`):

```typescript
export const handler = async (event: any) => {
  console.log('New handler invoked', event);
  // Your logic here
  return { statusCode: 200, body: 'Success' };
};
```

**3. Test locally:**

```sh
sam build --template apps/heartbeat-publisher/template.yaml
sam local invoke NewFunction
```

**4. Deploy to dev:**

```sh
git checkout deploy-dev
git merge main
git push origin deploy-dev
```

### Updating IAM Permissions

**1. Locate the CloudFormation template** for the environment:

```
devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml
```

**2. Find the application's deployment role:**

Search for `HeartbeatPublisherDeployRole` (or appropriate role).

**3. Add the new permissions:**

```yaml
- Sid: NewPermissions
  Effect: Allow
  Action:
    - 's3:GetObject'
    - 's3:PutObject'
  Resource:
    - !Sub 'arn:aws:s3:::monorepo-fem-heartbeat-data-${Environment}/*'
```

**4. Deploy the updated infrastructure:**

```sh
aws cloudformation deploy \
  --template-file devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml \
  --stack-name monorepo-fem-devops-dev \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2
```

**5. Repeat for exp and prod environments.**

For more details, see [POLICY_MANAGEMENT.md](./POLICY_MANAGEMENT.md).

### Viewing Application Logs

**View recent logs:**

```sh
# Tail logs in real-time
aws logs tail /aws/lambda/heartbeat-publisher-dev-function --follow

# Get logs from last hour
aws logs tail /aws/lambda/heartbeat-publisher-dev-function --since 1h

# Filter for errors
aws logs tail /aws/lambda/heartbeat-publisher-dev-function --filter-pattern "ERROR"
```

**View logs in AWS Console:**

1. Go to CloudWatch Logs
2. Navigate to `/aws/lambda/heartbeat-publisher-dev-function`
3. Select the latest log stream
4. View log events

### Invoking a Lambda Function Manually

```sh
# Invoke function and see output
aws lambda invoke \
  --function-name heartbeat-publisher-dev-function \
  --region ap-southeast-2 \
  --payload '{"test": true}' \
  response.json

# View response
cat response.json
```

### Rolling Back a Deployment

**If deployment fails automatically:**

CloudFormation will automatically roll back to the previous state.

**If deployment succeeds but has issues:**

**Option 1: Revert code and redeploy:**

```sh
git revert <commit-hash>
git push origin main

# Merge to deployment branch
git checkout deploy-dev
git merge main
git push origin deploy-dev
```

**Option 2: CloudFormation rollback:**

```sh
aws cloudformation rollback-stack \
  --stack-name monorepo-fem-heartbeat-publisher-dev \
  --region ap-southeast-2
```

**Option 3: Update Lambda alias to previous version:**

```sh
# List versions
aws lambda list-versions-by-function \
  --function-name heartbeat-publisher-dev-function \
  --region ap-southeast-2

# Update alias to previous version
aws lambda update-alias \
  --function-name heartbeat-publisher-dev-function \
  --name dev \
  --function-version <previous-version> \
  --region ap-southeast-2
```

## Troubleshooting

### Deployment Fails with "Access Denied"

**Cause:** The IAM role doesn't have the necessary permissions.

**Solution:**

1. Check the CloudTrail logs to identify the denied operation:

```sh
aws cloudtrail lookup-events \
  --region ap-southeast-2 \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AccessDenied \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)
```

2. Update the IAM policy in the CloudFormation template
3. Redeploy the infrastructure stack

See [TROUBLESHOOTING_DEPLOYMENTS.md](./TROUBLESHOOTING_DEPLOYMENTS.md) for more details.

### Lambda Function Doesn't Appear in AWS

**Cause:** Deployment may have failed or the function name doesn't match expectations.

**Solution:**

1. Check GitHub Actions logs for errors
2. Verify CloudFormation stack status:

```sh
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-heartbeat-publisher-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].StackStatus'
```

3. Check for failed resources:

```sh
aws cloudformation describe-stack-events \
  --stack-name monorepo-fem-heartbeat-publisher-dev \
  --region ap-southeast-2 \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED` || ResourceStatus==`UPDATE_FAILED`]'
```

### Workflow Doesn't Trigger

**Cause:** Branch name mismatch or path filters excluding changes.

**Solution:**

1. Verify you pushed to the correct branch (deploy-dev, deploy-exp, or deploy-prod)
2. Check workflow file for path filters
3. Manually trigger via workflow dispatch

### Local SAM Testing Fails

**Cause:** Dependencies not installed or Docker not running.

**Solution:**

1. Ensure Docker is installed and running:

```sh
docker --version
docker ps
```

2. Rebuild the application:

```sh
sam build --template apps/heartbeat-publisher/template.yaml
```

3. Check for errors in the build output

## Getting Help

### Documentation

- [AWS_OIDC_SETUP.md](./AWS_OIDC_SETUP.md) - OIDC and IAM architecture
- [BOOTSTRAP_IAM_ROLES.md](./BOOTSTRAP_IAM_ROLES.md) - Infrastructure setup
- [POLICY_MANAGEMENT.md](./POLICY_MANAGEMENT.md) - IAM policy management
- [TROUBLESHOOTING_DEPLOYMENTS.md](./TROUBLESHOOTING_DEPLOYMENTS.md) - Common issues

### Useful Commands

See [../devops/README.md](../devops/README.md) for bootstrap commands.

**Local development:**
```sh
sam build --template apps/heartbeat-publisher/template.yaml
sam local invoke HeartbeatPublisherFunction
```

**Monitoring:**
```sh
aws logs tail /aws/lambda/heartbeat-publisher-dev-function --follow
aws lambda get-function --function-name heartbeat-publisher-dev-function
```

### External Resources

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS SAM Developer Guide](https://docs.aws.amazon.com/serverless-application-model/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Next Steps

After completing this onboarding:

1. **Set up your development environment** following the steps above
2. **Review the codebase** - explore the apps directory
3. **Make a small change** in dev to familiarise yourself with the workflow
4. **Read the architecture documentation** to understand the system design
5. **Ask questions** - reach out to team members if anything is unclear

Welcome to the team!
