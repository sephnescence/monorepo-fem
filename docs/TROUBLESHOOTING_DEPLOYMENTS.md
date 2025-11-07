# Troubleshooting Deployments

This guide provides solutions to common deployment issues in the per-app, per-environment IAM architecture.

## Table of Contents

- [OIDC Authentication Issues](#oidc-authentication-issues)
- [Permission Errors](#permission-errors)
- [CloudFormation Errors](#cloudformation-errors)
- [Lambda Deployment Issues](#lambda-deployment-issues)
- [SAM Build and Deploy Issues](#sam-build-and-deploy-issues)
- [GitHub Actions Workflow Issues](#github-actions-workflow-issues)
- [Role Assumption Issues](#role-assumption-issues)
- [Using CloudWatch and CloudTrail](#using-cloudwatch-and-cloudtrail)

## OIDC Authentication Issues

### Error: "Not authorized to perform sts:AssumeRoleWithWebIdentity"

**Symptoms:**

```
Error: AssumeRoleWithWebIdentity failed: User is not authorized to perform: sts:AssumeRoleWithWebIdentity on resource: arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-HeartbeatPublisher-dev
```

**Possible Causes:**

1. Wrong branch triggering the workflow
2. Trust policy doesn't match the repository or branch
3. GitHub secret contains incorrect role ARN
4. OIDC provider not configured correctly

**Solutions:**

**1. Verify the branch:**

Check that the workflow is running from the correct deployment branch:

- Dev deployments: `deploy-dev` branch
- Exp deployments: `deploy-exp` branch
- Prod deployments: `deploy-prod` branch

**2. Check the trust policy:**

```sh
aws iam get-role \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --region ap-southeast-2 \
  --query 'Role.AssumeRolePolicyDocument' \
  --output json
```

Verify the trust policy includes:

```json
{
  "Condition": {
    "StringLike": {
      "token.actions.githubusercontent.com:sub": "repo:sephnescence/monorepo-fem:ref:refs/heads/deploy-dev"
    }
  }
}
```

**3. Verify GitHub secret:**

```sh
# List secrets (shows names only, not values)
gh secret list

# The secret should be named: AWS_DEPLOY_ROLE_ARN_HEARTBEAT_DEV
# And contain: arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-HeartbeatPublisher-dev
```

**4. Check OIDC provider:**

```sh
aws iam list-open-id-connect-providers --region ap-southeast-2
```

The OIDC provider should exist with URL `https://token.actions.githubusercontent.com`.

### Error: "Token audience validation failed"

**Symptoms:**

```
Error: Provided token is not valid for audience: sts.amazonaws.com
```

**Solution:**

Check that the OIDC provider has `sts.amazonaws.com` in its client ID list:

```sh
aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com \
  --region ap-southeast-2 \
  --query 'ClientIDList'
```

If missing, update the CloudFormation stack to add it.

## Permission Errors

### Error: "AccessDenied" for Lambda Operations

**Symptoms:**

```
Error: User is not authorized to perform: lambda:CreateFunction on resource: arn:aws:lambda:ap-southeast-2:${AWS_ACCOUNT_ID}:function:heartbeat-publisher-dev-function
```

**Solutions:**

**1. Verify the role has Lambda permissions:**

```sh
aws iam get-role-policy \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --policy-name heartbeat-publisher-deploy-policy-dev \
  --region ap-southeast-2 \
  --query 'PolicyDocument.Statement[?contains(Action, `lambda:CreateFunction`)]'
```

**2. Check resource ARN matches policy:**

The Lambda function name must match the pattern in the policy. For heartbeat-publisher, the policy scopes to:

```
arn:aws:lambda:ap-southeast-2:*:function:heartbeat-publisher-*
```

Ensure your Lambda function name starts with `heartbeat-publisher-`.

**3. Wait for IAM propagation:**

IAM changes can take up to 5 minutes to propagate. If you just updated the policy, wait and retry.

**4. Check CloudTrail for exact error:**

```sh
aws cloudtrail lookup-events \
  --region ap-southeast-2 \
  --lookup-attributes AttributeKey=EventName,AttributeValue=CreateFunction \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --query 'Events[?ErrorCode==`AccessDenied`].[EventTime,Username,ErrorCode,ErrorMessage]' \
  --output table
```

### Error: "AccessDenied" for CloudFormation Operations

**Symptoms:**

```
Error: User is not authorized to perform: cloudformation:CreateStack on resource: arn:aws:cloudformation:ap-southeast-2:${AWS_ACCOUNT_ID}:stack/monorepo-fem-heartbeat-publisher-dev
```

**Solutions:**

**1. Verify CloudFormation permissions in policy:**

```sh
aws iam get-role-policy \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --policy-name heartbeat-publisher-deploy-policy-dev \
  --region ap-southeast-2 \
  --query 'PolicyDocument.Statement[?contains(Action, `cloudformation:CreateStack`)]'
```

**2. Check stack name matches policy:**

The policy scopes to:

```
arn:aws:cloudformation:ap-southeast-2:${AWS_ACCOUNT_ID}:stack/monorepo-fem-heartbeat-publisher-dev*/*
```

Ensure your stack name starts with `monorepo-fem-heartbeat-publisher-dev`.

### Error: "AccessDenied" for S3 Operations

**Symptoms:**

```
Error: Access Denied while accessing S3 bucket: aws-sam-cli--monorepo-fem--dev-abc123
```

**Solutions:**

**1. Verify S3 permissions exist:**

```sh
aws iam get-role-policy \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --policy-name heartbeat-publisher-deploy-policy-dev \
  --region ap-southeast-2 \
  --query 'PolicyDocument.Statement[?contains(Resource, `s3`)]'
```

**2. Check bucket name matches policy:**

The policy should include wildcards for SAM-managed buckets:

```
arn:aws:s3:::aws-sam-cli--monorepo-fem--*
```

**3. Verify bucket exists:**

```sh
aws s3api list-buckets \
  --query "Buckets[?starts_with(Name, 'aws-sam-cli--monorepo-fem')].Name"
```

## CloudFormation Errors

### Error: "No changes to deploy"

**Symptoms:**

```
No changes to deploy. Stack monorepo-fem-heartbeat-publisher-dev is up to date.
```

**This is not an error** - it means the stack is already in the desired state. The workflow should continue successfully.

### Error: "Stack is in UPDATE_ROLLBACK_COMPLETE state"

**Symptoms:**

```
Stack monorepo-fem-heartbeat-publisher-dev is in UPDATE_ROLLBACK_COMPLETE state and can not be updated
```

**Solution:**

The previous deployment failed and rolled back. You need to continue the rollback or manually fix:

```sh
# Option 1: Continue the rollback
aws cloudformation continue-update-rollback \
  --stack-name monorepo-fem-heartbeat-publisher-dev \
  --region ap-southeast-2

# Option 2: Delete and recreate (DANGER: deletes all resources)
aws cloudformation delete-stack \
  --stack-name monorepo-fem-heartbeat-publisher-dev \
  --region ap-southeast-2

# Wait for deletion
aws cloudformation wait stack-delete-complete \
  --stack-name monorepo-fem-heartbeat-publisher-dev \
  --region ap-southeast-2

# Re-run deployment
```

**Check why the deployment failed:**

```sh
aws cloudformation describe-stack-events \
  --stack-name monorepo-fem-heartbeat-publisher-dev \
  --region ap-southeast-2 \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED` || ResourceStatus==`UPDATE_FAILED`].[Timestamp,ResourceType,ResourceStatusReason]' \
  --output table
```

### Error: "Resource already exists"

**Symptoms:**

```
Resource of type 'AWS::Lambda::Function' with identifier 'heartbeat-publisher-dev-function' already exists
```

**Solution:**

CloudFormation is trying to create a resource that already exists outside of its management.

**Option 1: Import the existing resource** (preferred):

```sh
# Create a change set to import the resource
aws cloudformation create-change-set \
  --stack-name monorepo-fem-heartbeat-publisher-dev \
  --change-set-name import-existing-function \
  --change-set-type IMPORT \
  --resources-to-import file://resources-to-import.json \
  --template-body file://apps/heartbeat-publisher/template.yaml \
  --region ap-southeast-2
```

**Option 2: Delete the existing resource** (DANGER: data loss):

```sh
aws lambda delete-function \
  --function-name heartbeat-publisher-dev-function \
  --region ap-southeast-2
```

## Lambda Deployment Issues

### Error: "Function code validation failed"

**Symptoms:**

```
Error: Failed to create function: InvalidParameterValueException: Function code validation failed
```

**Solutions:**

**1. Check Lambda package size:**

Lambda deployment packages have size limits:

- Unzipped: 250 MB
- Zipped: 50 MB (direct upload), 250 MB (from S3)

```sh
# Check deployment package size
ls -lh .aws-sam/build/HeartbeatPublisherFunction/
```

**2. Verify dependencies are compatible:**

Ensure all dependencies are compatible with the Lambda runtime (e.g., Python 3.11, Node.js 18).

**3. Check for binary dependencies:**

If using Python, ensure binary dependencies are built for Amazon Linux 2:

```sh
# Build dependencies for Lambda environment
pip install --platform manylinux2014_x86_64 --only-binary=:all: -t package/ -r requirements.txt
```

### Error: "Lambda function execution fails"

**Symptoms:**

Function deploys successfully but fails when invoked.

**Solutions:**

**1. Check CloudWatch Logs:**

```sh
# Get latest log stream
aws logs describe-log-streams \
  --log-group-name /aws/lambda/heartbeat-publisher-dev-function \
  --region ap-southeast-2 \
  --order-by LastEventTime \
  --descending \
  --max-items 1 \
  --query 'logStreams[0].logStreamName' \
  --output text

# Get log events
aws logs get-log-events \
  --log-group-name /aws/lambda/heartbeat-publisher-dev-function \
  --log-stream-name '<log-stream-name>' \
  --region ap-southeast-2 \
  --limit 50
```

**2. Test function locally:**

```sh
# Test with SAM CLI
sam local invoke HeartbeatPublisherFunction --event events/test-event.json
```

**3. Check function configuration:**

```sh
aws lambda get-function-configuration \
  --function-name heartbeat-publisher-dev-function \
  --region ap-southeast-2 \
  --query '{Runtime:Runtime,Handler:Handler,Timeout:Timeout,Memory:MemorySize,Environment:Environment}'
```

## SAM Build and Deploy Issues

### Error: "Build Failed"

**Symptoms:**

```
Error: Build Failed
```

**Solutions:**

**1. Check SAM template syntax:**

```sh
sam validate --template apps/heartbeat-publisher/template.yaml
```

**2. Verify build directory is clean:**

```sh
# Clean build artefacts
rm -rf .aws-sam/

# Rebuild
sam build --template apps/heartbeat-publisher/template.yaml
```

**3. Check runtime compatibility:**

Ensure the Lambda runtime specified in `template.yaml` matches your dependencies.

### Error: "Unable to upload artefact"

**Symptoms:**

```
Error: Failed to upload artefact to S3: Access Denied
```

**Solutions:**

**1. Verify S3 permissions:**

Check that the role has S3 PutObject permissions for SAM buckets.

**2. Check S3 bucket exists:**

```sh
aws s3api list-buckets \
  --query "Buckets[?starts_with(Name, 'aws-sam-cli-managed')].Name"
```

**3. Verify bucket region:**

SAM buckets must be in the same region as the deployment:

```sh
aws s3api get-bucket-location \
  --bucket aws-sam-cli--monorepo-fem--dev-abc123
```

## GitHub Actions Workflow Issues

### Error: "Secret not found"

**Symptoms:**

```
Error: The secret AWS_DEPLOY_ROLE_ARN_HEARTBEAT_DEV was not found
```

**Solutions:**

**1. Verify secret exists:**

```sh
gh secret list | grep AWS_DEPLOY_ROLE_ARN
```

**2. Check secret name spelling:**

Secret names must match exactly (case-sensitive):

- `AWS_DEPLOY_ROLE_ARN_HEARTBEAT_DEV` (correct)
- `AWS_DEPLOY_ROLE_ARN_HEARTBEAT_Dev` (incorrect)

**3. Add the secret:**

```sh
gh secret set AWS_DEPLOY_ROLE_ARN_HEARTBEAT_DEV --body "arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole-HeartbeatPublisher-dev"
```

### Error: "Workflow doesn't trigger on push"

**Symptoms:**

Pushed to `deploy-dev` branch but workflow didn't run.

**Solutions:**

**1. Check workflow trigger configuration:**

Verify `.github/workflows/deploy-heartbeat-publisher.yml` has:

```yaml
on:
  push:
    branches:
      - deploy-dev
      - deploy-exp
      - deploy-prod
```

**2. Check path filters:**

If using path filters, ensure the changed files match:

```yaml
on:
  push:
    paths:
      - 'apps/heartbeat-publisher/**'
```

**3. Verify branch protection rules:**

Check that branch protection rules aren't blocking the workflow.

### Error: "Workflow times out"

**Symptoms:**

```
Error: The workflow was cancelled because it exceeded the maximum execution time of 60 minutes
```

**Solutions:**

**1. Increase workflow timeout:**

```yaml
jobs:
  deploy:
    timeout-minutes: 120
```

**2. Optimise build process:**

- Cache dependencies
- Use lighter base images
- Parallelise independent steps

**3. Check for hanging processes:**

Review workflow logs for steps that take unusually long.

## Role Assumption Issues

### Error: "Role session duration exceeded"

**Symptoms:**

```
Error: The requested DurationSeconds exceeds the MaxSessionDuration set for this role
```

**Solution:**

Increase the `MaxSessionDuration` in the CloudFormation template:

```yaml
HeartbeatPublisherDeployRole:
  Type: AWS::IAM::Role
  Properties:
    MaxSessionDuration: 7200  # 2 hours (max for role chaining)
```

Redeploy the infrastructure stack.

### Error: "Unable to assume role with web identity"

**Symptoms:**

```
Error: Cannot assume role with web identity: InvalidIdentityToken
```

**Solutions:**

**1. Check OIDC provider thumbprint:**

The thumbprint may have changed. Verify it matches GitHub's current certificate:

```sh
echo | openssl s_client -servername token.actions.githubusercontent.com \
  -connect token.actions.githubusercontent.com:443 2>/dev/null | \
  openssl x509 -fingerprint -noout | \
  sed 's/://g' | \
  awk -F= '{print tolower($2)}'
```

**2. Verify OIDC provider configuration:**

```sh
aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com \
  --region ap-southeast-2
```

## Using CloudWatch and CloudTrail

### Checking CloudWatch Logs

**View recent Lambda invocations:**

```sh
# List log streams
aws logs describe-log-streams \
  --log-group-name /aws/lambda/heartbeat-publisher-dev-function \
  --region ap-southeast-2 \
  --order-by LastEventTime \
  --descending \
  --max-items 10

# Get log events from a specific stream
aws logs get-log-events \
  --log-group-name /aws/lambda/heartbeat-publisher-dev-function \
  --log-stream-name '2024/11/07/[$LATEST]abc123' \
  --region ap-southeast-2
```

**Filter logs for errors:**

```sh
aws logs filter-log-events \
  --log-group-name /aws/lambda/heartbeat-publisher-dev-function \
  --region ap-southeast-2 \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '1 hour ago' +%s)000 \
  --limit 50
```

### Using CloudTrail for Debugging

**Find role assumption events:**

```sh
aws cloudtrail lookup-events \
  --region ap-southeast-2 \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --query 'Events[?contains(CloudTrailEvent, `GitHubActionsDeployRole`)].[EventTime,Username,Resources]' \
  --output table
```

**Find permission denied errors:**

```sh
aws cloudtrail lookup-events \
  --region ap-southeast-2 \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AccessDenied \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --query 'Events[].[EventTime,Username,EventName,ErrorCode,ErrorMessage]' \
  --output table
```

**Trace specific resource access:**

```sh
aws cloudtrail lookup-events \
  --region ap-southeast-2 \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=heartbeat-publisher-dev-function \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --query 'Events[].[EventTime,EventName,Username,Resources]' \
  --output table
```

### Debugging Permission Issues with CloudTrail

When you encounter `AccessDenied` errors:

1. **Find the denied API call in CloudTrail:**

```sh
aws cloudtrail lookup-events \
  --region ap-southeast-2 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --max-results 50 \
  --query 'Events[?ErrorCode==`AccessDenied`]' \
  --output json
```

2. **Identify the missing permission:**

The event will show:

- `EventName`: The API action that was denied (e.g., `CreateFunction`)
- `Resources`: The resource ARN that was accessed
- `UserIdentity`: The role that was used

3. **Update the policy:**

Add the missing permission to the CloudFormation template and redeploy.

## Verifying Role Assumption

Check which role a workflow is using:

```sh
# In the GitHub Actions workflow, add a step:
- name: Verify AWS identity
  run: |
    aws sts get-caller-identity
```

This will output the assumed role ARN, which should match the expected deployment role.

## Emergency Procedures

### Rollback a Failed Deployment

If a deployment causes issues in production:

**Option 1: CloudFormation rollback:**

```sh
aws cloudformation rollback-stack \
  --stack-name monorepo-fem-heartbeat-publisher-prod \
  --region ap-southeast-2
```

**Option 2: Revert to previous Lambda version:**

```sh
# List versions
aws lambda list-versions-by-function \
  --function-name heartbeat-publisher-prod-function \
  --region ap-southeast-2

# Update alias to previous version
aws lambda update-alias \
  --function-name heartbeat-publisher-prod-function \
  --name prod \
  --function-version 42 \
  --region ap-southeast-2
```

### Disable a Malfunctioning Lambda

If a Lambda is causing issues:

```sh
# Update concurrency to 0 (effectively disables)
aws lambda put-function-concurrency \
  --function-name heartbeat-publisher-prod-function \
  --reserved-concurrent-executions 0 \
  --region ap-southeast-2

# To re-enable later
aws lambda delete-function-concurrency \
  --function-name heartbeat-publisher-prod-function \
  --region ap-southeast-2
```

### Disable EventBridge Rule

If a scheduled Lambda is misbehaving:

```sh
# Disable the rule
aws events disable-rule \
  --name heartbeat-publisher-prod-schedule \
  --region ap-southeast-2

# Re-enable later
aws events enable-rule \
  --name heartbeat-publisher-prod-schedule \
  --region ap-southeast-2
```

## Getting Help

If you're stuck:

1. Check this troubleshooting guide
2. Review [BOOTSTRAP_IAM_ROLES.md](./BOOTSTRAP_IAM_ROLES.md) for setup issues
3. Review [POLICY_MANAGEMENT.md](./POLICY_MANAGEMENT.md) for policy issues
4. Check CloudWatch Logs for application errors
5. Check CloudTrail for permission errors
6. Review GitHub Actions workflow logs
7. Check AWS Service Health Dashboard for service outages

## Common Resolution Checklist

When troubleshooting, work through this checklist:

- [ ] Check GitHub Actions workflow logs
- [ ] Verify GitHub secrets are set correctly
- [ ] Verify running from correct branch (deploy-dev/exp/prod)
- [ ] Check role trust policy matches repository and branch
- [ ] Verify role has required permissions
- [ ] Check CloudTrail for AccessDenied errors
- [ ] Review CloudWatch Logs for application errors
- [ ] Verify resources follow naming conventions
- [ ] Check IAM propagation (wait 5 minutes after policy changes)
- [ ] Validate CloudFormation template syntax
- [ ] Check AWS Service Health Dashboard

## Additional Resources

- [AWS Troubleshooting Guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/troubleshoot.html)
- [GitHub Actions Troubleshooting](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows)
- [CloudFormation Troubleshooting](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/troubleshooting.html)
- [SAM CLI Troubleshooting](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-logging.html)
