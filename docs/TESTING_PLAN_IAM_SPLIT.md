# Testing Plan: IAM Role Split Implementation

This document outlines the comprehensive testing strategy for validating the per-app, per-environment IAM role architecture.

## Overview

The testing plan covers:

- Unit tests for individual components
- Integration tests for end-to-end workflow execution
- Security tests to verify least privilege enforcement
- Regression tests to ensure existing functionality works

## Test Environments

All testing will be performed in the **dev environment** as per the agreed testing strategy.

**Environment:** AWS ap-southeast-2 region, dev environment only

**Applications under test:**

- heartbeat-publisher
- pulse-publisher
- scryscraper

## Test Scenarios

### Scenario 1: Deploy Heartbeat Publisher to Dev

**Objective:** Verify that the heartbeat-publisher can be deployed successfully using its dedicated IAM role.

**Prerequisites:**

- Dev infrastructure stack deployed
- GitHub secrets configured
- Workflow updated to use per-app role

**Test Steps:**

1. Trigger deployment workflow for heartbeat-publisher targeting dev environment
2. Monitor workflow execution in GitHub Actions
3. Verify OIDC authentication succeeds
4. Verify role assumption succeeds
5. Verify CloudFormation stack is created/updated
6. Verify Lambda function is deployed
7. Verify CloudWatch logs are created
8. Verify EventBridge rule is created (if applicable)

**Expected Results:**

- Workflow completes successfully
- Lambda function `heartbeat-publisher-dev-*` exists
- CloudWatch log group `/aws/lambda/heartbeat-publisher-dev-*` exists
- CloudFormation stack `monorepo-fem-heartbeat-publisher-dev` is `CREATE_COMPLETE` or `UPDATE_COMPLETE`
- No permission denied errors in workflow logs

**Validation Commands:**

```sh
# Check CloudFormation stack
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-heartbeat-publisher-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].StackStatus'

# Check Lambda function
aws lambda get-function \
  --function-name heartbeat-publisher-dev-function \
  --region ap-southeast-2 \
  --query 'Configuration.[FunctionName,State]'

# Check CloudWatch log group
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/heartbeat-publisher-dev \
  --region ap-southeast-2 \
  --query 'logGroups[].logGroupName'
```

**Success Criteria:**

- [ ] Workflow shows "Deployment completed successfully"
- [ ] Lambda function is in `Active` state
- [ ] CloudWatch log group exists with correct retention
- [ ] No access denied errors in CloudTrail logs

### Scenario 2: Deploy Pulse Publisher to Dev

**Objective:** Verify that the pulse-publisher can be deployed successfully using its dedicated IAM role.

**Prerequisites:**

- Dev infrastructure stack deployed
- GitHub secrets configured
- Workflow updated to use per-app role

**Test Steps:**

1. Trigger deployment workflow for pulse-publisher targeting dev environment
2. Monitor workflow execution in GitHub Actions
3. Verify OIDC authentication succeeds
4. Verify role assumption succeeds
5. Verify CloudFormation stack is created/updated
6. Verify Lambda function is deployed
7. Verify CloudWatch logs are created
8. Verify EventBridge rule is created (if applicable)

**Expected Results:**

- Workflow completes successfully
- Lambda function `pulse-publisher-dev-*` exists
- CloudWatch log group `/aws/lambda/pulse-publisher-dev-*` exists
- CloudFormation stack `monorepo-fem-pulse-publisher-dev` is `CREATE_COMPLETE` or `UPDATE_COMPLETE`
- No permission denied errors in workflow logs

**Validation Commands:**

```sh
# Check CloudFormation stack
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-pulse-publisher-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].StackStatus'

# Check Lambda function
aws lambda get-function \
  --function-name pulse-publisher-dev-function \
  --region ap-southeast-2 \
  --query 'Configuration.[FunctionName,State]'

# Check CloudWatch log group
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/pulse-publisher-dev \
  --region ap-southeast-2 \
  --query 'logGroups[].logGroupName'
```

