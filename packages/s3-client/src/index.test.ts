import { Readable } from 'stream';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, it, expect, beforeEach } from 'vitest';
import { S3ClientWrapper, createS3Client } from './index.js';

describe('S3ClientWrapper', () => {
  const s3Mock = mockClient(S3Client);

  beforeEach(() => {
    s3Mock.reset();
  });

  describe('constructor and getters', () => {
    it('should initialise with bucket name', () => {
      const client = new S3ClientWrapper({
        bucketName: 'test-bucket',
      });

      expect(client.getBucketName()).toBe('test-bucket');
    });

    it('should provide access to S3 client', () => {
      const client = new S3ClientWrapper({
        bucketName: 'test-bucket',
      });

      expect(client.getClient()).toBeDefined();
    });
  });

  describe('putObject', () => {
    it('should put an object into S3', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const client = new S3ClientWrapper({
        bucketName: 'test-bucket',
      });

      await client.putObject('test-key', 'test-body', 'application/json');

      expect(s3Mock.calls()).toHaveLength(1);
      const call = s3Mock.call(0);
      expect(call.args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'test-key',
        Body: 'test-body',
        ContentType: 'application/json',
      });
    });

    it('should put an object with metadata', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const client = new S3ClientWrapper({
        bucketName: 'test-bucket',
      });

      await client.putObject(
        'test-key',
        'test-body',
        'application/json',
        { customMeta: 'value' }
      );

      const call = s3Mock.call(0);
      expect(call.args[0].input).toMatchObject({
        Metadata: { customMeta: 'value' },
      });
    });
  });

  describe('getObject', () => {
    it('should get an object from S3', async () => {
      const mockBody = Readable.from([Buffer.from('test-body')]);
      const mockDate = new Date('2025-01-01');

      s3Mock.on(GetObjectCommand).resolves({
        Body: mockBody,
        LastModified: mockDate,
        ContentLength: 9,
        ContentType: 'application/json',
        Metadata: { custom: 'value' },
        ETag: '"abc123"',
      });

      const client = new S3ClientWrapper({
        bucketName: 'test-bucket',
      });

      const result = await client.getObject('test-key');

      expect(result).toBeDefined();
      expect(result?.body).toBe('test-body');
      expect(result?.metadata.key).toBe('test-key');
      expect(result?.metadata.lastModified).toEqual(mockDate);
      expect(result?.metadata.contentType).toBe('application/json');
    });

    it('should return null when object does not exist', async () => {
      s3Mock.on(GetObjectCommand).rejects({
        name: 'NoSuchKey',
        message: 'The specified key does not exist.',
      });

      const client = new S3ClientWrapper({
        bucketName: 'test-bucket',
      });

      const result = await client.getObject('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getObjectMetadata', () => {
    it('should get object metadata without downloading body', async () => {
      const mockDate = new Date('2025-01-01');

      s3Mock.on(HeadObjectCommand).resolves({
        LastModified: mockDate,
        ContentLength: 100,
        ContentType: 'application/json',
        Metadata: { custom: 'value' },
        ETag: '"abc123"',
      });

      const client = new S3ClientWrapper({
        bucketName: 'test-bucket',
      });

      const result = await client.getObjectMetadata('test-key');

      expect(result).toBeDefined();
      expect(result?.key).toBe('test-key');
      expect(result?.lastModified).toEqual(mockDate);
      expect(result?.contentLength).toBe(100);
      expect(result?.contentType).toBe('application/json');
    });

    it('should return null when object does not exist', async () => {
      s3Mock.on(HeadObjectCommand).rejects({
        name: 'NotFound',
        message: 'Not Found',
      });

      const client = new S3ClientWrapper({
        bucketName: 'test-bucket',
      });

      const result = await client.getObjectMetadata('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getObjectAgeMs', () => {
    it('should calculate object age in milliseconds', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      s3Mock.on(HeadObjectCommand).resolves({
        LastModified: oneHourAgo,
      });

      const client = new S3ClientWrapper({
        bucketName: 'test-bucket',
      });

      const age = await client.getObjectAgeMs('test-key');

      expect(age).toBeDefined();
      expect(age).toBeGreaterThan(60 * 60 * 1000 - 1000); // ~1 hour (with 1s tolerance)
      expect(age).toBeLessThan(60 * 60 * 1000 + 1000);
    });

    it('should return null when object does not exist', async () => {
      s3Mock.on(HeadObjectCommand).rejects({
        name: 'NotFound',
        message: 'Not Found',
      });

      const client = new S3ClientWrapper({
        bucketName: 'test-bucket',
      });

      const age = await client.getObjectAgeMs('non-existent');

      expect(age).toBeNull();
    });
  });

  describe('objectExists', () => {
    it('should return true when object exists', async () => {
      s3Mock.on(HeadObjectCommand).resolves({
        LastModified: new Date(),
      });

      const client = new S3ClientWrapper({
        bucketName: 'test-bucket',
      });

      const exists = await client.objectExists('test-key');

      expect(exists).toBe(true);
    });

    it('should return false when object does not exist', async () => {
      s3Mock.on(HeadObjectCommand).rejects({
        name: 'NotFound',
        message: 'Not Found',
      });

      const client = new S3ClientWrapper({
        bucketName: 'test-bucket',
      });

      const exists = await client.objectExists('non-existent');

      expect(exists).toBe(false);
    });
  });

  describe('createS3Client factory', () => {
    it('should create a client instance', () => {
      const client = createS3Client({
        bucketName: 'test-bucket',
      });

      expect(client).toBeInstanceOf(S3ClientWrapper);
      expect(client.getBucketName()).toBe('test-bucket');
    });
  });
});
