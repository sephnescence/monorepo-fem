# Policy Validation Troubleshooting Guide

This guide helps you troubleshoot policy validation issues in the GitHub Actions deployment workflows.

## Understanding Policy Validation

Policy validation compares the IAM policy deployed in AWS with the policy file stored in the repository (`.github/policies/`). This helps maintain policy-as-code discipline and detects drift.

## Common Scenarios

### Scenario 1: Policy Differences Detected (Dev/Exp)

**Symptom:**

```
⚠️  Policy differences detected:
--- deployed-policy
+++ repository-policy
@@ -10,7 +10,7 @@
-        "lambda:DeleteFunction",
+        "lambda:DeleteFunction",
+        "lambda:GetFunctionCodeSigningConfig",
```

**Meaning**: The deployed policy differs from the repository policy. The workflow continues with a warning.

**Action**:

1. **Review the differences** to understand what changed
2. **Determine which is correct**:
   - If the repository policy is correct: Update the deployed policy (see "Updating Deployed Policies" below)
   - If the deployed policy is correct: Update the repository policy file and commit

3. **Common reasons for drift**:
   - Testing policy changes in lower environment before committing
   - Manual policy updates via AWS console
   - Policy updated via different branch/PR

### Scenario 2: Policy Differences Detected (Prod)

**Symptom:**

```
❌ ERROR: Policy drift detected in production environment
--- deployed-policy
+++ repository-policy
...
```

**Meaning**: The deployed policy differs from the repository policy. The deployment is blocked.

**Action**:

1. **Review the differences** carefully
2. **Resolve the drift before proceeding**:
   - If repository is correct: Update deployed policy manually (see below)
   - If deployed is correct: Update repository policy and commit
3. **Re-run the deployment** after sync is complete

**Why prod is stricter**: Production policies should always match the repository to ensure consistency and auditability.

### Scenario 3: Policy File Missing

**Symptom (Dev/Exp):**

```
⚠️  WARNING: Policy file missing - skipping policy validation
```

**Symptom (Prod):**

```
❌ ERROR: Policy file not found: .github/policies/app-name-deploy-policy.json
Policy validation requires a policy file in the repository.
```

**Action**:

1. **Check the policy file exists** at the path specified in the workflow
2. **Verify the path** matches what's configured in the deployment workflow (e.g., `deploy-heartbeat.yml`)
3. **Create the policy file** if it's missing:
   - Use existing policy files as templates
   - Define all necessary permissions for the app
   - Commit and push

**Why this happens**: The workflow requires a policy file for validation. Prod enforces this requirement strictly.

### Scenario 4: PolicyManager Role Not Found

**Symptom:**

```
⚠️  WARNING: PolicyManager role ARN not configured
Skipping policy validation. To enable:
  - Add secret: AWS_OIDC_POLICY_MANAGER_ROLE_ARN__MONOREPO_FEM__DEV
```

**Action**:

1. **Verify the DevOps infrastructure is deployed**:
   ```bash
   aws iam get-role --role-name monorepo-fem-policy-manager-dev
   ```

2. **If role doesn't exist**, bootstrap the DevOps infrastructure:
   - See `devops/README.md` for bootstrap instructions

3. **If role exists**, add the secret to GitHub:
   ```bash
   ROLE_ARN=$(aws cloudformation describe-stacks \
     --stack-name monorepo-fem-devops-dev \
     --query 'Stacks[0].Outputs[?OutputKey==`PolicyManagerRoleArn`].OutputValue' \
     --output text)

   gh secret set AWS_OIDC_POLICY_MANAGER_ROLE_ARN__MONOREPO_FEM__DEV --body "$ROLE_ARN"
   ```

### Scenario 5: Failed to Assume PolicyManager Role

**Symptom:**

```
⚠️  WARNING: Failed to assume PolicyManager role
Skipping policy validation.
```

**Action**:

1. **Check the trust policy** on the PolicyManager role:
   ```bash
   aws iam get-role --role-name monorepo-fem-policy-manager-dev \
     --query 'Role.AssumeRolePolicyDocument'
   ```

2. **Verify the OIDC provider** is configured correctly:
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
   - Subject: `repo:sephnescence/monorepo-fem:ref:refs/heads/deploy-dev`

3. **Check workflow permissions** in the workflow file:
   - Ensure `id-token: write` permission is set
   - Ensure `contents: read` permission is set

4. **Verify the deployment role can assume the policy manager role**:
   - The policy manager role should trust the OIDC provider, not the deployment role

### Scenario 6: No Inline Policies Found

**Symptom:**

```
⚠️  WARNING: No inline policies found on deployment role
The deployment role may not have been created yet.
```

**Action**:

This is expected for **first-time deployments**. The deployment role will be created by the CloudFormation stack during the deployment.

- The workflow continues normally
- Future deployments will validate the policy

If this appears on a **subsequent deployment**:

1. **Check the deployment role exists**:
   ```bash
   aws iam get-role --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev
   ```

2. **Check if the role has policies**:
   ```bash
   aws iam list-role-policies --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev
   ```

3. **If role exists but has no policies**, the infrastructure may need to be updated

