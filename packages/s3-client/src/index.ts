import { type Readable } from 'stream';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  type S3ClientConfig,
  type GetObjectCommandInput,
  type PutObjectCommandInput,
  type HeadObjectCommandInput,
} from '@aws-sdk/client-s3';

/**
 * Configuration options for S3 Client Wrapper
 */
export interface S3ClientWrapperConfig {
  bucketName: string;
  clientConfig?: S3ClientConfig;
  client?: S3Client;
}

/**
 * Metadata about an S3 object
 */
export interface S3ObjectMetadata {
  key: string;
  lastModified: Date | undefined;
  contentLength: number | undefined;
  contentType: string | undefined;
  metadata: Record<string, string> | undefined;
  eTag: string | undefined;
}

/**
 * Result from getting an S3 object
 */
export interface S3GetResult {
  body: string;
  metadata: S3ObjectMetadata;
}

/**
 * S3 Client Wrapper
 * Provides high-level operations for S3 with helpers for caching use cases
 */
export class S3ClientWrapper {
  private bucketName: string;
  private client: S3Client;

  constructor(config: S3ClientWrapperConfig) {
    this.bucketName = config.bucketName;
    this.client = config.client ?? new S3Client(config.clientConfig ?? {});
  }

  /**
   * Gets the bucket name
   */
  getBucketName(): string {
    return this.bucketName;
  }

  /**
   * Gets the S3 client instance
   */
  getClient(): S3Client {
    return this.client;
  }

  /**
   * Puts an object into S3
   */
  async putObject(
    key: string,
    body: string,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    const params: PutObjectCommandInput = {
      Bucket: this.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    };

    await this.client.send(new PutObjectCommand(params));
  }

  /**
   * Gets an object from S3
   * Returns both the body content and metadata
   */
  async getObject(key: string): Promise<S3GetResult | null> {
    try {
      const params: GetObjectCommandInput = {
        Bucket: this.bucketName,
        Key: key,
      };

      const result = await this.client.send(new GetObjectCommand(params));

      if (!result.Body) {
        return null;
      }

      // Convert stream to string
      const body = await this.streamToString(result.Body as Readable);

      return {
        body,
        metadata: {
          key,
          lastModified: result.LastModified,
          contentLength: result.ContentLength,
          contentType: result.ContentType,
          metadata: result.Metadata,
          eTag: result.ETag,
        },
      };
    } catch (error: unknown) {
      // If object doesn't exist, return null
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'NoSuchKey'
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Gets metadata about an S3 object without downloading the body
   * Useful for checking if an object exists and when it was last modified
   */
  async getObjectMetadata(key: string): Promise<S3ObjectMetadata | null> {
    try {
      const params: HeadObjectCommandInput = {
        Bucket: this.bucketName,
        Key: key,
      };

      const result = await this.client.send(new HeadObjectCommand(params));

      return {
        key,
        lastModified: result.LastModified,
        contentLength: result.ContentLength,
        contentType: result.ContentType,
        metadata: result.Metadata,
        eTag: result.ETag,
      };
    } catch (error: unknown) {
      // If object doesn't exist, return null
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        (error.name === 'NoSuchKey' || error.name === 'NotFound')
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Gets the age of an S3 object in milliseconds
   * Returns null if object doesn't exist
   * The caller determines what age threshold is acceptable
   */
  async getObjectAgeMs(key: string): Promise<number | null> {
    const metadata = await this.getObjectMetadata(key);

    if (!metadata || !metadata.lastModified) {
      return null;
    }

    const now = Date.now();
    const lastModified = metadata.lastModified.getTime();
    return now - lastModified;
  }

  /**
   * Checks if an S3 object exists
   */
  async objectExists(key: string): Promise<boolean> {
    const metadata = await this.getObjectMetadata(key);
    return metadata !== null;
  }

  /**
   * Helper to convert a readable stream to a string
   */
  private async streamToString(stream: Readable): Promise<string> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
  }
}

/**
 * Creates an S3 client wrapper with the provided configuration
 */
export function createS3Client(
  config: S3ClientWrapperConfig
): S3ClientWrapper {
  return new S3ClientWrapper(config);
}

// Export AWS SDK types for convenience
export type { S3ClientConfig };
export { S3Client };