**Success Criteria:**

- [ ] Workflow shows "Deployment completed successfully"
- [ ] Lambda function is in `Active` state
- [ ] CloudWatch log group exists with correct retention
- [ ] No access denied errors in CloudTrail logs

### Scenario 3: Deploy Scryscraper to Dev

**Objective:** Verify that the scryscraper can be deployed successfully using its dedicated IAM role.

**Prerequisites:**

- Dev infrastructure stack deployed
- GitHub secrets configured
- Workflow updated to use per-app role

**Test Steps:**

1. Trigger deployment workflow for scryscraper targeting dev environment
2. Monitor workflow execution in GitHub Actions
3. Verify OIDC authentication succeeds
4. Verify role assumption succeeds
5. Verify CloudFormation stack is created/updated
6. Verify Lambda function is deployed
7. Verify S3 cache bucket is created (if applicable)
8. Verify DynamoDB table is created (if applicable)
9. Verify CloudWatch logs are created

**Expected Results:**

- Workflow completes successfully
- Lambda function `scryscraper-dev-*` exists
- S3 bucket `monorepo-fem-scryscraper-cache-dev-*` exists (if configured)
- DynamoDB table `monorepo-fem-scryscraper-dev-*` exists (if configured)
- CloudWatch log group `/aws/lambda/scryscraper-dev-*` exists
- CloudFormation stack `monorepo-fem-scryscraper-dev` is `CREATE_COMPLETE` or `UPDATE_COMPLETE`

**Validation Commands:**

```sh
# Check CloudFormation stack
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-scryscraper-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].StackStatus'

# Check Lambda function
aws lambda get-function \
  --function-name scryscraper-dev-function \
  --region ap-southeast-2 \
  --query 'Configuration.[FunctionName,State]'

# Check S3 bucket (if applicable)
aws s3api list-buckets \
  --query "Buckets[?starts_with(Name, 'monorepo-fem-scryscraper-cache-dev')].Name"

# Check DynamoDB table (if applicable)
aws dynamodb list-tables \
  --region ap-southeast-2 \
  --query "TableNames[?starts_with(@, 'monorepo-fem-scryscraper-dev')]"

# Check CloudWatch log group
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/scryscraper-dev \
  --region ap-southeast-2 \
  --query 'logGroups[].logGroupName'
```

**Success Criteria:**

- [ ] Workflow shows "Deployment completed successfully"
- [ ] Lambda function is in `Active` state
- [ ] CloudWatch log group exists with correct retention
- [ ] Additional resources (S3, DynamoDB) created if configured
- [ ] No access denied errors in CloudTrail logs

### Scenario 4: Heartbeat Role Cannot Access Pulse Resources (Security Test)

**Objective:** Verify that the heartbeat-publisher IAM role cannot access pulse-publisher resources, enforcing least privilege.

**Prerequisites:**

- Both heartbeat-publisher and pulse-publisher deployed to dev
- CloudTrail logging enabled

**Test Steps:**

1. Attempt to manually assume the heartbeat-publisher role
2. Try to invoke the pulse-publisher Lambda function
3. Try to read pulse-publisher CloudWatch logs
4. Try to update pulse-publisher CloudFormation stack
5. Verify all operations are denied

**Validation Commands:**

```sh
# Assume heartbeat-publisher role (replace with actual role ARN)
aws sts assume-role \
  --role-arn arn:aws:iam::395380602678:role/GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --role-session-name test-session \
  --region ap-southeast-2

# Using temporary credentials from above, try to invoke pulse-publisher function
# (This should fail with AccessDenied)
aws lambda invoke \
  --function-name pulse-publisher-dev-function \
  --region ap-southeast-2 \
  /tmp/response.json

# Try to read pulse-publisher logs (should fail)
aws logs get-log-events \
  --log-group-name /aws/lambda/pulse-publisher-dev-function \
  --log-stream-name 2024/01/01/test \
  --region ap-southeast-2
```

