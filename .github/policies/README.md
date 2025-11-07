# IAM Deployment Policies

This directory contains IAM policies for GitHub Actions deployment workflows, implementing least-privilege access control by splitting permissions per application.

## Policy Structure

Each application has its own dedicated IAM policy that grants only the permissions needed to deploy that specific application:

- `heartbeat-publisher-deploy-policy.json` - Heartbeat Publisher deployment permissions
- `pulse-publisher-deploy-policy.json` - Pulse Publisher deployment permissions
- `scryscraper-deploy-policy.json` - ScrysScraper deployment permissions

## Resource Naming Conventions

All resource names follow consistent patterns that align with the CloudFormation templates:

### Lambda Functions
- Heartbeat Publisher: `heartbeat-publisher-${Environment}`
- Pulse Publisher: `pulse-publisher-${Environment}`
- ScrysScraper: `scryscraper-${Environment}`

### IAM Roles
- Heartbeat Publisher: `heartbeat-publisher-*` (SAM-generated)
- Pulse Publisher: `pulse-publisher-*` (SAM-generated)
- ScrysScraper: `scryscraper-lambda-role-${Environment}`

### EventBridge Rules
- Heartbeat Publisher: `heartbeat-publisher-schedule-${Environment}`
- Pulse Publisher: `pulse-publisher-schedule-${Environment}`
- ScrysScraper: `scryscraper-schedule-${Environment}`

### CloudWatch Log Groups

#### Lambda Execution Logs
- Heartbeat Publisher: `/aws/lambda/heartbeat-publisher-${Environment}`
- Pulse Publisher: `/aws/lambda/pulse-publisher-${Environment}`
- ScrysScraper: `/aws/lambda/scryscraper-${Environment}`

#### Application-Specific Logs
- Heartbeat Publisher: `/monorepo-fem/heartbeats-${Environment}`
- Pulse Publisher: `/monorepo-fem/pulse-${Environment}`

#### Shared Metrics Logs
Apps can create log streams in shared metrics log groups with app-prefixed names:
- `/aws/metrics/monorepo-fem-${Environment}/heartbeat-publisher*`
- `/aws/metrics/monorepo-fem-${Environment}/pulse-publisher*`
- `/aws/metrics/monorepo-fem-${Environment}/scryscraper*`

### S3 Buckets

#### Shared SAM Deployment Buckets (in all policies)
- `aws-sam-cli-managed-default-samclisourcebucket-*`

#### App-Specific Buckets
- ScrysScraper: `monorepo-fem-scryscraper-cache-${Environment}`

### DynamoDB Tables
- ScrysScraper: `monorepo-fem-scryscraper-${Environment}`

### CloudFormation Stacks
- Heartbeat Publisher: `monorepo-fem-heartbeat-publisher-${Environment}`
- Pulse Publisher: `monorepo-fem-pulse-publisher-${Environment}`
- ScrysScraper: `monorepo-fem-scryscraper-${Environment}`

## Placeholder Substitution

Policies use placeholders that must be substituted during workflow execution:

- `${AWS_ACCOUNT_ID}` - The AWS account ID where resources are deployed
- `${AWS_REGION}` - The AWS region where resources are deployed
- `${ENVIRONMENT}` - The environment name (dev, exp, staging, prod)

### Example Substitution

Workflows should replace placeholders before applying policies. Example using `sed`:

```bash
sed -e "s/\${AWS_ACCOUNT_ID}/${AWS_ACCOUNT_ID}/g" \
    -e "s/\${AWS_REGION}/${AWS_REGION}/g" \
    -e "s/\${ENVIRONMENT}/${ENVIRONMENT}/g" \
    heartbeat-publisher-deploy-policy.json > policy-final.json
```

## Shared Resource Permissions

All policies include identical permissions for shared resources:

### CloudFormation
- Full stack lifecycle management (Create, Update, Delete, Describe, etc.)
- Scoped to: `aws-sam-cli-managed-default-*` stacks and app-specific stacks
- Includes SAM transform: `arn:aws:cloudformation:${AWS_REGION}:aws:transform/Serverless-2016-10-31`

### S3 Deployment Buckets
- Create, read, write, delete objects
- Bucket policy management
- Scoped to: `aws-sam-cli-managed-default-samclisourcebucket-*`

## App-Specific Permissions

### All Apps Include
- **Lambda**: Create, update, delete, configure functions
- **IAM**: Manage execution roles (scoped to app name pattern)
- **EventBridge**: Manage scheduled rules (scoped to app name pattern)
- **CloudWatch**: Manage alarms, dashboards, log groups, metric filters

### ScrysScraper Additional Permissions
- **S3**: Manage cache bucket (`monorepo-fem-scryscraper-cache-*`)
- **DynamoDB**: Manage tables (`monorepo-fem-scryscraper-*`)

## Policy Comparison

| Permission Type | Heartbeat Publisher | Pulse Publisher | ScrysScraper |
|----------------|---------------------|-----------------|--------------|
| Lambda | ✓ | ✓ | ✓ |
| IAM Roles | ✓ | ✓ | ✓ |
| EventBridge | ✓ | ✓ | ✓ |
| CloudWatch | ✓ | ✓ | ✓ |
| CloudFormation | ✓ | ✓ | ✓ |
| S3 (SAM) | ✓ | ✓ | ✓ |
| S3 (app-specific) | - | - | ✓ |
| DynamoDB | - | - | ✓ |

