# Definition of Excellence: CloudWatch Log Publisher Migration to AWS SAM + TypeScript Lambda

## Context

Migrating the existing Docker-based CloudWatch log publisher to a TypeScript Lambda function orchestrated by AWS SAM, with EventBridge for scheduling.

## Excellence Criteria

### 1. AWS SAM Template (template.yaml)

- [ ] **Valid SAM syntax** - Template passes `sam validate`
- [ ] **CloudWatch Log Group** - Explicitly defined with retention period
- [ ] **Lambda Function** - Configured with Node.js 20.x runtime (nodejs20.x)
- [ ] **EventBridge Schedule** - Cron expression configured for regular execution (e.g., rate(1 minute))
- [ ] **IAM Permissions** - Complete and minimal:
  - `logs:CreateLogStream` and `logs:PutLogEvents` for the target log group
  - Scoped to specific log group ARN (not wildcard where avoidable)
- [ ] **Environment Variables** - Configuration (log group name, log stream name) passed via environment
- [ ] **Clear Resource Naming** - Logical IDs and resource names clearly indicate purpose

### 2. TypeScript Lambda Code

- [ ] **Type Safety** - Proper TypeScript types, no `any`. no exceptions
- [ ] **Error Handling** - Try/catch blocks with meaningful error messages
- [ ] **CloudWatch Logs SDK Usage** - Correct AWS SDK v3 usage for CloudWatch Logs (PutLogEvents)
- [ ] **Handler Signature** - Proper Lambda handler type (EventBridge scheduled event)
- [ ] **Idempotent** - Safe to run repeatedly without side effects
- [ ] **Logging** - Console output showing what logs are being published (Lambda's own logs vs target logs)

### 3. Project Structure

- [ ] **Separate Directory** - Lambda code in dedicated folder (e.g., `packages/ts-cloudwatch-publisher/`)
- [ ] **package.json** - Dependencies clearly defined (AWS SDK v3 CloudWatch Logs client, TypeScript), `type: "module"` set
- [ ] **tsconfig.json** - ESM module system (module: ES2022, target: ES2022)
- [ ] **Build Process** - Clear build step that SAM can use (esbuild or tsc)
- [ ] **No Docker** - Previous Docker implementation cleanly removed or archived

### 4. Deployment & Testing

- [ ] **sam build** - Builds successfully without errors
- [ ] **sam deploy --guided** - Can deploy to AWS with clear parameter prompts
- [ ] **Local Testing** - Can test locally with `sam local invoke` or similar
- [ ] **Observability** - After deployment, can verify in CloudWatch:
  - Lambda execution logs appear in Lambda's own log group
  - Target log group receives the published logs
  - No permission errors

### 5. Documentation

- [ ] **README or Comments** - Explains:
  - What the Lambda does (publishes logs to CloudWatch Logs)
  - How to build and deploy
  - What resources are created
  - How to verify it's working
- [ ] **Architectural Decision** - Why SAM over Docker (cost, scalability, maintenance)
- [ ] **Scheduling Explanation** - How EventBridge schedule works

### 6. Migration Completeness

- [ ] **Functional Parity** - Achieves same outcome as Docker version (regular log publishing)
- [ ] **Clean Transition** - Old Docker files removed or clearly marked as deprecated
- [ ] **No Breaking Changes** - If this is consumed elsewhere, contracts maintained

## Grading Rubric

- **Excellent (90-100%)** - All criteria met, clean code, clear documentation
- **Good (70-89%)** - Core functionality works, minor issues with docs or permissions
- **Needs Improvement (<70%)** - Missing IAM permissions, no testing, or unclear structure

## Implementation Decisions

1. **AWS SDK Version**: v3 (CloudWatch Logs client)
2. **Execution Frequency**: Every 1 minute (rate(1 minute))
3. **Log Group Name**: Hardcoded in template
4. **Error Handling**: No internal retries, no DLQ - let exceptions bubble up to Lambda logs
5. **Retention Periods**:
   - Lambda execution logs: 1 day (auto-managed by AWS)
   - Target log group: 7 days
6. **Log Streams**: New stream per execution (timestamped)
7. **Log Format**: Structured JSON objects with consistent schema published to target log group

## Success Indicators

After completing this migration, I should be able to:

1. Run `sam build && sam deploy` and have a working Lambda
2. See logs published to the target CloudWatch log group
3. Confirm scheduled execution via EventBridge
4. Understand all IAM permissions and why they're needed
5. Easily modify the schedule or runtime without touching infrastructure manually
