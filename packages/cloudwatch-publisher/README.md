# CloudWatch Publisher Docker Image

## Overview

This Docker image publishes heartbeat logs to AWS CloudWatch Logs every minute. It's designed as a lightweight, self-contained monitoring solution that demonstrates continuous metric publishing using bash scripts and cron scheduling.

**Why this exists:**

- Validates AWS CloudWatch connectivity and permissions
- Provides a simple example of scheduled tasks in Docker containers
- Demonstrates observability best practices in a minimal footprint
- Useful for testing CloudWatch Logs integration in development environments

## Prerequisites

Before using this image, ensure you have:

1. **Docker installed** - [Install Docker](https://docs.docker.com/get-docker/)
2. **AWS account** with CloudWatch Logs access
3. **AWS credentials** with appropriate permissions (see below)

## Required IAM Permissions

Your AWS credentials need the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

**Note:** This follows the principle of least privilege. The image only needs permissions to create log groups/streams and publish log events.

## Quick Start

### 1. Build the Image

```sh
docker build -t cloudwatch-publisher .
```

**What this does:** Builds a Docker image from the Dockerfile in the current directory and tags it as `cloudwatch-publisher`.

### 2. Run the Container

```sh
docker run -d \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -e AWS_REGION=ap-southeast-2 \
  --name cloudwatch-publisher \
  cloudwatch-publisher
```

**Flag explanations:**

- `-d` - Runs the container in detached mode (background)
- `-e` - Sets environment variables (AWS credentials and region)
- `--name` - Assigns a friendly name for easier management

**For testing (auto-cleanup on stop):**

```sh
docker run -d \
  --rm \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -e AWS_REGION=ap-southeast-2 \
  --name cloudwatch-publisher-test \
  cloudwatch-publisher
```

The `--rm` flag automatically removes the container when it stops - useful for testing.

### 3. View Logs

```sh
docker logs -f cloudwatch-publisher
```

**What this does:** Shows container logs in real-time. Press Ctrl+C to stop following logs (container keeps running).

### 4. Stop the Container

```sh
docker stop cloudwatch-publisher
```

**What this does:** Sends SIGTERM to gracefully shut down the container.

## Configuration Options

All configuration is done via environment variables:

| Environment Variable    | Required | Default          | Description                             |
| ----------------------- | -------- | ---------------- | --------------------------------------- |
| `AWS_ACCESS_KEY_ID`     | Yes      | None             | AWS access key for authentication       |
| `AWS_SECRET_ACCESS_KEY` | Yes      | None             | AWS secret key for authentication       |
| `AWS_REGION`            | No       | `ap-southeast-2` | AWS region where logs will be published |

**Example with custom region:**

```sh
docker run -d \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -e AWS_REGION=us-east-1 \
  --name cloudwatch-publisher \
  cloudwatch-publisher
```

## Verification

### Check Container is Running

```sh
docker ps
```

You should see `cloudwatch-publisher` in the list of running containers.

### Check Container Logs

```sh
docker logs cloudwatch-publisher
```

You should see output like:

```json
{"service": "cloudwatch-publisher-entrypoint", "timestamp": "2025-10-30T12:34:56Z", "level": "INFO", "message": "Starting CloudWatch Publisher container..."}
{"service": "cloudwatch-publisher-entrypoint", "timestamp": "2025-10-30T12:34:56Z", "level": "INFO", "message": "Environment validation successful (AWS_REGION=ap-southeast-2)"}
{"service": "cloudwatch-publisher-entrypoint", "timestamp": "2025-10-30T12:34:57Z", "level": "INFO", "message": "AWS credentials validated successfully"}
{"service": "cloudwatch-publisher", "timestamp": "2025-10-30T12:35:00Z", "level": "INFO", "message": "Successfully published log to CloudWatch Logs..."}
```

### Check CloudWatch Console

1. Log into the [AWS Console](https://console.aws.amazon.com/)
2. Navigate to **CloudWatch** service
3. In the left sidebar, click **Logs** → **Log groups**
4. Find the log group `/monorepo-fem/heartbeat`
5. Click on the log stream (named `heartbeat-YYYY-MM-DD`)
6. You should see heartbeat events appearing every minute

**Expected timeline:** Logs should appear within 2 minutes of container start (first cron execution + processing time).

## Troubleshooting

### Container Exits Immediately

**Check logs:**

```sh
docker logs cloudwatch-publisher
```

**Common causes:**

1. **Missing environment variables** - Ensure all required variables are set
2. **Invalid AWS credentials** - Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct
3. **No IAM permissions** - Check that credentials have required CloudWatch permissions

### No Logs Appearing in CloudWatch

**Check container logs:**

```sh
docker logs cloudwatch-publisher
```

**Common causes:**

1. **Wrong region** - Ensure you're checking CloudWatch in the correct AWS region
2. **IAM permissions** - Verify credentials have `logs:CreateLogGroup`, `logs:CreateLogStream`, and `logs:PutLogEvents` permissions
3. **Network issues** - Container needs internet access to reach AWS APIs
4. **Credential expiry** - If using temporary credentials, they may have expired

**View detailed AWS CLI errors:**

```sh
docker logs cloudwatch-publisher 2>&1 | grep ERROR
```

### Interactive Debugging

If you need to debug inside the container:

```sh
docker run -it \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -e AWS_REGION=ap-southeast-2 \
  --entrypoint /bin/bash \
  cloudwatch-publisher
```

**Flag explanations:**

- `-it` - Interactive mode with TTY (for shell access)
- `--entrypoint /bin/bash` - Overrides the default entrypoint to give you a shell

**Note:** Use `-it` for debugging only, not for normal operation. For normal operation, use `-d` (detached mode).

## Security Notes

### Non-Root Execution

This container runs as a non-root user (`appuser`) for security:

- **Limits blast radius:** If the container is compromised, the attacker has limited privileges
- **Best practice:** Non-root execution is a Docker security best practice
- **Principle of least privilege:** Container only has permissions it needs to function

### Credential Handling

**Do NOT:**

- Hardcode credentials in the Dockerfile
- Commit `.env` files with credentials to version control
- Share credentials in logs or error messages

**Do:**

- Pass credentials via environment variables at runtime
- Use IAM roles when running in AWS (ECS, EKS, EC2)
- Rotate credentials regularly
- Use AWS Secrets Manager or Parameter Store for production deployments

### IAM Permissions

The required permissions are intentionally minimal:

- `logs:CreateLogGroup` - Only for creating log groups
- `logs:CreateLogStream` - Only for creating log streams
- `logs:PutLogEvents` - Only for publishing log events

No permissions for reading, deleting, or managing other AWS resources.

## Development

### Modifying the Script

The main publishing script is located at `scripts/publish-log.sh`. After modifying:

1. Rebuild the image:

   ```sh
   docker build -t cloudwatch-publisher .
   ```

2. Stop the old container:

   ```sh
   docker stop cloudwatch-publisher
   docker rm cloudwatch-publisher
   ```

3. Start a new container with the updated image:

   ```sh
   docker run -d \
     -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
     -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
     -e AWS_REGION=ap-southeast-2 \
     --name cloudwatch-publisher \
     cloudwatch-publisher
   ```

### Changing the Schedule

The cron schedule is defined in `scripts/crontab`:

```sh
*/1 * * * * /scripts/publish-log.sh >> /proc/1/fd/1 2>> /proc/1/fd/2
```

**Current schedule:** Every minute (`*/1 * * * *`)

**To change to every 5 minutes:** Change to `*/5 * * * *`

**To change to every hour:** Change to `0 * * * *`

After modifying the crontab file, rebuild and restart the container.

### Testing Scripts Locally

You can test the publishing script without Docker:

```sh
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=ap-southeast-2

./scripts/publish-log.sh
```

**Note:** Requires bash and AWS CLI installed locally.

## Architecture

```sh
┌─────────────────────────────────────┐
│  Docker Container                   │
│  ┌───────────────────────────────┐  │
│  │  entrypoint.sh (PID 1)        │  │
│  │  - Validates environment      │  │
│  │  - Validates AWS credentials  │  │
│  │  - Installs crontab           │  │
│  │  - Starts crond               │  │
│  │  - Waits for signals          │  │
│  └───────────────────────────────┘  │
│              │                      │
│              ▼                      │
│  ┌───────────────────────────────┐  │
│  │  crond (background)           │  │
│  │  - Executes on schedule       │  │
│  └───────────────────────────────┘  │
│              │                      │
│              ▼ (every minute)       │
│  ┌───────────────────────────────┐  │
│  │  publish-log.sh               │  │
│  │  - Creates log group/stream   │  │
│  │  - Publishes heartbeat event  │  │
│  │  - Retries on failure         │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
              │
              ▼ (AWS API)
┌─────────────────────────────────────┐
│  AWS CloudWatch Logs                │
│  Log Group: /monorepo-fem/heartbeat │
│  Log Stream: heartbeat-YYYY-MM-DD   │
└─────────────────────────────────────┘
```

## Technical Details

- **Base Image:** Alpine Linux 3.19 (~7MB)
- **Total Size:** < 100MB
- **Packages:** bash, aws-cli, dcron
- **Timezone:** UTC (all timestamps)
- **Log Format:** JSON with structured fields
- **Retry Logic:** 3 attempts with exponential backoff

## License

This is a demonstration project for learning purposes.
