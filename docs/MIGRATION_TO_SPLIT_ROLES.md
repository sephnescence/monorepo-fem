# Migration Runbook: Single Role to Per-App Split Roles

This runbook documents the migration from a single deployment role to per-app, per-environment IAM roles.

## Migration Overview

**Current State:**

- Single IAM role: `GitHubActionsDeployRole`
- One policy with permissions for all applications
- All environments share the same role structure
- Branch-based environment selection

**Target State:**

- 9 dedicated IAM roles (3 apps × 3 environments)
- 3 policy manager roles (1 per environment)
- Per-app, per-environment policy isolation
- CloudFormation-managed infrastructure

**Migration Strategy:** All at once (as approved)

## Pre-Migration Checklist

Before starting the migration, ensure:

- [ ] All documentation reviewed and understood
- [ ] AWS CLI configured with admin permissions
- [ ] GitHub CLI installed and authenticated
- [ ] Current infrastructure state documented
- [ ] Backup of existing IAM policies created
- [ ] All team members notified of migration
- [ ] Migration window scheduled (low-traffic period recommended)

## Migration Timeline

**Estimated Duration:** 2-3 hours

- Phase 1: Document current state (30 minutes)
- Phase 2: Bootstrap new infrastructure (45 minutes)
- Phase 3: Update GitHub workflows (30 minutes)
- Phase 4: Configure GitHub secrets (15 minutes)
- Phase 5: Test deployments (30 minutes)
- Phase 6: Teardown old infrastructure (30 minutes)

## Phase 1: Document Current State

### Step 1.1: Document Existing Role

Capture the current role configuration for reference:

```sh
# Get existing role details
aws iam get-role \
  --role-name GitHubActionsDeployRole \
  --region ap-southeast-2 \
  --query 'Role' \
  --output json > backup/old-role.json

# Get existing policy
aws iam list-attached-role-policies \
  --role-name GitHubActionsDeployRole \
  --region ap-southeast-2 \
  --output json > backup/old-policies.json

# Get inline policies
aws iam list-role-policies \
  --role-name GitHubActionsDeployRole \
  --region ap-southeast-2 \
  --output json > backup/old-inline-policies.json
```

### Step 1.2: Document Existing Resources

List all resources currently managed by the old role:

```sh
# List CloudFormation stacks
aws cloudformation list-stacks \
  --region ap-southeast-2 \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?starts_with(StackName, `heartbeat`) || starts_with(StackName, `pulse`) || starts_with(StackName, `scryscraper`)]' \
  --output json > backup/existing-stacks.json

# List Lambda functions
aws lambda list-functions \
  --region ap-southeast-2 \
  --query 'Functions[?starts_with(FunctionName, `heartbeat`) || starts_with(FunctionName, `pulse`) || starts_with(FunctionName, `scryscraper`)]' \
  --output json > backup/existing-functions.json

# List S3 buckets
aws s3api list-buckets \
  --query 'Buckets[?starts_with(Name, `heartbeat`) || starts_with(Name, `pulse`) || starts_with(Name, `scryscraper`) || starts_with(Name, `aws-sam-cli-managed`)]' \
  --output json > backup/existing-buckets.json
```

### Step 1.3: Create Migration State File

Create a file to track migration progress:

```sh
cat > migration-state.json <<EOF
{
  "migration_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "migration_strategy": "all-at-once",
  "phases_completed": [],
  "old_role_arn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole",
  "new_infrastructure_stacks": {
    "dev": null,
    "exp": null,
    "prod": null
  },
  "github_secrets_updated": false,
  "workflows_updated": false,
  "old_infrastructure_removed": false
}
EOF
```

## Phase 2: Bootstrap New Infrastructure

Follow the detailed instructions in [BOOTSTRAP_IAM_ROLES.md](./BOOTSTRAP_IAM_ROLES.md).

### Step 2.1: Deploy Dev Infrastructure

```sh
aws cloudformation deploy \
  --template-file devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml \
  --stack-name monorepo-fem-devops-dev \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2

# Wait for completion
aws cloudformation wait stack-create-complete \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2

# Verify
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].StackStatus'
```

**Update migration state:**

