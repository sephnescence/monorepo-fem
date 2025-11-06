# @monorepo-fem/s3-client

Reusable S3 client library with caching helpers.

## Overview

This package provides a wrapper around AWS SDK's S3 client with utilities designed for caching use cases. It provides helpers to check object age without prescribing what age threshold is acceptable - that decision remains with the caller.

## Installation

```bash
pnpm add @monorepo-fem/s3-client
```

## Usage

### Basic Operations

```typescript
import { createS3Client } from '@monorepo-fem/s3-client';

// Create client
const client = createS3Client({
  bucketName: 'my-cache-bucket',
});

// Put an object
await client.putObject(
  'cache-key',
  JSON.stringify({ data: 'value' }),
  'application/json'
);

// Get an object (returns body and metadata)
const result = await client.getObject('cache-key');
if (result) {
  console.log(result.body);
  console.log(result.metadata.lastModified);
}

// Check if object exists
const exists = await client.objectExists('cache-key');
```

### Caching Pattern

```typescript
import { createS3Client } from '@monorepo-fem/s3-client';

const s3 = createS3Client({ bucketName: 'cache-bucket' });
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

async function getCachedData(cacheKey: string): Promise<string | null> {
  // Check object age (library provides age, you decide threshold)
  const ageMs = await s3.getObjectAgeMs(cacheKey);
  
  if (ageMs !== null && ageMs < TWENTY_FOUR_HOURS_MS) {
    // Cache hit - object exists and is fresh
    const result = await s3.getObject(cacheKey);
    return result?.body ?? null;
  }
  
  // Cache miss or stale - fetch fresh data
  const freshData = await fetchFromAPI();
  
  // Store in cache
  await s3.putObject(cacheKey, freshData, 'application/json');
  
  return freshData;
}
```

### Metadata Only (Efficient for Existence Checks)

```typescript
// Get metadata without downloading the body
const metadata = await client.getObjectMetadata('my-key');
if (metadata) {
  console.log('Last modified:', metadata.lastModified);
  console.log('Content length:', metadata.contentLength);
  console.log('Content type:', metadata.contentType);
}
```

### Custom Metadata

```typescript
// Store custom metadata with objects
await client.putObject(
  'my-key',
  'my-data',
  'text/plain',
  {
    sourceUrl: 'https://api.example.com/data',
    version: '1.0',
  }
);

// Retrieve metadata
const result = await client.getObject('my-key');
console.log(result?.metadata.metadata?.sourceUrl);
```

### Testing

Use the mock client for testing without AWS calls:

```typescript
import { createMockS3Client } from '@monorepo-fem/s3-client/testing';

describe('My Cache Service', () => {
  it('should cache data', async () => {
    const mockS3 = createMockS3Client({
      bucketName: 'test-bucket',
    });

    // Pre-populate mock storage
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockS3.setObject('old-key', 'old-data', oneDayAgo);

    // Check age
    const age = await mockS3.getObjectAgeMs('old-key');
    expect(age).toBeGreaterThan(24 * 60 * 60 * 1000 - 1000);

    // Assert on operations
    expect(mockS3.getOperationCount()).toBe(1);
    expect(mockS3.getLastOperation()?.operation).toBe('getAge');
  });
});
```

## API Reference

### S3ClientWrapper

#### Constructor Options

```typescript
interface S3ClientWrapperConfig {
  bucketName: string;
  clientConfig?: S3ClientConfig;  // Optional AWS SDK config
  client?: S3Client;              // Optional pre-configured client
}
```

#### Methods

- `getBucketName(): string` - Get the bucket name
- `getClient(): S3Client` - Get S3 client instance
- `putObject(key, body, contentType?, metadata?): Promise<void>` - Put an object
- `getObject(key): Promise<S3GetResult | null>` - Get an object with metadata
- `getObjectMetadata(key): Promise<S3ObjectMetadata | null>` - Get metadata only
- `getObjectAgeMs(key): Promise<number | null>` - Get object age in milliseconds
- `objectExists(key): Promise<boolean>` - Check if object exists

#### Return Types

```typescript
interface S3GetResult {
  body: string;
  metadata: S3ObjectMetadata;
}

interface S3ObjectMetadata {
  key: string;
  lastModified: Date | undefined;
  contentLength: number | undefined;
  contentType: string | undefined;
  metadata: Record<string, string> | undefined;
  eTag: string | undefined;
}
```

### MockS3Client

Test helper methods:

- `getOperations()` - Get all captured operations
- `getOperationsByType(type)` - Get operations by type
- `getLastOperation()` - Get most recent operation
- `clearOperations()` - Clear captured operations
- `clearObjects()` - Clear stored objects
- `setObject(key, body, lastModified, contentType?, metadata?)` - Set object with specific date
- `getStoredKeys()` - Get all stored object keys
- `setPutError(error)` - Make next put fail
- `setGetError(error)` - Make next get fail
- `setGetMetadataError(error)` - Make next getMetadata fail
- `clearErrors()` - Clear all errors
- `getOperationCount()` - Get operation count

## Design Decisions

- **Age without logic** - `getObjectAgeMs()` returns the age; you decide what threshold is acceptable
- **Efficient metadata access** - `getObjectMetadata()` uses HEAD request to avoid downloading bodies
- **Null for not found** - Returns null instead of throwing for missing objects
- **String bodies** - Focuses on JSON/text use cases (converts streams to strings)
- **Testable** - Mock client provides in-memory storage for testing
- **Direct client access** - `getClient()` available for custom operations

## Examples

See the test file (`src/index.test.ts`) for comprehensive usage examples.
