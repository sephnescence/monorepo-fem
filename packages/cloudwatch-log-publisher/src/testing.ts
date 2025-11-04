/**
 * Testing utilities for cloudwatch-log-publisher
 * Provides mocks and test helpers for packages that depend on this library
 */

import type { CloudWatchLogPublisherConfig, LogEvent } from './index.js';

/**
 * A captured log event from the mock publisher
 */
export interface CapturedLogEvent {
  logEvent: LogEvent;
  timestamp: number;
}

/**
 * Mock implementation of CloudWatchLogPublisher for testing
 * Captures all published events without making actual AWS calls
 */
export class MockCloudWatchLogPublisher {
  private logGroupName: string;
  private logStreamPrefix: string;
  private publishedEvents: CapturedLogEvent[] = [];
  private publishShouldFail: Error | null = null;

  constructor(config: CloudWatchLogPublisherConfig) {
    this.logGroupName = config.logGroupName;
    this.logStreamPrefix = config.logStreamPrefix;
  }

  /**
   * Mock publish method that captures events instead of sending to AWS
   */
  async publish(logEvent: LogEvent): Promise<void> {
    if (this.publishShouldFail) {
      throw this.publishShouldFail;
    }

    this.publishedEvents.push({
      logEvent,
      timestamp: Date.now(),
    });
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

  /**
   * Test helper: Get all published events
   */
  getPublishedEvents(): CapturedLogEvent[] {
    return [...this.publishedEvents];
  }

  /**
   * Test helper: Get the most recently published event
   */
  getLastPublishedEvent(): CapturedLogEvent | undefined {
    return this.publishedEvents[this.publishedEvents.length - 1];
  }

  /**
   * Test helper: Clear all captured events
   */
  clearPublishedEvents(): void {
    this.publishedEvents = [];
  }

  /**
   * Test helper: Make the next publish call fail with the given error
   */
  setPublishError(error: Error): void {
    this.publishShouldFail = error;
  }

  /**
   * Test helper: Clear any configured errors
   */
  clearPublishError(): void {
    this.publishShouldFail = null;
  }

  /**
   * Test helper: Get count of published events
   */
  getPublishedEventCount(): number {
    return this.publishedEvents.length;
  }
}

/**
 * Creates a mock CloudWatchLogPublisher for testing
 */
export function createMockPublisher(
  config: CloudWatchLogPublisherConfig
): MockCloudWatchLogPublisher {
  return new MockCloudWatchLogPublisher(config);
}