```sh
# Update migration-state.json to mark dev infrastructure complete
```

### Step 2.2: Deploy Exp Infrastructure

```sh
aws cloudformation deploy \
  --template-file devops/exp/monorepo-fem-github-actions-sam-deploy-exp.yml \
  --stack-name monorepo-fem-devops-exp \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2

# Wait for completion
aws cloudformation wait stack-create-complete \
  --stack-name monorepo-fem-devops-exp \
  --region ap-southeast-2

# Verify
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-exp \
  --region ap-southeast-2 \
  --query 'Stacks[0].StackStatus'
```

### Step 2.3: Deploy Prod Infrastructure

```sh
aws cloudformation deploy \
  --template-file devops/prod/monorepo-fem-github-actions-sam-deploy-prod.yml \
  --stack-name monorepo-fem-devops-prod \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2

# Wait for completion
aws cloudformation wait stack-create-complete \
  --stack-name monorepo-fem-devops-prod \
  --region ap-southeast-2

# Verify
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-prod \
  --region ap-southeast-2 \
  --query 'Stacks[0].StackStatus'
```

### Step 2.4: Retrieve New Role ARNs

```sh
# Get all role ARNs and save to file
aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-dev \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs' \
  --output json > new-roles-dev.json

aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-exp \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs' \
  --output json > new-roles-exp.json

aws cloudformation describe-stacks \
  --stack-name monorepo-fem-devops-prod \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs' \
  --output json > new-roles-prod.json
```

## Phase 3: Update GitHub Workflows

**Note:** Workflows should already be updated from Plans 4 and 5. This phase verifies and completes any remaining updates.

### Step 3.1: Verify Workflow Updates

Check that workflows use environment-specific role ARNs:

```sh
# Check workflow files reference correct secrets
grep -r "AWS_DEPLOY_ROLE_ARN" .github/workflows/

# Expected pattern:
# ${{ secrets.AWS_DEPLOY_ROLE_ARN_HEARTBEAT_DEV }}
# ${{ secrets.AWS_DEPLOY_ROLE_ARN_PULSE_EXP }}
# etc.
```

### Step 3.2: Update Workflows (If Needed)

If workflows aren't updated, update them to use the new per-app, per-environment secrets.

### Step 3.3: Commit and Push Workflow Changes

```sh
git add .github/workflows/
git commit -m "Update workflows to use per-app, per-environment IAM roles"
git push origin main
```

## Phase 4: Configure GitHub Secrets

### Step 4.1: Add New GitHub Secrets

```sh
# Dev environment secrets
gh secret set AWS_DEPLOY_ROLE_ARN_HEARTBEAT_DEV --body "$(aws cloudformation describe-stacks --stack-name monorepo-fem-devops-dev --region ap-southeast-2 --query 'Stacks[0].Outputs[?OutputKey==`HeartbeatPublisherDeployRoleArn`].OutputValue' --output text)"

gh secret set AWS_DEPLOY_ROLE_ARN_PULSE_DEV --body "$(aws cloudformation describe-stacks --stack-name monorepo-fem-devops-dev --region ap-southeast-2 --query 'Stacks[0].Outputs[?OutputKey==`PulsePublisherDeployRoleArn`].OutputValue' --output text)"

gh secret set AWS_DEPLOY_ROLE_ARN_SCRYSCRAPER_DEV --body "$(aws cloudformation describe-stacks --stack-name monorepo-fem-devops-dev --region ap-southeast-2 --query 'Stacks[0].Outputs[?OutputKey==`ScryScraperDeployRoleArn`].OutputValue' --output text)"

# Exp environment secrets
gh secret set AWS_DEPLOY_ROLE_ARN_HEARTBEAT_EXP --body "$(aws cloudformation describe-stacks --stack-name monorepo-fem-devops-exp --region ap-southeast-2 --query 'Stacks[0].Outputs[?OutputKey==`HeartbeatPublisherDeployRoleArn`].OutputValue' --output text)"

gh secret set AWS_DEPLOY_ROLE_ARN_PULSE_EXP --body "$(aws cloudformation describe-stacks --stack-name monorepo-fem-devops-exp --region ap-southeast-2 --query 'Stacks[0].Outputs[?OutputKey==`PulsePublisherDeployRoleArn`].OutputValue' --output text)"

gh secret set AWS_DEPLOY_ROLE_ARN_SCRYSCRAPER_EXP --body "$(aws cloudformation describe-stacks --stack-name monorepo-fem-devops-exp --region ap-southeast-2 --query 'Stacks[0].Outputs[?OutputKey==`ScryScraperDeployRoleArn`].OutputValue' --output text)"

# Prod environment secrets
gh secret set AWS_DEPLOY_ROLE_ARN_HEARTBEAT_PROD --body "$(aws cloudformation describe-stacks --stack-name monorepo-fem-devops-prod --region ap-southeast-2 --query 'Stacks[0].Outputs[?OutputKey==`HeartbeatPublisherDeployRoleArn`].OutputValue' --output text)"

gh secret set AWS_DEPLOY_ROLE_ARN_PULSE_PROD --body "$(aws cloudformation describe-stacks --stack-name monorepo-fem-devops-prod --region ap-southeast-2 --query 'Stacks[0].Outputs[?OutputKey==`PulsePublisherDeployRoleArn`].OutputValue' --output text)"

gh secret set AWS_DEPLOY_ROLE_ARN_SCRYSCRAPER_PROD --body "$(aws cloudformation describe-stacks --stack-name monorepo-fem-devops-prod --region ap-southeast-2 --query 'Stacks[0].Outputs[?OutputKey==`ScryScraperDeployRoleArn`].OutputValue' --output text)"
```

