import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  PutLogEventsCommand,
  ResourceAlreadyExistsException,
} from '@aws-sdk/client-cloudwatch-logs';
import type { ScheduledEvent } from 'aws-lambda';

// Import the handler
import { handler } from './index.js';

// Create mock client
const cwLogsMock = mockClient(CloudWatchLogsClient);

describe('Lambda Handler - Heartbeat Publisher', () => {
  // Store original env vars
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset mocks before each test
    cwLogsMock.reset();

    // Reset environment variables
    process.env = {
      ...originalEnv,
      LOG_GROUP_NAME: '/test/heartbeats',
      LOG_STREAM_PREFIX: 'test-stream',
    };

    // Clear console spies
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Environment Validation', () => {
    it('should throw error when LOG_GROUP_NAME is missing', async () => {
      delete process.env.LOG_GROUP_NAME;

      const event = createMockScheduledEvent();

      await expect(handler(event)).rejects.toThrow(
        'Missing required environment variable: LOG_GROUP_NAME'
      );
    });

    it('should throw error when LOG_STREAM_PREFIX is missing', async () => {
      delete process.env.LOG_STREAM_PREFIX;

      const event = createMockScheduledEvent();

      await expect(handler(event)).rejects.toThrow(
        'Missing required environment variable: LOG_STREAM_PREFIX'
      );
    });

    it('should accept valid environment variables', async () => {
      // Setup successful mocks
      cwLogsMock.on(CreateLogStreamCommand).resolves({});
      cwLogsMock.on(PutLogEventsCommand).resolves({});

      const event = createMockScheduledEvent();

      await expect(handler(event)).resolves.not.toThrow();
    });
  });

  describe('Log Stream Creation', () => {
    it('should create log stream successfully', async () => {
      cwLogsMock.on(CreateLogStreamCommand).resolves({});
      cwLogsMock.on(PutLogEventsCommand).resolves({});

      const event = createMockScheduledEvent();
      await handler(event);

      const createLogCalls = cwLogsMock.commandCalls(CreateLogStreamCommand);
      expect(createLogCalls).toHaveLength(1);
      expect(createLogCalls[0].args[0].input).toMatchObject({
        logGroupName: '/test/heartbeats',
        logStreamName: expect.stringMatching(/^test-stream-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/),
      });
    });

    it('should handle ResourceAlreadyExistsException gracefully', async () => {
      // Simulate log stream already exists
      cwLogsMock
        .on(CreateLogStreamCommand)
        .rejects(
          new ResourceAlreadyExistsException({
            message: 'Log stream already exists',
            $metadata: {},
          })
        );
      cwLogsMock.on(PutLogEventsCommand).resolves({});

      const event = createMockScheduledEvent();

      // Should not throw despite ResourceAlreadyExistsException
      await expect(handler(event)).resolves.not.toThrow();

      // Should still attempt to publish logs
      const putLogCalls = cwLogsMock.commandCalls(PutLogEventsCommand);
      expect(putLogCalls).toHaveLength(1);
    });

    it('should propagate other CreateLogStream errors', async () => {
      cwLogsMock
        .on(CreateLogStreamCommand)
        .rejects(new Error('CloudWatch service unavailable'));

      const event = createMockScheduledEvent();

      await expect(handler(event)).rejects.toThrow('CloudWatch service unavailable');
    });
  });

  describe('Heartbeat Log Publishing', () => {
    beforeEach(() => {
      cwLogsMock.on(CreateLogStreamCommand).resolves({});
    });

    it('should publish heartbeat log with correct structure', async () => {
      cwLogsMock.on(PutLogEventsCommand).resolves({});

      const event = createMockScheduledEvent();
      await handler(event);

      const putLogCalls = cwLogsMock.commandCalls(PutLogEventsCommand);
      expect(putLogCalls).toHaveLength(1);

      const logEvents = putLogCalls[0].args[0].input.logEvents;

      expect(logEvents).toHaveLength(1);
      expect(logEvents![0]).toMatchObject({
        timestamp: expect.any(Number),
        message: expect.stringContaining('heartbeat'),
      });

      // Parse and validate message structure
      const message = JSON.parse(logEvents![0].message);
      expect(message).toMatchObject({
        message: 'heartbeat',
        timestamp: expect.any(String),
        source: 'heartbeat-publisher',
        type: 'heartbeat',
      });
    });

    it('should publish to correct log group and stream', async () => {
      cwLogsMock.on(PutLogEventsCommand).resolves({});

      const event = createMockScheduledEvent();
      await handler(event);

      const putLogCalls = cwLogsMock.commandCalls(PutLogEventsCommand);
      expect(putLogCalls).toHaveLength(1);
      expect(putLogCalls[0].args[0].input).toMatchObject({
        logGroupName: '/test/heartbeats',
        logStreamName: expect.stringMatching(/^test-stream-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/),
        logEvents: expect.any(Array),
      });
    });

    it('should propagate PutLogEvents errors', async () => {
      cwLogsMock.on(PutLogEventsCommand).rejects(new Error('Throttling exception'));

      const event = createMockScheduledEvent();

      await expect(handler(event)).rejects.toThrow('Throttling exception');
    });
  });

  describe('End-to-End Handler Execution', () => {
    it('should complete full execution flow successfully', async () => {
      cwLogsMock.on(CreateLogStreamCommand).resolves({});
      cwLogsMock.on(PutLogEventsCommand).resolves({});

      const event = createMockScheduledEvent();

      await expect(handler(event)).resolves.not.toThrow();

      // Verify both commands were called
      expect(cwLogsMock.commandCalls(CreateLogStreamCommand)).toHaveLength(1);
      expect(cwLogsMock.commandCalls(PutLogEventsCommand)).toHaveLength(1);
    });

    it('should handle EventBridge scheduled event structure', async () => {
      cwLogsMock.on(CreateLogStreamCommand).resolves({});
      cwLogsMock.on(PutLogEventsCommand).resolves({});

      const event: ScheduledEvent = {
        version: '0',
        id: 'test-event-id',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: '2024-01-01T12:00:00Z',
        region: 'ap-southeast-2',
        resources: ['arn:aws:events:ap-southeast-2:123456789012:rule/test-rule'],
        detail: {},
      };

      await expect(handler(event)).resolves.not.toThrow();
    });
  });

  describe('Log Stream Name Generation', () => {
    it('should generate log stream names with correct format', async () => {
      cwLogsMock.on(CreateLogStreamCommand).resolves({});
      cwLogsMock.on(PutLogEventsCommand).resolves({});

      const event = createMockScheduledEvent();
      await handler(event);

      const createLogCall = cwLogsMock.commandCalls(CreateLogStreamCommand)[0];
      const logStreamName = createLogCall.args[0].input.logStreamName;

      // Should match format: prefix-YYYY-MM-DD-HH-MM-SS
      expect(logStreamName).toMatch(/^test-stream-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/);
    });

    it('should generate unique log stream names on each invocation', async () => {
      cwLogsMock.on(CreateLogStreamCommand).resolves({});
      cwLogsMock.on(PutLogEventsCommand).resolves({});

      // Mock Date to return first timestamp
      const mockDate1 = new Date('2025-01-01T12:00:00.000Z');
      vi.setSystemTime(mockDate1);

      const event = createMockScheduledEvent();

      // First invocation
      await handler(event);
      const firstCall = cwLogsMock.commandCalls(CreateLogStreamCommand)[0];
      const firstName = firstCall.args[0].input.logStreamName;

      cwLogsMock.reset();
      cwLogsMock.on(CreateLogStreamCommand).resolves({});
      cwLogsMock.on(PutLogEventsCommand).resolves({});

      // Mock Date to return different timestamp (1 second later)
      const mockDate2 = new Date('2025-01-01T12:00:01.000Z');
      vi.setSystemTime(mockDate2);

      // Second invocation
      await handler(event);
      const secondCall = cwLogsMock.commandCalls(CreateLogStreamCommand)[0];
      const secondName = secondCall.args[0].input.logStreamName;

      // Reset system time
      vi.useRealTimers();

      // Names should be different due to timestamp
      expect(firstName).not.toBe(secondName);
      expect(firstName).toBe('test-stream-2025-01-01-12-00-00');
      expect(secondName).toBe('test-stream-2025-01-01-12-00-01');
    });
  });

  describe('Error Handling and Logging', () => {
    it('should log error details when handler fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      cwLogsMock
        .on(CreateLogStreamCommand)
        .rejects(new Error('Test error'));

      const event = createMockScheduledEvent();

      await expect(handler(event)).rejects.toThrow('Test error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in Lambda handler:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should re-throw errors for Lambda retry logic', async () => {
      cwLogsMock.on(CreateLogStreamCommand).rejects(new Error('Service error'));

      const event = createMockScheduledEvent();

      // Error should propagate up for Lambda to handle
      await expect(handler(event)).rejects.toThrow('Service error');
    });
  });
});

/**
 * Helper function to create a mock EventBridge scheduled event
 */
function createMockScheduledEvent(): ScheduledEvent {
  return {
    version: '0',
    id: 'mock-event-id',
    'detail-type': 'Scheduled Event',
    source: 'aws.events',
    account: '123456789012',
    time: new Date().toISOString(),
    region: 'ap-southeast-2',
    resources: ['arn:aws:events:ap-southeast-2:123456789012:rule/mock-rule'],
    detail: {},
  };
}