## Updating Deployed Policies

### Option 1: Update via CloudFormation (Recommended)

The safest way is to update the CloudFormation template and redeploy the DevOps stack:

1. **Update the template** in `devops/<env>/monorepo-fem-github-actions-sam-deploy-<env>.yml`
2. **Update the role's inline policy** to match the repository policy
3. **Deploy the stack update**:
   ```bash
   aws cloudformation update-stack \
     --stack-name monorepo-fem-devops-dev \
     --template-body file://devops/dev/monorepo-fem-github-actions-sam-deploy-dev.yml \
     --capabilities CAPABILITY_NAMED_IAM \
     --region ap-southeast-2
   ```

### Option 2: Update via AWS CLI (Quick Fix)

For quick fixes in dev/exp environments (not recommended for prod):

1. **Retrieve the current policy**:
   ```bash
   aws iam get-role-policy \
     --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
     --policy-name HeartbeatPublisherDeployPolicy \
     --query 'PolicyDocument' > current-policy.json
   ```

2. **Edit the policy** to match the repository version
3. **Update the policy**:
   ```bash
   aws iam put-role-policy \
     --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
     --policy-name HeartbeatPublisherDeployPolicy \
     --policy-document file://current-policy.json
   ```

**Warning**: Manual updates via CLI may be overwritten if the CloudFormation stack is updated.

## Updating Repository Policies

If the deployed policy is correct and the repository is outdated:

1. **Retrieve the deployed policy**:
   ```bash
   aws iam get-role-policy \
     --role-name GitHubActionsDeployRole-HeartbeatPublisher-dev \
     --policy-name HeartbeatPublisherDeployPolicy \
     --query 'PolicyDocument' \
     --output json > .github/policies/heartbeat-publisher-deploy-policy.json
   ```

2. **Replace placeholders** with template variables:
   - Replace account ID with `${AWS_ACCOUNT_ID}`
   - Replace region with `${AWS_REGION}`
   - Replace environment with `${ENVIRONMENT}`

3. **Format the JSON**:
   ```bash
   jq --sort-keys '.' .github/policies/heartbeat-publisher-deploy-policy.json > temp.json
   mv temp.json .github/policies/heartbeat-publisher-deploy-policy.json
   ```

4. **Commit and push** the updated policy file

## When Policy Differences Are Expected

Policy differences between environments may be intentional in these cases:

### Testing New Permissions (Dev/Exp)

- **Scenario**: Testing if a new permission is needed before adding to all environments
- **Action**: Document the change in PR description, update repository after validation
- **Expected**: Warnings in dev/exp, no drift in prod

### Temporary Permission Escalation (Dev/Exp)

- **Scenario**: Temporarily adding broader permissions for debugging
- **Action**: Revert the deployed policy after debugging, or update repository if keeping
- **Expected**: Warnings until reverted or committed

### Environment-Specific Differences (Rare)

- **Scenario**: Different permissions needed in different environments (e.g., dev needs DynamoDB local access)
- **Action**: Document in policy file comments, consider using environment-specific policy files
- **Expected**: Ongoing warnings (acceptable if documented)

## When Policy Differences Are Concerning

Take immediate action if you see:

### Unexpected Permission Changes

- **Symptom**: Permissions added/removed that you didn't authorise
- **Action**: Investigate immediately, check CloudTrail for who made the change
- **Risk**: Potential security breach or accidental privilege escalation

### Production Policy Drift

- **Symptom**: Production policy differs from repository
- **Action**: Identify source of drift, sync immediately
- **Risk**: Compliance issues, audit failures

### Resource Scope Changes

- **Symptom**: Resource ARNs changed to be broader (e.g., `*` instead of specific resource)
- **Action**: Revert immediately unless explicitly authorised
- **Risk**: Privilege escalation, least-privilege violation

## Getting Help

If you're stuck:

1. **Check CloudTrail** for recent IAM changes:
   ```bash
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=ResourceName,AttributeValue=GitHubActionsDeployRole-HeartbeatPublisher-dev \
     --region ap-southeast-2
   ```

2. **Review the workflow logs** in GitHub Actions for detailed error messages

3. **Compare policies side-by-side**:
   ```bash
   diff -u \
     <(aws iam get-role-policy --role-name <role-name> --policy-name <policy-name> --query 'PolicyDocument' | jq --sort-keys '.') \
     <(jq --sort-keys '.' .github/policies/<policy-file>.json)
   ```

4. **Check the DevOps infrastructure status**:
   ```bash
   aws cloudformation describe-stacks \
     --stack-name monorepo-fem-devops-dev \
     --query 'Stacks[0].StackStatus'
   ```

5. **Consult the documentation**:
   - `.github/workflows/README.md` - Workflow documentation
   - `devops/README.md` - Infrastructure documentation

## Prevention

To avoid policy validation issues:

1. **Always update policies via CloudFormation** (not AWS console)
2. **Commit policy changes** to repository before deploying
3. **Test policy changes in dev** before promoting to prod
4. **Document policy changes** in PR descriptions
5. **Review policy diffs carefully** during PR reviews
6. **Use branch protection** to prevent direct pushes to deployment branches
