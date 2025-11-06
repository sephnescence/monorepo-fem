import type { ScheduledEvent } from 'aws-lambda'
import { createScryscraperService } from './services/scryfall-scraper.service.js'

/**
 * Environment variables required for the Lambda function
 */
interface EnvironmentVariables {
  SCRYSCRAPER_CACHE_BUCKET: string
  SCRYFALL_SET_CODE: string
}

/**
 * Validates that all required environment variables are present
 *
 * @throws {Error} If any required environment variable is missing
 * @returns {EnvironmentVariables} Validated environment variables
 */
function validateEnvironment(): EnvironmentVariables {
  const { SCRYSCRAPER_CACHE_BUCKET, SCRYFALL_SET_CODE } = process.env

  if (!SCRYSCRAPER_CACHE_BUCKET) {
    throw new Error('Missing required environment variable: SCRYSCRAPER_CACHE_BUCKET')
  }

  if (!SCRYFALL_SET_CODE) {
    throw new Error('Missing required environment variable: SCRYFALL_SET_CODE')
  }

  return {
    SCRYSCRAPER_CACHE_BUCKET,
    SCRYFALL_SET_CODE,
  }
}

/**
 * Lambda handler function
 * Triggered by EventBridge on a schedule to scrape Scryfall API data
 *
 * @param event - The EventBridge scheduled event
 */
export async function handler(event: ScheduledEvent): Promise<void> {
  console.log('Lambda invoked by EventBridge scheduled event')
  console.log('Event:', JSON.stringify(event, null, 2))

  try {
    // Validate environment variables
    const env = validateEnvironment()
    console.log(`S3 cache bucket: ${env.SCRYSCRAPER_CACHE_BUCKET}`)
    console.log(`Scraping set: ${env.SCRYFALL_SET_CODE}`)

    // Create Scryfall scraper service with S3 caching
    const scraper = createScryscraperService({
      s3BucketName: env.SCRYSCRAPER_CACHE_BUCKET,
      userAgent: 'scryscraper/1.0',
    })

    // Fetch set data with 24-hour caching
    const result = await scraper.getSet(env.SCRYFALL_SET_CODE)

    console.log(`Cache status: ${result.fromCache ? 'HIT' : 'MISS'}`)
    if (result.fromCache && result.cacheAge !== undefined) {
      const ageMinutes = Math.round(result.cacheAge / 1000 / 60)
      console.log(`Cache age: ${ageMinutes} minutes`)
    }

    console.log(
      `Successfully fetched set: ${result.data.name} (${result.data.code})`
    )
    console.log(`Card count: ${result.data.card_count}`)
    console.log(`Released: ${result.data.released_at}`)
    console.log(`Set type: ${result.data.set_type}`)

    console.log('Handler completed successfully')
  } catch (error: unknown) {
    console.error('Error in Lambda handler:', error)
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    throw error
  }
}
