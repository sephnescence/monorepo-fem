import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  PutLogEventsCommand,
  ResourceAlreadyExistsException,
} from '@aws-sdk/client-cloudwatch-logs';

/**
 * Configuration options for CloudWatch Log Publisher
 */
export interface CloudWatchLogPublisherConfig {
  logGroupName: string;
  logStreamPrefix: string;
  client?: CloudWatchLogsClient;
}

/**
 * A log event to be published to CloudWatch
 */
export interface LogEvent {
  message: string;
  timestamp?: string;
  source?: string;
  type?: string;
  [key: string]: unknown;
}

/**
 * Generates a timestamped log stream name
 * Format: {prefix}-YYYY-MM-DD-HH-MM-SS
 */
export function generateLogStreamName(prefix: string): string {
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
export async function createLogStream(
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
 * Publishes a log event to CloudWatch Logs
 */
export async function publishLog(
  client: CloudWatchLogsClient,
  logGroupName: string,
  logStreamName: string,
  logEvent: LogEvent
): Promise<void> {
  const timestamp = Date.now();

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
 * CloudWatch Log Publisher class that encapsulates log publishing functionality
 */
export class CloudWatchLogPublisher {
  private client: CloudWatchLogsClient;
  private logGroupName: string;
  private logStreamPrefix: string;

  constructor(config: CloudWatchLogPublisherConfig) {
    this.logGroupName = config.logGroupName;
    this.logStreamPrefix = config.logStreamPrefix;
    this.client = config.client ?? new CloudWatchLogsClient({});
  }

  /**
   * Publishes a log event to CloudWatch Logs
   * Creates a new log stream with timestamp for each invocation
   */
  async publish(logEvent: LogEvent): Promise<void> {
    const logStreamName = generateLogStreamName(this.logStreamPrefix);

    await createLogStream(this.client, this.logGroupName, logStreamName);
    await publishLog(this.client, this.logGroupName, logStreamName, logEvent);
  }

  /**
   * Gets the log group name
   */
  getLogGroupName(): string {
    return this.logGroupName;
  }

  /**
   * Gets the log stream prefix
   */
  getLogStreamPrefix(): string {
    return this.logStreamPrefix;
  }
}
