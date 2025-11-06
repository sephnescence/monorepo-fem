import {
  DynamoDBClient,
  type DynamoDBClientConfig,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  BatchWriteCommand,
  type PutCommandInput,
  type GetCommandInput,
  type BatchWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';

/**
 * Configuration options for DynamoDB Client
 */
export interface DynamoDBClientWrapperConfig {
  tableName: string;
  clientConfig?: DynamoDBClientConfig;
  docClient?: DynamoDBDocumentClient;
  standardClient?: DynamoDBClient;
}

/**
 * DynamoDB Client Wrapper
 * Provides access to both DocumentClient (for high-level operations)
 * and standard DynamoDB client (for low-level operations)
 */
export class DynamoDBClientWrapper {
  private tableName: string;
  private docClient: DynamoDBDocumentClient;
  private standardClient: DynamoDBClient;

  constructor(config: DynamoDBClientWrapperConfig) {
    this.tableName = config.tableName;
    this.standardClient =
      config.standardClient ?? new DynamoDBClient(config.clientConfig ?? {});
    this.docClient =
      config.docClient ?? DynamoDBDocumentClient.from(this.standardClient);
  }

  /**
   * Gets the table name
   */
  getTableName(): string {
    return this.tableName;
  }

  /**
   * Gets the DocumentClient for high-level operations
   */
  getDocClient(): DynamoDBDocumentClient {
    return this.docClient;
  }

  /**
   * Gets the standard client for low-level operations
   */
  getStandardClient(): DynamoDBClient {
    return this.standardClient;
  }

  /**
   * Puts an item into DynamoDB using DocumentClient
   */
  async putItem<T extends Record<string, unknown>>(item: T): Promise<void> {
    const params: PutCommandInput = {
      TableName: this.tableName,
      Item: item,
    };

    await this.docClient.send(new PutCommand(params));
  }

  /**
   * Gets an item from DynamoDB using DocumentClient
   */
  async getItem<T extends Record<string, unknown>>(
    key: Record<string, unknown>
  ): Promise<T | null> {
    const params: GetCommandInput = {
      TableName: this.tableName,
      Key: key,
    };

    const result = await this.docClient.send(new GetCommand(params));
    return (result.Item as T) ?? null;
  }

  /**
   * Batch writes items to DynamoDB
   * Automatically handles DynamoDB's 25 item batch limit
   */
  async batchPutItems<T extends Record<string, unknown>>(
    items: T[]
  ): Promise<void> {
    const batchSize = 25;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const params: BatchWriteCommandInput = {
        RequestItems: {
          [this.tableName]: batch.map((item) => ({
            PutRequest: {
              Item: item,
            },
          })),
        },
      };

      await this.docClient.send(new BatchWriteCommand(params));
    }
  }
}

/**
 * Creates a DynamoDB client wrapper with the provided configuration
 */
export function createDynamoDBClient(
  config: DynamoDBClientWrapperConfig
): DynamoDBClientWrapper {
  return new DynamoDBClientWrapper(config);
}

// Export AWS SDK types for convenience
export type { DynamoDBClientConfig };
export { DynamoDBClient, DynamoDBDocumentClient };