## Adding a New App Policy

When adding a new application to the monorepo:

1. **Copy an existing policy** as a template (use `heartbeat-publisher-deploy-policy.json` for simple apps, `scryscraper-deploy-policy.json` for apps with storage)

2. **Update resource patterns** to match the new app name:
   - CloudFormation stack: `monorepo-fem-<app-name>-${ENVIRONMENT}*/*`
   - Lambda function: `<app-name>-*`
   - IAM roles: `<app-name>-*`
   - EventBridge rules: `<app-name>-*`
   - Log groups: `/aws/lambda/<app-name>-*`

3. **Add app-specific resources** if needed:
   - S3 buckets
   - DynamoDB tables
   - Other AWS services

4. **Keep shared resources identical**:
   - CloudFormation permissions
   - SAM S3 bucket access

5. **Use consistent placeholders**:
   - `${AWS_ACCOUNT_ID}`
   - `${AWS_REGION}`
   - `${ENVIRONMENT}`

6. **Validate against CloudFormation template**:
   - Check resource names match template outputs
   - Verify all required services are included
   - Ensure proper scoping (no wildcards unless necessary)

## Policy Review Checklist

### When Modifying Policies

- [ ] **Resource Scoping**: Are all resources scoped to the specific app? No unnecessary wildcards?
- [ ] **CloudFormation Template Match**: Do resource patterns match actual CloudFormation template names?
- [ ] **Shared Resources**: Are SAM deployment bucket permissions identical across all policies?
- [ ] **Placeholders**: Are all placeholders using consistent syntax (`${PLACEHOLDER_NAME}`)?
- [ ] **Required Permissions**: Does the policy include all permissions needed for:
  - [ ] CloudFormation stack deployment
  - [ ] Lambda creation and updates
  - [ ] IAM role management
  - [ ] EventBridge rules
  - [ ] CloudWatch logs, alarms, dashboards
  - [ ] App-specific resources (S3, DynamoDB, etc.)

### Validation Steps

1. **JSON Syntax**: Validate JSON is well-formed
   ```bash
   jq empty <app-name>-deploy-policy.json
   ```

2. **Resource Name Patterns**: Check against CloudFormation templates
   ```bash
   # Compare policy resources with template resource names
   grep -E "(FunctionName|LogGroupName|RoleName|BucketName|TableName)" apps/<app-name>/template.yaml
   ```

3. **Placeholder Consistency**: Verify all placeholders are present
   ```bash
   grep -E '\$\{[A-Z_]+\}' <app-name>-deploy-policy.json
   ```

4. **Test Deployment**: Deploy to development environment first
   - Monitor CloudWatch logs for permission denied errors
   - Verify all resources are created successfully
   - Check CloudFormation stack events for issues

### Common Issues

**Issue**: Deployment fails with "AccessDenied" error
**Solution**: Check the specific action and resource in the error message, add to policy if legitimate

**Issue**: Placeholder not substituted in workflow
**Solution**: Verify the workflow includes substitution step and placeholder names match exactly

**Issue**: Policy too permissive (wildcards where not needed)
**Solution**: Review CloudFormation template for exact resource names, use specific patterns

**Issue**: Missing permissions for new AWS service
**Solution**: Add new statement block scoped to app-specific resources

## Architecture Decisions

### Why Split Policies Per App?

**Least Privilege**: Each deployment role has access only to resources for its specific application, reducing blast radius of compromised credentials.

**Independent Deployment**: Apps can be deployed independently without requiring permissions to other apps' resources.

**Clear Ownership**: Policies explicitly document which resources belong to each app.

**Easier Auditing**: Security reviews can focus on per-app permissions rather than parsing a monolithic policy.

### Why Duplicate Shared Resource Permissions?

**Independence**: Each policy is self-contained and can be used standalone.

**Clarity**: No inheritance or base policies to track, everything explicit in one file.

**Simplicity**: Easier to understand and modify without worrying about breaking other apps.

### Why Use Placeholders?

**Environment Flexibility**: Same policy works for dev, exp, staging, and prod environments.

**Account Portability**: Policies can be used across different AWS accounts.

**Version Control**: Policies checked into git don't contain sensitive account IDs.

## Related Documentation

- Parent Plan: `.claude/plans/plan-20251107-split-iam-policies-least-privilege.md`
- This Plan: `.claude/plans/plan-20251107-3-split-iam-policies-per-app.md`
- CloudFormation Templates: `apps/*/template.yaml`
- GitHub Actions Workflows: `.github/workflows/`

## Security Notes

- These policies define what **GitHub Actions can do** during deployment (deployment permissions)
- Lambda execution permissions are defined in CloudFormation templates (runtime permissions)
- Always deploy changes to dev environment first to validate permissions
- Use CloudTrail to audit actual permission usage and identify unused permissions
- Review policies quarterly to ensure they remain aligned with actual resource needs
