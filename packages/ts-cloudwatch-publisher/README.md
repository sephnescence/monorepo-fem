# TypeScript CloudWatch Publisher

AWS Lambda function that publishes heartbeat logs to CloudWatch Logs on a scheduled basis using EventBridge.

## What This Lambda Does

This Lambda function:

- Runs on a schedule (default: every 1 minute) triggered by EventBridge
- Creates a timestamped log stream in a CloudWatch log group
- Publishes structured JSON heartbeat logs with timestamp and metadata
- Provides observability for testing scheduled Lambda execution and CloudWatch Logs integration

## Architecture Decision: SAM over Docker

**Why AWS SAM + Lambda instead of Docker containers?**

### Cost

- **Lambda**: Pay only for execution time (per-second billing). At 1 execution/minute with ~500ms execution time, this costs very little per month
- **Docker**: Continuous container runtime costs (EC2, ECS, or Fargate) even when idle

### Scalability

- **Lambda**: AWS manages runtime, automatic scaling, no orchestration needed
- **Docker**: Requires container orchestration (ECS, EKS) or manual EC2 management

### Maintenance

- **Lambda**: No Docker image updates, AWS maintains Node.js runtime and security patches
- **Docker**: Must maintain base images, rebuild for security patches, manage container registry

### Native AWS Integration

- **Lambda**: EventBridge scheduling built-in, IAM permissions granular and scoped
- **Docker**: Requires cron daemon, additional complexity for AWS service integration

## Prerequisites

