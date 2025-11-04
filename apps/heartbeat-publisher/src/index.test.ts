import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ScheduledEvent } from 'aws-lambda';
import { MockCloudWatchLogPublisher } from '@monorepo-fem/cloudwatch-log-publisher/testing';

// Mock the cloudwatch-log-publisher module
let mockPublisherInstance: MockCloudWatchLogPublisher | null = null;
let pendingPublishError: Error | null = null;

vi.mock('@monorepo-fem/cloudwatch-log-publisher', () => {
  return {
    CloudWatchLogPublisher: class MockedCloudWatchLogPublisher {
      constructor(config: any) {
        mockPublisherInstance = new MockCloudWatchLogPublisher(config);
        // Apply any pending error
        if (pendingPublishError) {
          mockPublisherInstance.setPublishError(pendingPublishError);
        }
        return mockPublisherInstance as any;
      }
    },
  };
});

// Import the handler after mocking
const { handler } = await import('./index.js');

// Helper to get the mock publisher instance
function getMockPublisher(): MockCloudWatchLogPublisher {
  if (!mockPublisherInstance) {
    throw new Error('Mock publisher instance not available');
  }
  return mockPublisherInstance;
}

// Helper to set an error that will be applied to the next mock instance created
function setPendingPublishError(error: Error): void {
  pendingPublishError = error;
}

describe('Lambda Handler - Heartbeat Publisher', () => {
  // Store original env vars
  const originalEnv = process.env;

  beforeEach(() => {
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
    // Clear any mock publisher errors
    pendingPublishError = null;
    try {
      const mockPublisher = getMockPublisher();
      if (mockPublisher) {
        mockPublisher.clearPublishError();
        mockPublisher.clearPublishedEvents();
      }
    } catch {
      // Ignore if no mock instance exists
    }

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
      const event = createMockScheduledEvent();

      await expect(handler(event)).resolves.not.toThrow();

      // Verify that publisher was configured correctly
      const mockPublisher = getMockPublisher();
      expect(mockPublisher.getLogGroupName()).toBe('/test/heartbeats');
      expect(mockPublisher.getLogStreamPrefix()).toBe('test-stream');
    });
  });

  describe('Heartbeat Publishing', () => {
    it('should publish heartbeat successfully', async () => {
      const event = createMockScheduledEvent();
      await handler(event);

      const mockPublisher = getMockPublisher();
      expect(mockPublisher.getPublishedEventCount()).toBe(1);

      const publishedEvent = mockPublisher.getLastPublishedEvent();
      expect(publishedEvent).toBeDefined();
      expect(publishedEvent!.logEvent).toMatchObject({
        message: 'I have a heartbeat',
        source: 'heartbeat-publisher',
        type: 'heartbeat',
        timestamp: expect.any(String),
      });
    });

    it('should propagate publisher errors', async () => {
      // Set error before creating the mock instance
      setPendingPublishError(new Error('CloudWatch service unavailable'));

      const event = createMockScheduledEvent();
      await expect(handler(event)).rejects.toThrow('CloudWatch service unavailable');
    });
  });


  describe('Handler Execution', () => {
    it('should complete full execution flow successfully', async () => {
      const event = createMockScheduledEvent();

      await expect(handler(event)).resolves.not.toThrow();

      // Verify event was published
      const mockPublisher = getMockPublisher();
      expect(mockPublisher.getPublishedEventCount()).toBe(1);
    });

    it('should handle EventBridge scheduled event structure', async () => {
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


  describe('Error Handling', () => {
    it('should log error details when handler fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Set error before creating the mock instance
      setPendingPublishError(new Error('Test error'));

      const event = createMockScheduledEvent();
      await expect(handler(event)).rejects.toThrow('Test error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in Lambda handler:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should re-throw errors for Lambda retry logic', async () => {
      // Set error before creating the mock instance
      setPendingPublishError(new Error('Service error'));

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