### Step 4.2: Verify Secrets

```sh
# List all secrets
gh secret list

# Should show:
# AWS_DEPLOY_ROLE_ARN_HEARTBEAT_DEV
# AWS_DEPLOY_ROLE_ARN_HEARTBEAT_EXP
# AWS_DEPLOY_ROLE_ARN_HEARTBEAT_PROD
# AWS_DEPLOY_ROLE_ARN_PULSE_DEV
# AWS_DEPLOY_ROLE_ARN_PULSE_EXP
# AWS_DEPLOY_ROLE_ARN_PULSE_PROD
# AWS_DEPLOY_ROLE_ARN_SCRYSCRAPER_DEV
# AWS_DEPLOY_ROLE_ARN_SCRYSCRAPER_EXP
# AWS_DEPLOY_ROLE_ARN_SCRYSCRAPER_PROD
```

## Phase 5: Test Deployments

### Step 5.1: Test Deployment to Dev

Trigger a test deployment for each application:

```sh
# Option 1: Use workflow dispatch via GitHub UI
# Go to Actions > Select workflow > Run workflow > Choose dev environment

# Option 2: Trigger by pushing to deploy-dev
git checkout deploy-dev
git merge main
git push origin deploy-dev
```

**Verify deployment succeeds:**

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
  --query 'Configuration.[FunctionName,State,LastModified]'
```

**Repeat for pulse-publisher and scryscraper.**

### Step 5.2: Verify CloudTrail Shows Correct Role Usage

```sh
# Check recent role assumptions
aws cloudtrail lookup-events \
  --region ap-southeast-2 \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --query 'Events[?contains(Resources[0].ResourceName, `GitHubActionsDeployRole`)].[EventTime,Resources[0].ResourceName]' \
  --output table
```

Should show:

- `GitHubActionsDeployRole-HeartbeatPublisher-dev`
- `GitHubActionsDeployRole-PulsePublisher-dev`
- `GitHubActionsDeployRole-ScrysScraper-dev`

### Step 5.3: Test Least Privilege Enforcement

Verify that heartbeat-publisher role cannot access pulse-publisher resources:

```sh
# This should be tested through the testing plan
# See TESTING_PLAN_IAM_SPLIT.md - Scenario 4
```

## Phase 6: Teardown Old Infrastructure

**IMPORTANT:** Only proceed after verifying all deployments work correctly with the new roles.

### Step 6.1: List Old Resources to Remove

```sh
# Find old IAM role
aws iam get-role \
  --role-name GitHubActionsDeployRole \
  --region ap-southeast-2

