import { DynamoDBDocumentClient, PutCommand, GetCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, it, expect, beforeEach } from 'vitest';
import { DynamoDBClientWrapper, createDynamoDBClient } from './index.js';

describe('DynamoDBClientWrapper', () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    ddbMock.reset();
  });

  describe('constructor and getters', () => {
    it('should initialise with table name', () => {
      const client = new DynamoDBClientWrapper({
        tableName: 'test-table',
      });

      expect(client.getTableName()).toBe('test-table');
    });

    it('should provide access to DocumentClient', () => {
      const client = new DynamoDBClientWrapper({
        tableName: 'test-table',
      });

      expect(client.getDocClient()).toBeDefined();
    });

    it('should provide access to standard client', () => {
      const client = new DynamoDBClientWrapper({
        tableName: 'test-table',
      });

      expect(client.getStandardClient()).toBeDefined();
    });
  });

  describe('putItem', () => {
    it('should put an item into DynamoDB', async () => {
      ddbMock.on(PutCommand).resolves({});

      const client = new DynamoDBClientWrapper({
        tableName: 'test-table',
      });

      const item = {
        id: '123',
        name: 'Test Item',
      };

      await client.putItem(item);

      expect(ddbMock.calls()).toHaveLength(1);
      const call = ddbMock.call(0);
      expect(call.args[0].input).toMatchObject({
        TableName: 'test-table',
        Item: item,
      });
    });
  });

  describe('getItem', () => {
    it('should get an item from DynamoDB', async () => {
      const mockItem = {
        id: '123',
        name: 'Test Item',
      };

      ddbMock.on(GetCommand).resolves({
        Item: mockItem,
      });

      const client = new DynamoDBClientWrapper({
        tableName: 'test-table',
      });

      const result = await client.getItem({ id: '123' });

      expect(result).toEqual(mockItem);
      expect(ddbMock.calls()).toHaveLength(1);
      const call = ddbMock.call(0);
      expect(call.args[0].input).toMatchObject({
        TableName: 'test-table',
        Key: { id: '123' },
      });
    });

    it('should return null when item not found', async () => {
      ddbMock.on(GetCommand).resolves({});

      const client = new DynamoDBClientWrapper({
        tableName: 'test-table',
      });

      const result = await client.getItem({ id: 'non-existent' });

      expect(result).toBeNull();
    });
  });

  describe('batchPutItems', () => {
    it('should batch write items to DynamoDB', async () => {
      ddbMock.on(BatchWriteCommand).resolves({});

      const client = new DynamoDBClientWrapper({
        tableName: 'test-table',
      });

      const items = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
        { id: '3', name: 'Item 3' },
      ];

      await client.batchPutItems(items);

      expect(ddbMock.calls()).toHaveLength(1);
      const call = ddbMock.call(0);
      expect(call.args[0].input.RequestItems?.['test-table']).toHaveLength(3);
    });

    it('should handle batches larger than 25 items', async () => {
      ddbMock.on(BatchWriteCommand).resolves({});

      const client = new DynamoDBClientWrapper({
        tableName: 'test-table',
      });

      // Create 30 items to test batching
      const items = Array.from({ length: 30 }, (_, i) => ({
        id: `${i}`,
        name: `Item ${i}`,
      }));

      await client.batchPutItems(items);

      // Should make 2 calls: one for 25 items, one for 5 items
      expect(ddbMock.calls()).toHaveLength(2);
      const call1 = ddbMock.call(0);
      const call2 = ddbMock.call(1);
      expect(call1.args[0].input.RequestItems?.['test-table']).toHaveLength(25);
      expect(call2.args[0].input.RequestItems?.['test-table']).toHaveLength(5);
    });
  });

  describe('createDynamoDBClient factory', () => {
    it('should create a client instance', () => {
      const client = createDynamoDBClient({
        tableName: 'test-table',
      });

      expect(client).toBeInstanceOf(DynamoDBClientWrapper);
      expect(client.getTableName()).toBe('test-table');
    });
  });
});
