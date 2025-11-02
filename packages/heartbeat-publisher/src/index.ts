import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  PutLogEventsCommand,
  ResourceAlreadyExistsException,
} from '@aws-sdk/client-cloudwatch-logs';
import { ScheduledEvent } from 'aws-lambda';

/**
 * Environment variables required by this Lambda
 */
interface LambdaEnvironment {
  LOG_GROUP_NAME: string;
  LOG_STREAM_PREFIX: string;
}

/**
 * Validates that all required environment variables are present
 */
function validateEnvironment(): LambdaEnvironment {
  const logGroupName = process.env.LOG_GROUP_NAME;
  const logStreamPrefix = process.env.LOG_STREAM_PREFIX;

  if (!logGroupName) {
    throw new Error('Missing required environment variable: LOG_GROUP_NAME');
  }

  if (!logStreamPrefix) {
    throw new Error('Missing required environment variable: LOG_STREAM_PREFIX');
  }

  return {
    LOG_GROUP_NAME: logGroupName,
    LOG_STREAM_PREFIX: logStreamPrefix,
  };
}

/**
 * Generates a timestamped log stream name
 * Format: {prefix}-YYYY-MM-DD-HH-MM-SS
 */
function generateLogStreamName(prefix: string): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/T/, '-')
    .replace(/\..+/, '')
    .replace(/:/g, '-');
  return `${prefix}-${timestamp}`;
}

/**
 * Creates a CloudWatch log stream if it doesn't already exist
 * Idempotent - ignores ResourceAlreadyExistsException
 */
async function createLogStream(
  client: CloudWatchLogsClient,
  logGroupName: string,
  logStreamName: string
): Promise<void> {
  try {
    await client.send(
      new CreateLogStreamCommand({
        logGroupName,
        logStreamName,
      })
    );
    console.log(`Created log stream: ${logStreamName}`);
  } catch (error) {
    // If the stream already exists, that's fine - this function is idempotent
    if (error instanceof ResourceAlreadyExistsException) {
      console.log(`Log stream already exists: ${logStreamName}`);
      return;
    }
    throw error;
  }
}

/**
 * Publishes a heartbeat log event to CloudWatch Logs
 */
async function publishHeartbeatLog(
  client: CloudWatchLogsClient,
  logGroupName: string,
  logStreamName: string
): Promise<void> {
  const timestamp = Date.now();
  const logEvent = {
    message: 'heartbeat',
    timestamp: new Date(timestamp).toISOString(),
    source: 'heartbeat-publisher',
    type: 'heartbeat',
  };

  console.log(`Publishing log event to ${logGroupName}/${logStreamName}:`, logEvent);

  await client.send(
    new PutLogEventsCommand({
      logGroupName,
      logStreamName,
      logEvents: [
        {
          message: JSON.stringify(logEvent),
          timestamp,
        },
      ],
    })
  );

  console.log('Successfully published log event');
}

/**
 * Lambda handler for EventBridge scheduled events
 *
 * This function is triggered by EventBridge on a schedule (e.g., every 1 minute).
 * It publishes a heartbeat log message to a CloudWatch log group for monitoring purposes.
 *
 * EventBridge scheduled event structure:
 * {
 *   "version": "0",
 *   "id": "event-id",
 *   "detail-type": "Scheduled Event",
 *   "source": "aws.events",
 *   "account": "123456789012",
 *   "time": "2024-01-01T12:00:00Z",
 *   "region": "us-east-1",
 *   "resources": ["arn:aws:events:us-east-1:123456789012:rule/rule-name"],
 *   "detail": {}
 * }
 */
export async function handler(event: ScheduledEvent): Promise<void> {
  console.log('Lambda invoked by EventBridge scheduled event');
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Validate environment configuration
    const env = validateEnvironment();
    console.log(`Target log group: ${env.LOG_GROUP_NAME}`);

    // Create CloudWatch Logs client
    const client = new CloudWatchLogsClient({});

    // Generate unique log stream name with timestamp
    const logStreamName = generateLogStreamName(env.LOG_STREAM_PREFIX);

    // Create log stream (idempotent)
    await createLogStream(client, env.LOG_GROUP_NAME, logStreamName);

    // Publish heartbeat log
    await publishHeartbeatLog(client, env.LOG_GROUP_NAME, logStreamName);

    console.log('Handler completed successfully');
  } catch (error) {
    console.error('Error in Lambda handler:', error);

    // Log detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    // Re-throw to let Lambda's retry logic handle it
    throw error;
  }
}
