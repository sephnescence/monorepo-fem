# Scryscraper

AWS Lambda function that fetches Magic: The Gathering card data from the Scryfall API and stores it in DynamoDB and S3.

## What This Lambda Does

This Lambda function:

- Runs on a schedule (default: every 1 minute) triggered by EventBridge
- Fetches MTG set and card data from Scryfall API
- Implements 24-hour caching in S3 to respect Scryfall's data usage guidelines
- Stores card data in DynamoDB for efficient querying
- Logs 429 rate limit errors with CloudWatch alarms
- Respects Scryfall's 50-100ms rate limiting requirement

## Architecture

### Components

1. **Lambda Function** - Orchestrates data fetching and storage
2. **S3 Bucket** - Caches Scryfall API responses (24-hour TTL)
3. **DynamoDB Table** - Stores normalised card and set data
4. **CloudWatch Logs** - Execution logs and error tracking
5. **CloudWatch Alarms** - Monitoring for errors, throttles, and rate limits
6. **EventBridge Schedule** - Triggers Lambda execution

### Data Flow

1. Lambda checks S3 cache for recent Scryfall data
2. If cache is fresh (< 24 hours), use cached data
3. If cache is stale or missing, fetch from Scryfall API
4. Store response in S3 for future requests
5. Parse and normalise data
6. Store in DynamoDB for querying

## Prerequisites

- **AWS CLI** configured with credentials (`aws configure`)
- **AWS SAM CLI** installed ([installation guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
- **Node.js 20+** for local development
- **pnpm** for dependency management

## Project Structure

```sh
scryscraper/
├── src/
│   ├── index.ts                    # Lambda handler
│   ├── index.test.ts              # Handler tests
│   ├── services/
│   │   ├── scryfall-scraper.service.ts       # Scryfall API client with caching
│   │   └── scryfall-image-downloader.service.ts  # Image downloader (future)
│   └── schemas/
│       └── set.schema.ts           # Zod validation schemas
├── docs/
│   ├── scryfall-api.md            # Scryfall API documentation
│   └── example-set-response.json  # Example API response
├── dist/                           # Built output (generated)
├── template.yaml                   # AWS SAM infrastructure
├── samconfig.toml                  # SAM deployment configuration
└── README.md                       # This file
```

## How to Build

1. **Install dependencies:**

   ```sh
   pnpm install
   ```

2. **Build the Lambda function:**

   ```sh
   pnpm run build
   ```

3. **Verify the build output:**

   ```sh
   ls -lh dist/
   ```

## How to Deploy

**IMPORTANT**: Always run `pnpm run build` before deploying.

### First-Time Deployment (Guided)

```sh
pnpm run build
sam build
sam deploy --guided
```

You'll be prompted for:

- **Stack Name**: e.g., `scryscraper-dev`
- **AWS Region**: e.g., `ap-southeast-2`
- **Environment**: `dev`, `staging`, `prod`, or `exp`

### Subsequent Deployments

```sh
pnpm run build
sam build
sam deploy
```

## Resources Created

This SAM template creates:

1. **Lambda Function** (`scryscraper-{env}`)
   - Runtime: Node.js 20.x (ARM64)
   - Timeout: 30 seconds
   - Memory: 512 MB

2. **S3 Bucket** (`monorepo-fem-scryscraper-cache-{env}`)
   - Versioning enabled
   - Caches Scryfall API responses

3. **DynamoDB Table** (`monorepo-fem-scryscraper-{env}`)
   - Pay-per-request billing
   - Partition key: `pk`, Sort key: `sk`

4. **CloudWatch Log Group** (`/aws/lambda/scryscraper-{env}`)
   - 7-day retention

5. **CloudWatch Alarms**
   - Lambda errors
   - Lambda throttles
   - Lambda duration (80% of timeout)
   - Scryfall rate limit hits (HTTP 429)

6. **IAM Role** (stack-specific)
   - S3 access (scoped to cache bucket)
   - DynamoDB access (scoped to table)
   - CloudWatch Logs access

## Scryfall API Guidelines

This service respects Scryfall's data usage guidelines:

- **Rate Limiting**: 50-100ms delay between requests
- **Caching**: 24-hour minimum cache duration
- **Attribution**: Retains copyright and artist information
- **User-Agent**: Identifies as `scryscraper/1.0`

See `docs/scryfall-api.md` for detailed API documentation.

## Testing

```sh
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Test Coverage

Enforced coverage targets:
- Statements: 80%+
- Branches: 80%+
- Functions: 80%+
- Lines: 80%+

## Monitoring

### CloudWatch Alarms

Monitor the service via CloudWatch alarms:

1. **scryscraper-errors-{env}** - Lambda execution errors
2. **scryscraper-throttles-{env}** - Lambda throttling
3. **scryscraper-duration-{env}** - Duration approaching timeout
4. **scryscraper-rate-limit-{env}** - Scryfall API rate limiting (HTTP 429)

### Viewing Logs

```sh
# Lambda execution logs
aws logs tail /aws/lambda/scryscraper-dev --follow
```

## Troubleshooting

### 429 Rate Limit Errors

If you see HTTP 429 errors in the logs:

1. Check the rate limit alarm: `scryscraper-rate-limit-{env}`
2. Verify request delays are 50-100ms
3. Consider reducing EventBridge schedule frequency

### Cache Misses

If S3 cache isn't being used:

1. Verify bucket permissions in IAM role
2. Check S3 object LastModified timestamps
3. Ensure cache key generation is idempotent

### DynamoDB Errors

If DynamoDB writes fail:

1. Check IAM permissions for table access
2. Verify table exists: `aws dynamodb describe-table --table-name monorepo-fem-scryscraper-dev`
3. Check for throttling in CloudWatch metrics

## Clean Up

To delete all AWS resources:

```sh
sam delete
```

**Warning**: 
- For `exp` environment: All resources are deleted
- For other environments: S3 bucket, DynamoDB table, and CloudWatch log groups are retained

## Development Workflow

1. Make changes to source code
2. Run tests: `pnpm test`
3. Verify coverage: `pnpm test:coverage`
4. Build: `pnpm run build`
5. Package: `sam build`
6. Deploy: `sam deploy`
7. Monitor: Check CloudWatch alarms and logs

## References

- [Scryfall API Documentation](https://scryfall.com/docs/api)
- [Scryfall Rate Limiting Policy](https://scryfall.com/docs/api#rate-limits-and-good-citizenship)
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