# Find old OIDC provider (if separate from new one)
aws iam list-open-id-connect-providers --region ap-southeast-2

# Find old policies
aws iam list-policies \
  --scope Local \
  --region ap-southeast-2 \
  --query 'Policies[?contains(PolicyName, `GitHubActions`) || contains(PolicyName, `Deploy`)]'
```

### Step 6.2: Remove Old Role

```sh
# Detach managed policies
aws iam list-attached-role-policies \
  --role-name GitHubActionsDeployRole \
  --region ap-southeast-2 \
  --query 'AttachedPolicies[].PolicyArn' \
  --output text | xargs -n1 aws iam detach-role-policy --role-name GitHubActionsDeployRole --policy-arn

# Delete inline policies
aws iam list-role-policies \
  --role-name GitHubActionsDeployRole \
  --region ap-southeast-2 \
  --query 'PolicyNames[]' \
  --output text | xargs -n1 aws iam delete-role-policy --role-name GitHubActionsDeployRole --policy-name

# Delete role
aws iam delete-role \
  --role-name GitHubActionsDeployRole \
  --region ap-southeast-2
```

### Step 6.3: Remove Old Managed Policies

```sh
# List policy versions
aws iam list-policy-versions \
  --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/GitHubActionsDeployPolicy \
  --region ap-southeast-2

# Delete old versions (keep only default)
aws iam list-policy-versions \
  --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/GitHubActionsDeployPolicy \
  --region ap-southeast-2 \
  --query 'Versions[?IsDefaultVersion==`false`].VersionId' \
  --output text | xargs -n1 aws iam delete-policy-version --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/GitHubActionsDeployPolicy --version-id

# Delete policy
aws iam delete-policy \
  --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/GitHubActionsDeployPolicy \
  --region ap-southeast-2
```

### Step 6.4: Remove Old GitHub Secret

```sh
# Remove old secret
gh secret delete AWS_DEPLOY_ROLE_ARN
```

### Step 6.5: Remove Old OIDC Provider (If Applicable)

**WARNING:** Only remove the OIDC provider if it's NOT being used by the new roles. The new CloudFormation templates create their own OIDC provider per environment.

```sh
# Check if OIDC provider is used by new roles
aws iam list-entities-for-policy \
  --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/GitHubActionsDeployPolicy \
  --region ap-southeast-2

# If not used, delete:
aws iam delete-open-id-connect-provider \
  --open-id-connect-provider-arn arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com \
  --region ap-southeast-2
```

## Phase 7: Post-Migration Validation

### Step 7.1: Run Full Test Suite

Execute all test scenarios from [TESTING_PLAN_IAM_SPLIT.md](./TESTING_PLAN_IAM_SPLIT.md):

- [ ] Deploy all apps to dev
- [ ] Verify least privilege enforcement
- [ ] Test policy validation
- [ ] Verify CloudTrail logging

### Step 7.2: Document Migration Completion

Update migration-state.json:

```json
{
  "migration_date": "2024-11-07T10:30:00Z",
  "migration_completed_date": "2024-11-07T13:15:00Z",
  "migration_strategy": "all-at-once",
  "phases_completed": [
    "document-current-state",
    "bootstrap-infrastructure",
    "update-workflows",
    "configure-secrets",
    "test-deployments",
    "teardown-old-infrastructure"
  ],
  "old_role_arn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole",
  "old_role_removed": true,
  "new_infrastructure_stacks": {
    "dev": "monorepo-fem-devops-dev",
    "exp": "monorepo-fem-devops-exp",
    "prod": "monorepo-fem-devops-prod"
  },
  "github_secrets_updated": true,
  "workflows_updated": true,
  "old_infrastructure_removed": true,
  "issues_encountered": [],
  "lessons_learned": []
}
```

### Step 7.3: Create Migration Summary

Document the migration results:

```markdown
# Migration Summary

**Date:** 2024-11-07
**Duration:** 3 hours
**Strategy:** All at once
**Result:** SUCCESS

## What Went Well

- CloudFormation deployments completed without issues
- All test deployments successful
- Least privilege enforcement working as expected

## Issues Encountered

- None

## Lessons Learned

