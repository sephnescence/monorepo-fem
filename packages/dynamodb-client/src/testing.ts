/**
 * Testing utilities for dynamodb-client
 * Provides mocks and test helpers for packages that depend on this library
 */

import type { DynamoDBClientWrapperConfig } from './index.js';

/**
 * A captured DynamoDB operation from the mock client
 */
export interface CapturedOperation {
  operation: 'put' | 'get' | 'batchPut';
  params: unknown;
  timestamp: number;
}

/**
 * Mock implementation of DynamoDBClientWrapper for testing
 * Captures all operations without making actual AWS calls
 */
export class MockDynamoDBClient {
  private tableName: string;
  private operations: CapturedOperation[] = [];
  private getResponses: Map<string, Record<string, unknown> | null> =
    new Map();
  private putShouldFail: Error | null = null;
  private getShouldFail: Error | null = null;
  private batchPutShouldFail: Error | null = null;

  constructor(config: DynamoDBClientWrapperConfig) {
    this.tableName = config.tableName;
  }

  /**
   * Gets the table name
   */
  getTableName(): string {
    return this.tableName;
  }

  /**
   * Mock getDocClient - returns undefined as tests shouldn't need raw client access
   */
  getDocClient(): undefined {
    return undefined;
  }

  /**
   * Mock getStandardClient - returns undefined as tests shouldn't need raw client access
   */
  getStandardClient(): undefined {
    return undefined;
  }

  /**
   * Mock putItem that captures the operation
   */
  async putItem<T extends Record<string, unknown>>(item: T): Promise<void> {
    if (this.putShouldFail) {
      throw this.putShouldFail;
    }

    this.operations.push({
      operation: 'put',
      params: { item },
      timestamp: Date.now(),
    });
  }

  /**
   * Mock getItem that returns pre-configured responses
   */
  async getItem<T extends Record<string, unknown>>(
    key: Record<string, unknown>
  ): Promise<T | null> {
    if (this.getShouldFail) {
      throw this.getShouldFail;
    }

    this.operations.push({
      operation: 'get',
      params: { key },
      timestamp: Date.now(),
    });

    const keyString = JSON.stringify(key);
    const response = this.getResponses.get(keyString);
    return (response as T) ?? null;
  }

  /**
   * Mock batchPutItems that captures the operation
   */
  async batchPutItems<T extends Record<string, unknown>>(
    items: T[]
  ): Promise<void> {
    if (this.batchPutShouldFail) {
      throw this.batchPutShouldFail;
    }

    this.operations.push({
      operation: 'batchPut',
      params: { items, count: items.length },
      timestamp: Date.now(),
    });
  }

  /**
   * Test helper: Get all captured operations
   */
  getOperations(): CapturedOperation[] {
    return [...this.operations];
  }

  /**
   * Test helper: Get operations of a specific type
   */
  getOperationsByType(
    type: 'put' | 'get' | 'batchPut'
  ): CapturedOperation[] {
    return this.operations.filter((op) => op.operation === type);
  }

  /**
   * Test helper: Get the most recent operation
   */
  getLastOperation(): CapturedOperation | undefined {
    return this.operations[this.operations.length - 1];
  }

  /**
   * Test helper: Clear all captured operations
   */
  clearOperations(): void {
    this.operations = [];
  }

  /**
   * Test helper: Set the response for a get operation
   */
  setGetResponse<T extends Record<string, unknown>>(
    key: Record<string, unknown>,
    response: T | null
  ): void {
    const keyString = JSON.stringify(key);
    this.getResponses.set(keyString, response);
  }

  /**
   * Test helper: Clear all configured get responses
   */
  clearGetResponses(): void {
    this.getResponses.clear();
  }

  /**
   * Test helper: Make the next putItem call fail with the given error
   */
  setPutError(error: Error): void {
    this.putShouldFail = error;
  }

  /**
   * Test helper: Make the next getItem call fail with the given error
   */
  setGetError(error: Error): void {
    this.getShouldFail = error;
  }

  /**
   * Test helper: Make the next batchPutItems call fail with the given error
   */
  setBatchPutError(error: Error): void {
    this.batchPutShouldFail = error;
  }

  /**
   * Test helper: Clear all configured errors
   */
  clearErrors(): void {
    this.putShouldFail = null;
    this.getShouldFail = null;
    this.batchPutShouldFail = null;
  }

  /**
   * Test helper: Get count of all operations
   */
  getOperationCount(): number {
    return this.operations.length;
  }
}

/**
 * Creates a mock DynamoDB client for testing
 */
export function createMockDynamoDBClient(
  config: DynamoDBClientWrapperConfig
): MockDynamoDBClient {
  return new MockDynamoDBClient(config);
}