**Expected Results:**

- All operations should return `AccessDenied` or similar permission errors
- CloudTrail logs should show denied API calls
- No resources from pulse-publisher should be accessible

**Success Criteria:**

- [ ] Lambda invoke denied
- [ ] CloudWatch logs access denied
- [ ] CloudFormation stack operations denied
- [ ] CloudTrail shows `errorCode: AccessDenied` for attempted operations

### Scenario 5: Policy Validation Script Detects Drift

**Objective:** Verify that the policy validation mechanism can detect when deployed policies differ from source policies.

**Prerequisites:**

- Policy validation script implemented in workflows
- At least one app deployed

**Test Steps:**

1. Deploy an application successfully
2. Manually modify the deployed IAM policy in AWS (add an extra permission)
3. Trigger the policy validation workflow
4. Verify validation detects the drift
5. Review validation output

**Manual Policy Modification (for testing only):**

```sh
# Add an extra permission to heartbeat-publisher role (for testing)
aws iam put-role-policy \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --policy-name test-drift-policy \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"s3:ListAllMyBuckets","Resource":"*"}]}' \
  --region ap-southeast-2
```

**Expected Results:**

- Policy validation workflow detects the extra permission
- Validation output shows differences between source and deployed policies
- Workflow provides clear warning (but does not fail the build)

**Validation Commands:**

```sh
# Check deployed policies
aws iam list-role-policies \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --region ap-southeast-2

# Get policy document
aws iam get-role-policy \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --policy-name test-drift-policy \
  --region ap-southeast-2
```

**Success Criteria:**

- [ ] Validation script detects unexpected policy
- [ ] Workflow logs show clear drift warning
- [ ] Workflow continues (does not fail)
- [ ] Recommendation provided to update CloudFormation or revert manual change

**Cleanup:**

```sh
# Remove test policy
aws iam delete-role-policy \
  --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
  --policy-name test-drift-policy \
  --region ap-southeast-2
```

### Scenario 6: Wrong Environment Role Used (Security Test)

**Objective:** Verify that using the wrong environment's role fails at AWS authentication.

**Prerequisites:**

- Dev and exp infrastructure stacks both deployed
- Workflows configured for both environments

**Test Steps:**

1. Manually trigger heartbeat-publisher deployment workflow
2. Override the role ARN to use the exp environment role instead of dev
3. Verify OIDC authentication fails
4. Verify deployment does not proceed

**Expected Results:**

- OIDC authentication fails with trust policy violation
- Error message indicates branch mismatch
- No deployment occurs

**Success Criteria:**

- [ ] Workflow fails at role assumption step
- [ ] Error message mentions trust policy or branch restriction
- [ ] No resources are modified in AWS
- [ ] CloudTrail logs show failed `AssumeRoleWithWebIdentity` call

### Scenario 7: Workflow Dispatch to Dev Environment

**Objective:** Verify manual workflow dispatch works correctly for dev environment.

**Prerequisites:**

- GitHub workflow configured with workflow_dispatch trigger
- Dev infrastructure deployed

**Test Steps:**

1. Navigate to GitHub Actions
2. Select deployment workflow
3. Click "Run workflow"
4. Select environment: dev
5. Select application: heartbeat-publisher
6. Monitor execution

**Expected Results:**

- Workflow executes successfully
- Correct role ARN is used based on environment selection
- Deployment completes to dev environment
- Resources are tagged with correct environment

**Validation Commands:**

```sh
# Verify Lambda function has correct environment tag
aws lambda list-tags \
  --resource arn:aws:lambda:ap-southeast-2:395380602678:function:heartbeat-publisher-dev-function \
  --region ap-southeast-2

# Check CloudFormation stack tags
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-heartbeat-publisher-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].Tags'
```

**Success Criteria:**

- [ ] Workflow completes successfully
- [ ] Resources have `Environment: dev` tag
- [ ] Correct role ARN used
- [ ] No cross-environment pollution

