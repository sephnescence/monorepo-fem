import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  PutLogEventsCommand,
  ResourceAlreadyExistsException,
} from '@aws-sdk/client-cloudwatch-logs';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CloudWatchLogPublisher,
  generateLogStreamName,
  createLogStream,
  publishLog,
} from './index.js';

const cwLogsMock = mockClient(CloudWatchLogsClient);

describe('CloudWatch Log Publisher', () => {
  beforeEach(() => {
    cwLogsMock.reset();
    vi.clearAllMocks();
  });

  describe('generateLogStreamName', () => {
    it('should generate log stream name with correct format', () => {
      const prefix = 'test-stream';
      const logStreamName = generateLogStreamName(prefix);

      expect(logStreamName).toMatch(/^test-stream-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/);
    });

    it('should generate unique names for different timestamps', () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));
      const name1 = generateLogStreamName('test');

      vi.setSystemTime(new Date('2025-01-01T12:00:01.000Z'));
      const name2 = generateLogStreamName('test');

      vi.useRealTimers();

      expect(name1).toBe('test-2025-01-01-12-00-00');
      expect(name2).toBe('test-2025-01-01-12-00-01');
      expect(name1).not.toBe(name2);
    });
  });

  describe('createLogStream', () => {
    it('should create log stream successfully', async () => {
      cwLogsMock.on(CreateLogStreamCommand).resolves({});

      const client = new CloudWatchLogsClient({});
      await createLogStream(client, '/test/logs', 'test-stream-2025-01-01');

      const calls = cwLogsMock.commandCalls(CreateLogStreamCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toMatchObject({
        logGroupName: '/test/logs',
        logStreamName: 'test-stream-2025-01-01',
      });
    });

    it('should handle ResourceAlreadyExistsException gracefully', async () => {
      cwLogsMock
        .on(CreateLogStreamCommand)
        .rejects(
          new ResourceAlreadyExistsException({
            message: 'Log stream already exists',
            $metadata: {},
          })
        );

      const client = new CloudWatchLogsClient({});

      await expect(
        createLogStream(client, '/test/logs', 'test-stream-2025-01-01')
      ).resolves.not.toThrow();
    });

    it('should propagate other errors', async () => {
      cwLogsMock
        .on(CreateLogStreamCommand)
        .rejects(new Error('Service unavailable'));

      const client = new CloudWatchLogsClient({});

      await expect(
        createLogStream(client, '/test/logs', 'test-stream-2025-01-01')
      ).rejects.toThrow('Service unavailable');
    });
  });

  describe('publishLog', () => {
    it('should publish log event with correct structure', async () => {
      cwLogsMock.on(PutLogEventsCommand).resolves({});

      const client = new CloudWatchLogsClient({});
      const logEvent = {
        message: 'test message',
        timestamp: new Date().toISOString(),
        source: 'test-source',
        type: 'test',
      };

      await publishLog(client, '/test/logs', 'test-stream', logEvent);

      const calls = cwLogsMock.commandCalls(PutLogEventsCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toMatchObject({
        logGroupName: '/test/logs',
        logStreamName: 'test-stream',
        logEvents: expect.any(Array),
      });

      const logEvents = calls[0].args[0].input.logEvents!;
      expect(logEvents).toHaveLength(1);
      expect(logEvents[0]).toMatchObject({
        timestamp: expect.any(Number),
        message: expect.stringContaining('test message'),
      });

      const message = JSON.parse(logEvents[0].message);
      expect(message).toMatchObject(logEvent);
    });

    it('should propagate PutLogEvents errors', async () => {
      cwLogsMock.on(PutLogEventsCommand).rejects(new Error('Throttling exception'));

      const client = new CloudWatchLogsClient({});
      const logEvent = { message: 'test' };

      await expect(
        publishLog(client, '/test/logs', 'test-stream', logEvent)
      ).rejects.toThrow('Throttling exception');
    });
  });

  describe('CloudWatchLogPublisher class', () => {
    it('should create publisher with provided configuration', () => {
      const publisher = new CloudWatchLogPublisher({
        logGroupName: '/test/logs',
        logStreamPrefix: 'test-prefix',
      });

      expect(publisher.getLogGroupName()).toBe('/test/logs');
      expect(publisher.getLogStreamPrefix()).toBe('test-prefix');
    });

    it('should accept custom CloudWatch client', () => {
      const customClient = new CloudWatchLogsClient({});
      const publisher = new CloudWatchLogPublisher({
        logGroupName: '/test/logs',
        logStreamPrefix: 'test-prefix',
        client: customClient,
      });

      expect(publisher).toBeDefined();
    });

    it('should publish log event successfully', async () => {
      cwLogsMock.on(CreateLogStreamCommand).resolves({});
      cwLogsMock.on(PutLogEventsCommand).resolves({});

      const publisher = new CloudWatchLogPublisher({
        logGroupName: '/test/logs',
        logStreamPrefix: 'test-prefix',
      });

      const logEvent = {
        message: 'test message',
        timestamp: new Date().toISOString(),
        source: 'test',
        type: 'test',
      };

      await expect(publisher.publish(logEvent)).resolves.not.toThrow();

      expect(cwLogsMock.commandCalls(CreateLogStreamCommand)).toHaveLength(1);
      expect(cwLogsMock.commandCalls(PutLogEventsCommand)).toHaveLength(1);
    });

    it('should create unique log streams for each publish', async () => {
      cwLogsMock.on(CreateLogStreamCommand).resolves({});
      cwLogsMock.on(PutLogEventsCommand).resolves({});

      const publisher = new CloudWatchLogPublisher({
        logGroupName: '/test/logs',
        logStreamPrefix: 'test-prefix',
      });

      vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));
      await publisher.publish({ message: 'first' });

      vi.setSystemTime(new Date('2025-01-01T12:00:01.000Z'));
      await publisher.publish({ message: 'second' });

      vi.useRealTimers();

      const calls = cwLogsMock.commandCalls(CreateLogStreamCommand);
      expect(calls).toHaveLength(2);

      const stream1 = calls[0].args[0].input.logStreamName;
      const stream2 = calls[1].args[0].input.logStreamName;

      expect(stream1).toBe('test-prefix-2025-01-01-12-00-00');
      expect(stream2).toBe('test-prefix-2025-01-01-12-00-01');
      expect(stream1).not.toBe(stream2);
    });

    it('should handle publish errors', async () => {
      cwLogsMock.on(CreateLogStreamCommand).resolves({});
      cwLogsMock.on(PutLogEventsCommand).rejects(new Error('Service error'));

      const publisher = new CloudWatchLogPublisher({
        logGroupName: '/test/logs',
        logStreamPrefix: 'test-prefix',
      });

      await expect(publisher.publish({ message: 'test' })).rejects.toThrow('Service error');
    });
  });
});