- **AWS CLI** configured with credentials (`aws configure`)
- **AWS SAM CLI** installed ([installation guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
- **Node.js 20+** for local development
- **pnpm** for dependency management

## Project Structure

```sh
ts-cloudwatch-publisher/
├── src/
│   └── index.ts              # Lambda handler implementation
├── events/
│   └── eventbridge-event.json # Sample EventBridge event for testing
├── dist/                      # Built output (generated)
│   └── index.mjs             # Bundled Lambda code
├── .aws-sam/                  # SAM build artifacts (generated)
├── package.json               # Dependencies and build scripts
├── tsconfig.json             # TypeScript configuration
├── template.yaml             # AWS SAM infrastructure definition
└── README.md                 # This file
```

## How to Build

1. **Install dependencies:**

   ```sh
   pnpm install
   ```

2. **Build TypeScript code:**

   ```sh
   pnpm run build
   ```

   This uses esbuild to bundle the TypeScript code into an ESM module at `dist/index.mjs`.

3. **Build SAM package:**

   ```sh
   sam build
   ```

   This prepares the Lambda deployment package with dependencies.

## How to Deploy

### First-Time Deployment (Guided)

```sh
sam deploy --guided
```

You'll be prompted for:

- **Stack Name**: e.g., `ts-cloudwatch-publisher-dev`
- **AWS Region**: e.g., `us-east-1`
- **Environment**: `dev`, `staging`, or `prod`
- **ScheduleRate**: e.g., `rate(1 minute)`
- **LogRetentionDays**: e.g., `7`
- **Confirm changes**: Review CloudFormation changeset before deploying
- **Allow SAM CLI IAM role creation**: Yes (required for Lambda execution role)
- **Save arguments to samconfig.toml**: Yes (for subsequent deployments)

### Subsequent Deployments

After the first deployment, simply run:

```sh
sam deploy
```

Parameters will be read from `samconfig.toml`.

## Resources Created

This SAM template creates the following AWS resources:

1. **Lambda Function** (`CloudWatchPublisherFunction`)

   - Runtime: Node.js 20.x (ARM64 architecture)
   - Timeout: 30 seconds
   - Memory: 256 MB
   - Triggered by EventBridge schedule

2. **EventBridge Schedule Rule** (`PublisherSchedule`)

   - Default: `rate(1 minute)`
   - Configurable via `ScheduleRate` parameter
   - Automatically enabled on deployment

3. **Target CloudWatch Log Group** (`HeartbeatLogGroup`)

   - Name: `/monorepo-fem/ts-heartbeat-{Environment}`
   - Retention: 7 days (configurable)
   - Where heartbeat logs are published

4. **Lambda Execution Log Group** (`LambdaLogGroup`)

   - Name: `/aws/lambda/ts-cloudwatch-publisher-{Environment}`
   - Retention: 7 days
   - For monitoring the Lambda's own execution

5. **IAM Execution Role** (created automatically by SAM)
   - Permissions:
     - `logs:CreateLogStream` (scoped to target log group)
     - `logs:PutLogEvents` (scoped to target log group)
     - Basic Lambda execution permissions (for Lambda's own logs)

## How to Verify It's Working

### 1. Check Lambda Execution Logs

View the Lambda's own logs to see if it's executing successfully:

```sh
aws logs tail /aws/lambda/ts-cloudwatch-publisher-dev --follow
```

You should see log entries showing:

- Lambda invocation
- Event details
- Log stream creation
- Successful log publishing

### 2. Check Target Log Group for Published Logs

View the heartbeat logs published by the Lambda:

```sh
aws logs tail /monorepo-fem/ts-heartbeat-dev --follow
```

You should see structured JSON log entries:

```json
{
  "message": "heartbeat",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "source": "ts-cloudwatch-publisher",
  "type": "heartbeat"
}
```

### 3. Verify EventBridge Rule

Check that the schedule rule is enabled:

```sh
aws events describe-rule --name ts-cloudwatch-publisher-schedule-dev
```

Look for `"State": "ENABLED"` in the output.

### 4. Monitor via AWS Console

- **Lambda Console**: Check function invocations, duration, errors
- **CloudWatch Console**: View both log groups (Lambda execution + target logs)
- **EventBridge Console**: Verify rule triggers and invocation count

## Local Testing

Test the Lambda locally without deploying to AWS:

```sh
sam local invoke CloudWatchPublisherFunction --event events/eventbridge-event.json
```

**Note**: This requires Docker to be running, as SAM uses Docker to simulate the Lambda environment.

If you don't have Docker, you can test the TypeScript code directly (though this won't simulate the full Lambda environment):

```sh
pnpm run build
node dist/index.mjs
```

## Modifying the Schedule

To change how frequently the Lambda runs, update the `ScheduleRate` parameter in `template.yaml`:

```yaml
ScheduleRate:
  Type: String
  Default: rate(5 minutes) # Changed from rate(1 minute)
```

Or override it during deployment:

```sh
sam deploy --parameter-overrides ScheduleRate="rate(5 minutes)"
```

### Schedule Expression Examples

- `rate(1 minute)` - Every minute
- `rate(5 minutes)` - Every 5 minutes
- `rate(1 hour)` - Every hour
- `cron(0 12 * * ? *)` - Daily at noon UTC
- `cron(0/15 * * * ? *)` - Every 15 minutes

See [AWS Schedule Expressions](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-scheduled-rule-pattern.html) for more examples.

## Modifying Log Retention

To change how long logs are retained, update the `LogRetentionDays` parameter:

```sh
sam deploy --parameter-overrides LogRetentionDays=30
```

Allowed values: 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653

## Technical Details

### Module System

This project uses **ESM (ECMAScript Modules)** instead of CommonJS:

- `package.json` sets `"type": "module"`
- TypeScript configured for ES2022 modules
- Output is `.mjs` format

**Why ESM?**

- Modern standard, better tree-shaking for smaller bundles
- Native support in Node.js 20+
- Better alignment with AWS Lambda best practices

### AWS SDK v3

This project uses AWS SDK v3 (`@aws-sdk/client-cloudwatch-logs`):

- Modular imports (only import what you need)
- Smaller bundle sizes via tree-shaking
- Better TypeScript support

### Build Tool: esbuild

- Fast compilation (sub-second builds)
- Built-in bundling and minification
- Handles TypeScript, ESM, and dependencies out of the box

### IAM Permissions

The Lambda's IAM role follows the **principle of least privilege**:

- Permissions scoped to the specific target log group ARN (not wildcard)
- No unnecessary permissions
- Automatically managed by SAM CloudFormation

### Error Handling Strategy

- No internal retries in Lambda code
- Errors bubble up to Lambda's retry logic
- Lambda execution failures logged to CloudWatch
- EventBridge will not retry on failure (by design for scheduled events)

## Troubleshooting

### Lambda execution succeeds but no logs in target group

1. Check IAM permissions:

   ```sh
   aws iam get-role-policy --role-name ts-cloudwatch-publisher-dev-CloudWatchPublisherFunctionRole-XXXXX --policy-name CloudWatchPublisherFunctionRolePolicy
   ```

2. Verify log group exists:

   ```sh
   aws logs describe-log-groups --log-group-name-prefix /monorepo-fem/ts-heartbeat
   ```

3. Check Lambda environment variables:

   ```sh
   aws lambda get-function-configuration --function-name ts-cloudwatch-publisher-dev
   ```

### Lambda not executing on schedule

1. Check EventBridge rule is enabled:

   ```sh
   aws events describe-rule --name ts-cloudwatch-publisher-schedule-dev
   ```

2. Check rule has a target:

   ```sh
   aws events list-targets-by-rule --rule ts-cloudwatch-publisher-schedule-dev
   ```

### Build failures

1. Clear build artifacts:

   ```sh
   rm -rf dist/ .aws-sam/ node_modules/
   ```

2. Reinstall and rebuild:

   ```sh
   pnpm install
   pnpm run build
   sam build
   ```

## Clean Up

To delete all AWS resources created by this stack:

```sh
sam delete
```

This will remove:

- Lambda function
- EventBridge schedule rule
- Both CloudWatch log groups (including all logs)
- IAM execution role
- CloudFormation stack

**Warning**: This permanently deletes all logs. Export logs first if needed.

## Comparison to Previous Docker Implementation

| Aspect            | Docker Version                  | SAM + Lambda Version               |
| ----------------- | ------------------------------- | ---------------------------------- |
| **Runtime Cost**  | Continuous (EC2/ECS/Fargate)    | Per-execution (seconds of compute) |
| **Idle Cost**     | Yes                             | No                                 |
| **Maintenance**   | Docker images, base OS patches  | AWS manages runtime                |
| **Scheduling**    | Cron daemon in container        | EventBridge (managed service)      |
| **Observability** | Custom setup required           | Built-in CloudWatch integration    |
| **Scalability**   | Manual orchestration            | Automatic (though not needed here) |
| **Deployment**    | Docker push + container restart | `sam deploy`                       |

## Development Workflow

1. Make changes to `src/index.ts`
2. Build: `pnpm run build`
3. Test locally: `sam local invoke CloudWatchPublisherFunction --event events/eventbridge-event.json`
4. Deploy: `sam deploy`
5. Verify: `aws logs tail /monorepo-fem/ts-heartbeat-dev --follow`

## Contributing

This is a learning project focused on communication and architectural decision-making in software engineering. When making changes:

1. Document the "why" behind decisions
2. Consider trade-offs and alternatives
3. Update this README if behaviour changes
4. Add inline comments explaining non-obvious code