### Scenario 8: Push to Deploy-Dev Branch Triggers Deployment

**Objective:** Verify that pushing to deploy-dev branch automatically triggers deployments.

**Prerequisites:**

- GitHub workflow configured with branch push trigger
- Dev infrastructure deployed

**Test Steps:**

1. Make a trivial change to application code
2. Commit and push to deploy-dev branch
3. Monitor GitHub Actions for automatic workflow trigger
4. Verify deployment executes
5. Verify deployment completes successfully

**Expected Results:**

- Workflow triggers automatically on push
- Deployment uses correct dev role
- Application is updated in dev environment
- No manual intervention required

**Success Criteria:**

- [ ] Workflow triggered automatically
- [ ] Correct role ARN used
- [ ] Deployment successful
- [ ] Lambda function updated with new code

## Test Execution Checklist

Use this checklist to track test execution progress:

- [ ] Scenario 1: Deploy Heartbeat Publisher to Dev - **PASS/FAIL**
- [ ] Scenario 2: Deploy Pulse Publisher to Dev - **PASS/FAIL**
- [ ] Scenario 3: Deploy Scryscraper to Dev - **PASS/FAIL**
- [ ] Scenario 4: Heartbeat Role Cannot Access Pulse Resources - **PASS/FAIL**
- [ ] Scenario 5: Policy Validation Script Detects Drift - **PASS/FAIL**
- [ ] Scenario 6: Wrong Environment Role Used - **PASS/FAIL**
- [ ] Scenario 7: Workflow Dispatch to Dev Environment - **PASS/FAIL**
- [ ] Scenario 8: Push to Deploy-Dev Branch Triggers Deployment - **PASS/FAIL**

## Additional Validation

### CloudWatch Logs Verification

Verify that CloudWatch logs are being created correctly for each application:

```sh
# List all Lambda log groups
aws logs describe-log-groups \
  --region ap-southeast-2 \
  --log-group-name-prefix /aws/lambda/ \
  --query 'logGroups[?starts_with(logGroupName, `/aws/lambda/heartbeat-publisher-`) || starts_with(logGroupName, `/aws/lambda/pulse-publisher-`) || starts_with(logGroupName, `/aws/lambda/scryscraper-`)].{Name:logGroupName,Retention:retentionInDays}' \
  --output table

# Check recent log events for heartbeat-publisher
aws logs describe-log-streams \
  --log-group-name /aws/lambda/heartbeat-publisher-dev-function \
  --region ap-southeast-2 \
  --order-by LastEventTime \
  --descending \
  --max-items 5
```

### CloudTrail Logs Verification

Verify role usage through CloudTrail logs:

```sh
# Query CloudTrail for role assumption events
aws cloudtrail lookup-events \
  --region ap-southeast-2 \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::IAM::Role \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --query 'Events[?contains(Resources[0].ResourceName, `GitHubActionsDeployRole`)].{Time:EventTime,EventName:EventName,Role:Resources[0].ResourceName,User:Username}' \
  --output table

# Check for any AccessDenied errors
aws cloudtrail lookup-events \
  --region ap-southeast-2 \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AccessDenied \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --query 'Events[].{Time:EventTime,User:Username,Error:ErrorCode,Message:ErrorMessage}' \
  --output table
```

### Deployment Performance Validation

Track deployment times to ensure acceptable performance:

```sh
# Get CloudFormation stack creation/update times
aws cloudformation describe-stacks \
  --region ap-southeast-2 \
  --query 'Stacks[?starts_with(StackName, `monorepo-fem-`)].{Stack:StackName,Status:StackStatus,CreationTime:CreationTime,LastUpdatedTime:LastUpdatedTime}' \
  --output table
```

**Acceptable deployment times:**

- CloudFormation stack creation: < 5 minutes
- Lambda function update: < 2 minutes
- Total workflow execution: < 10 minutes

## Security Validation

### Least Privilege Verification

