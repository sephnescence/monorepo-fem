import { CloudWatchLogPublisher } from "@monorepo-fem/cloudwatch-log-publisher";
import type { ScheduledEvent } from "aws-lambda";

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
    throw new Error("Missing required environment variable: LOG_GROUP_NAME");
  }

  if (!logStreamPrefix) {
    throw new Error("Missing required environment variable: LOG_STREAM_PREFIX");
  }

  return {
    LOG_GROUP_NAME: logGroupName,
    LOG_STREAM_PREFIX: logStreamPrefix,
  };
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
  console.log("Lambda invoked by EventBridge scheduled event");
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    // Validate environment configuration
    const env = validateEnvironment();
    console.log(`Target log group: ${env.LOG_GROUP_NAME}`);

    // Create CloudWatch Log Publisher
    const publisher = new CloudWatchLogPublisher({
      logGroupName: env.LOG_GROUP_NAME,
      logStreamPrefix: env.LOG_STREAM_PREFIX,
    });

    // Publish heartbeat log
    await publisher.publish({
      message: "I wish for a new heartbeat",
      timestamp: new Date().toISOString(),
      source: "heartbeat-publisher",
      type: "heartbeat",
    });

    console.log("Handler completed successfully");
  } catch (error) {
    console.error("Error in Lambda handler:", error);

    // Log detailed error information
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    // Re-throw to let Lambda's retry logic handle it
    throw error;
  }
}
