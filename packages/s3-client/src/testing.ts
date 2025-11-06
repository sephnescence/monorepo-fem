/**
 * Testing utilities for s3-client
 * Provides mocks and test helpers for packages that depend on this library
 */

import type {
  S3ClientWrapperConfig,
  S3ObjectMetadata,
  S3GetResult,
} from './index.js';

/**
 * A captured S3 operation from the mock client
 */
export interface CapturedS3Operation {
  operation: 'put' | 'get' | 'getMetadata' | 'getAge' | 'exists';
  key: string;
  params?: unknown;
  timestamp: number;
}

/**
 * Stored object in the mock S3 client
 */
interface StoredObject {
  body: string;
  contentType?: string;
  metadata?: Record<string, string>;
  lastModified: Date;
}

/**
 * Mock implementation of S3ClientWrapper for testing
 * Captures all operations and provides in-memory storage
 */
export class MockS3Client {
  private bucketName: string;
  private operations: CapturedS3Operation[] = [];
  private objects: Map<string, StoredObject> = new Map();
  private putShouldFail: Error | null = null;
  private getShouldFail: Error | null = null;
  private getMetadataShouldFail: Error | null = null;

  constructor(config: S3ClientWrapperConfig) {
    this.bucketName = config.bucketName;
  }

  /**
   * Gets the bucket name
   */
  getBucketName(): string {
    return this.bucketName;
  }

  /**
   * Mock getClient - returns undefined as tests shouldn't need raw client access
   */
  getClient(): undefined {
    return undefined;
  }

  /**
   * Mock putObject that stores objects in memory
   */
  async putObject(
    key: string,
    body: string,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    if (this.putShouldFail) {
      throw this.putShouldFail;
    }

    this.operations.push({
      operation: 'put',
      key,
      params: { body, contentType, metadata },
      timestamp: Date.now(),
    });

    this.objects.set(key, {
      body,
      contentType,
      metadata,
      lastModified: new Date(),
    });
  }

  /**
   * Mock getObject that retrieves objects from memory
   */
  async getObject(key: string): Promise<S3GetResult | null> {
    if (this.getShouldFail) {
      throw this.getShouldFail;
    }

    this.operations.push({
      operation: 'get',
      key,
      timestamp: Date.now(),
    });

    const stored = this.objects.get(key);
    if (!stored) {
      return null;
    }

    return {
      body: stored.body,
      metadata: {
        key,
        lastModified: stored.lastModified,
        contentLength: stored.body.length,
        contentType: stored.contentType,
        metadata: stored.metadata,
        eTag: `"${key}-etag"`,
      },
    };
  }

  /**
   * Mock getObjectMetadata that retrieves metadata from memory
   */
  async getObjectMetadata(key: string): Promise<S3ObjectMetadata | null> {
    if (this.getMetadataShouldFail) {
      throw this.getMetadataShouldFail;
    }

    this.operations.push({
      operation: 'getMetadata',
      key,
      timestamp: Date.now(),
    });

    const stored = this.objects.get(key);
    if (!stored) {
      return null;
    }

    return {
      key,
      lastModified: stored.lastModified,
      contentLength: stored.body.length,
      contentType: stored.contentType,
      metadata: stored.metadata,
      eTag: `"${key}-etag"`,
    };
  }

  /**
   * Mock getObjectAgeMs
   */
  async getObjectAgeMs(key: string): Promise<number | null> {
    this.operations.push({
      operation: 'getAge',
      key,
      timestamp: Date.now(),
    });

    const metadata = await this.getObjectMetadata(key);
    if (!metadata || !metadata.lastModified) {
      return null;
    }

    const now = Date.now();
    const lastModified = metadata.lastModified.getTime();
    return now - lastModified;
  }

  /**
   * Mock objectExists
   */
  async objectExists(key: string): Promise<boolean> {
    this.operations.push({
      operation: 'exists',
      key,
      timestamp: Date.now(),
    });

    return this.objects.has(key);
  }

  /**
   * Test helper: Get all captured operations
   */
  getOperations(): CapturedS3Operation[] {
    return [...this.operations];
  }

  /**
   * Test helper: Get operations of a specific type
   */
  getOperationsByType(
    type: 'put' | 'get' | 'getMetadata' | 'getAge' | 'exists'
  ): CapturedS3Operation[] {
    return this.operations.filter((op) => op.operation === type);
  }

  /**
   * Test helper: Get the most recent operation
   */
  getLastOperation(): CapturedS3Operation | undefined {
    return this.operations[this.operations.length - 1];
  }

  /**
   * Test helper: Clear all captured operations
   */
  clearOperations(): void {
    this.operations = [];
  }

  /**
   * Test helper: Clear all stored objects
   */
  clearObjects(): void {
    this.objects.clear();
  }

  /**
   * Test helper: Set an object with a specific last modified date
   */
  setObject(
    key: string,
    body: string,
    lastModified: Date,
    contentType?: string,
    metadata?: Record<string, string>
  ): void {
    this.objects.set(key, {
      body,
      contentType,
      metadata,
      lastModified,
    });
  }

  /**
   * Test helper: Get all stored object keys
   */
  getStoredKeys(): string[] {
    return Array.from(this.objects.keys());
  }

  /**
   * Test helper: Make the next putObject call fail with the given error
   */
  setPutError(error: Error): void {
    this.putShouldFail = error;
  }

  /**
   * Test helper: Make the next getObject call fail with the given error
   */
  setGetError(error: Error): void {
    this.getShouldFail = error;
  }

  /**
   * Test helper: Make the next getObjectMetadata call fail with the given error
   */
  setGetMetadataError(error: Error): void {
    this.getMetadataShouldFail = error;
  }

  /**
   * Test helper: Clear all configured errors
   */
  clearErrors(): void {
    this.putShouldFail = null;
    this.getShouldFail = null;
    this.getMetadataShouldFail = null;
  }

  /**
   * Test helper: Get count of all operations
   */
  getOperationCount(): number {
    return this.operations.length;
  }
}

/**
 * Creates a mock S3 client for testing
 */
export function createMockS3Client(
  config: S3ClientWrapperConfig
): MockS3Client {
  return new MockS3Client(config);
}