Verify each role has only the permissions it needs:

- [ ] Heartbeat-publisher role can only access heartbeat-publisher-\* resources
- [ ] Pulse-publisher role can only access pulse-publisher-\* resources
- [ ] Scryscraper role can only access scryscraper-\* resources
- [ ] Policy manager role cannot deploy applications
- [ ] Deployment roles cannot modify IAM policies
- [ ] OIDC trust policies restrict to correct branches
- [ ] No overly permissive wildcards in policies
- [ ] Shared resources (SAM buckets) are accessible to all deployment roles

### IAM Access Analyser Review

Run IAM Access Analyser on each role to identify potential security issues:

```sh
# Create an analyser (if not already exists)
aws accessanalyzer create-analyzer \
  --analyzer-name monorepo-fem-analyser \
  --type ACCOUNT \
  --region ap-southeast-2

# List findings for specific role
aws accessanalyzer list-findings \
  --analyzer-arn arn:aws:access-analyzer:ap-southeast-2:395380602678:analyzer/monorepo-fem-analyser \
  --region ap-southeast-2 \
  --filter '{"principal.AWS":{"contains":["GitHubActionsDeployRole-HeartbeatPublisher-dev"]}}' \
  --query 'findings[].{Resource:resource,FindingType:findingType,Status:status}' \
  --output table
```

**Expected findings:**

- No external access (all resources should be internal to account)
- No unused permissions (all granted permissions should be used)

## Regression Testing

Verify that existing functionality still works after the IAM role split:

- [ ] Existing deployments continue to work
- [ ] No breaking changes to workflow syntax
- [ ] Lambda functions execute successfully
- [ ] EventBridge rules trigger correctly
- [ ] CloudWatch logs capture all output
- [ ] Application behaviour unchanged

## Rollback Testing

Test the ability to rollback if issues are discovered:

1. Document current state (stack names, function versions)
2. Perform a deployment
3. Intentionally break something (e.g., invalid Lambda code)
4. Execute rollback procedure
5. Verify system returns to previous state

```sh
# Rollback CloudFormation stack to previous version
aws cloudformation update-stack \
  --stack-name monorepo-fem-heartbeat-publisher-dev \
  --use-previous-template \
  --region ap-southeast-2

# Or rollback by redeploying previous version
# (Requires previous deployment artefact)
```

## Test Results Documentation

After completing all tests, document the results:

**Test Execution Summary:**

- Date executed: \_\_\_\_\_\_\_\_
- Tester: \_\_\_\_\_\_\_\_
- Environment: dev
- Overall result: PASS / FAIL

**Scenario Results:**

| Scenario | Result | Notes |
| -------- | ------ | ----- |
| 1        |        |       |
| 2        |        |       |
| 3        |        |       |
| 4        |        |       |
| 5        |        |       |
| 6        |        |       |
| 7        |        |       |
| 8        |        |       |

**Issues Found:**

- List any issues discovered during testing
- Severity: Critical / High / Medium / Low
- Resolution: Fixed / Workaround / Deferred

**Recommendations:**

- Any improvements or changes recommended based on testing
- Security findings
- Performance optimisations

## Next Steps

After successful testing:

1. Review test results with team
2. Address any issues found
3. Update documentation based on lessons learned
4. Proceed with migration planning
5. Monitor production deployments closely

## Resources

- [BOOTSTRAP_IAM_ROLES.md](./BOOTSTRAP_IAM_ROLES.md) - Infrastructure setup guide
- [TROUBLESHOOTING_DEPLOYMENTS.md](./TROUBLESHOOTING_DEPLOYMENTS.md) - Common issues
- [POLICY_MANAGEMENT.md](./POLICY_MANAGEMENT.md) - Policy management guide
- [AWS CloudTrail Documentation](https://docs.aws.amazon.com/cloudtrail/)
- [AWS IAM Access Analyser](https://docs.aws.amazon.com/IAM/latest/UserGuide/what-is-access-analyzer.html)
