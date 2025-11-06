# @monorepo-fem/dynamodb-client

Reusable DynamoDB client library supporting both DocumentClient and standard client operations.

## Overview

This package provides a wrapper around AWS SDK's DynamoDB clients, supporting both:
- **DocumentClient** - High-level operations with JavaScript objects
- **Standard DynamoDB Client** - Low-level operations with AttributeValue format

## Installation

```bash
pnpm add @monorepo-fem/dynamodb-client
```

## Usage

### Basic Operations

```typescript
import { createDynamoDBClient } from '@monorepo-fem/dynamodb-client';

// Create client
const client = createDynamoDBClient({
  tableName: 'my-table',
});

// Put an item
await client.putItem({
  id: '123',
  name: 'Test Item',
  createdAt: new Date().toISOString(),
});

// Get an item
const item = await client.getItem({ id: '123' });

// Batch put items (automatically handles 25 item limit)
await client.batchPutItems([
  { id: '1', name: 'Item 1' },
  { id: '2', name: 'Item 2' },
  // ... up to hundreds of items
]);
```

### Advanced Usage - Direct Client Access

```typescript
import { DynamoDBClientWrapper } from '@monorepo-fem/dynamodb-client';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

const wrapper = new DynamoDBClientWrapper({
  tableName: 'my-table',
});

// Access DocumentClient for custom operations
const docClient = wrapper.getDocClient();
const result = await docClient.send(new QueryCommand({
  TableName: 'my-table',
  KeyConditionExpression: 'pk = :pk',
  ExpressionAttributeValues: {
    ':pk': 'USER#123',
  },
}));

// Access standard client for low-level operations
const standardClient = wrapper.getStandardClient();
```

### Testing

Use the mock client for testing without AWS calls:

```typescript
import { createMockDynamoDBClient } from '@monorepo-fem/dynamodb-client/testing';

describe('My Service', () => {
  it('should store data', async () => {
    const mockClient = createMockDynamoDBClient({
      tableName: 'test-table',
    });

    // Configure mock responses
    mockClient.setGetResponse(
      { id: '123' },
      { id: '123', name: 'Mock Item' }
    );

    // Use in your service
    const item = await mockClient.getItem({ id: '123' });

    // Assert on captured operations
    expect(mockClient.getOperationCount()).toBe(1);
    expect(mockClient.getLastOperation()?.operation).toBe('get');
  });
});
```

## API Reference

### DynamoDBClientWrapper

#### Constructor Options

```typescript
interface DynamoDBClientWrapperConfig {
  tableName: string;
  clientConfig?: DynamoDBClientConfig;  // Optional AWS SDK config
  docClient?: DynamoDBDocumentClient;   // Optional pre-configured client
  standardClient?: DynamoDBClient;      // Optional pre-configured client
}
```

#### Methods

- `getTableName(): string` - Get the table name
- `getDocClient(): DynamoDBDocumentClient` - Get DocumentClient instance
- `getStandardClient(): DynamoDBClient` - Get standard client instance
- `putItem<T>(item: T): Promise<void>` - Put an item
- `getItem<T>(key: Record<string, unknown>): Promise<T | null>` - Get an item
- `batchPutItems<T>(items: T[]): Promise<void>` - Batch put items (handles 25 item limit)

### MockDynamoDBClient

Test helper methods:

- `getOperations()` - Get all captured operations
- `getOperationsByType(type)` - Get operations by type
- `getLastOperation()` - Get most recent operation
- `clearOperations()` - Clear captured operations
- `setGetResponse(key, response)` - Configure get response
- `clearGetResponses()` - Clear configured responses
- `setPutError(error)` - Make next put fail
- `setGetError(error)` - Make next get fail
- `setBatchPutError(error)` - Make next batch put fail
- `clearErrors()` - Clear all errors
- `getOperationCount()` - Get operation count

## Design Decisions

- **Both client types** - Supports both DocumentClient and standard client for flexibility
- **Automatic batching** - batchPutItems automatically handles DynamoDB's 25 item limit
- **TypeScript generics** - Maintains type safety for your data models
- **Testable** - Mock client captures operations without AWS calls
- **Minimal abstraction** - Direct client access available for custom operations

## Examples

See the test file (`src/index.test.ts`) for comprehensive usage examples.