- CloudFormation makes infrastructure management much easier
- Testing in dev first was crucial
- Documentation made the process smooth

## Recommendations

- Consider adding CloudWatch dashboards for monitoring
- Set up automated policy drift detection
- Schedule regular IAM access audits
```

## Rollback Plan

If the migration encounters issues, follow this rollback procedure:

### Rollback Step 1: Restore Old GitHub Secret

```sh
gh secret set AWS_DEPLOY_ROLE_ARN --body "arn:aws:iam::${AWS_ACCOUNT_ID}:role/GitHubActionsDeployRole"
```

### Rollback Step 2: Revert Workflow Changes

```sh
git revert <commit-hash>
git push origin main
git push origin deploy-dev
```

### Rollback Step 3: Keep or Remove New Infrastructure

**Option A: Keep new infrastructure for future retry:**

Leave CloudFormation stacks in place. They won't interfere with the old role.

**Option B: Remove new infrastructure:**

```sh
aws cloudformation delete-stack --stack-name monorepo-fem-devops-prod --region ap-southeast-2
aws cloudformation delete-stack --stack-name monorepo-fem-devops-exp --region ap-southeast-2
aws cloudformation delete-stack --stack-name monorepo-fem-devops-dev --region ap-southeast-2
```

### Rollback Step 4: Verify Old System Works

Test deployments using the old role to ensure functionality is restored.

## Risk Assessment

| Risk                              | Likelihood | Impact | Mitigation                                                         |
| --------------------------------- | ---------- | ------ | ------------------------------------------------------------------ |
| CloudFormation deployment fails   | Low        | Medium | Validate templates, test in dev first                             |
| GitHub secrets misconfigured      | Low        | High   | Double-check ARNs, verify with test deployments                    |
| OIDC authentication issues        | Low        | High   | Verify trust policies, check CloudTrail logs                       |
| Old role deleted too early        | Medium     | High   | Complete thorough testing before removal                           |
| Application downtime during       | Low        | Medium | Migration doesn't affect running applications                      |
| Workflow triggers fail            | Low        | High   | Test with workflow dispatch before relying on branch triggers      |
| Policy permissions insufficient   | Low        | Medium | Policies based on working implementation, tested in dev            |
| IAM propagation delays            | Medium     | Low    | Wait 5 minutes after policy changes before testing                |
| Documentation outdated            | Low        | Low    | All docs created as part of migration planning                     |
| Team confusion during migration   | Low        | Low    | Clear communication, detailed runbook                              |

## Success Criteria

The migration is considered successful when:

- [ ] All 3 environment infrastructure stacks deployed successfully
- [ ] All 9 deployment roles created and configured
- [ ] All GitHub secrets updated and verified
- [ ] All workflows updated to use new roles
- [ ] Test deployments successful for all apps in dev
- [ ] Least privilege enforcement validated
- [ ] CloudTrail shows correct role usage
- [ ] Old infrastructure removed cleanly
- [ ] No deployment errors for 48 hours post-migration
- [ ] Documentation updated and accurate

## Post-Migration Monitoring

For the first week after migration, monitor:

1. **Deployment Success Rate:**
   - Track all deployments in GitHub Actions
   - Investigate any failures immediately

2. **CloudTrail Logs:**
   - Check for `AccessDenied` errors
   - Verify only expected roles are being used

3. **CloudWatch Logs:**
   - Monitor application logs for errors
   - Check for any permission-related issues

4. **IAM Access Analyser:**
   - Run weekly to check for security issues
   - Review any new findings

## Additional Resources

- [BOOTSTRAP_IAM_ROLES.md](./BOOTSTRAP_IAM_ROLES.md) - Infrastructure setup
- [TESTING_PLAN_IAM_SPLIT.md](./TESTING_PLAN_IAM_SPLIT.md) - Testing strategy
- [TROUBLESHOOTING_DEPLOYMENTS.md](./TROUBLESHOOTING_DEPLOYMENTS.md) - Common issues
- [POLICY_MANAGEMENT.md](./POLICY_MANAGEMENT.md) - Policy updates
- [AWS CloudFormation User Guide](https://docs.aws.amazon.com/cloudformation/)
