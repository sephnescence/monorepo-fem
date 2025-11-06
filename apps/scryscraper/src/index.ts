import { CloudWatchLogPublisher } from '@monorepo-fem/cloudwatch-log-publisher'
import type { ScheduledEvent } from 'aws-lambda'
import {
  safeValidateSetResponse,
  type ScryfallSet,
} from './schemas/set.schema.js'

/**
 * Environment variables required for the Lambda function
 */
interface EnvironmentVariables {
  LOG_GROUP_NAME: string
  LOG_STREAM_PREFIX: string
  SCRYFALL_SET_CODE: string
}

/**
 * Validates that all required environment variables are present
 *
 * @throws {Error} If any required environment variable is missing
 * @returns {EnvironmentVariables} Validated environment variables
 */
function validateEnvironment(): EnvironmentVariables {
  const { LOG_GROUP_NAME, LOG_STREAM_PREFIX, SCRYFALL_SET_CODE } = process.env

  if (!LOG_GROUP_NAME) {
    throw new Error('Missing required environment variable: LOG_GROUP_NAME')
  }

  if (!LOG_STREAM_PREFIX) {
    throw new Error('Missing required environment variable: LOG_STREAM_PREFIX')
  }

  if (!SCRYFALL_SET_CODE) {
    throw new Error('Missing required environment variable: SCRYFALL_SET_CODE')
  }

  return {
    LOG_GROUP_NAME,
    LOG_STREAM_PREFIX,
    SCRYFALL_SET_CODE,
  }
}

/**
 * Fetches set data from the Scryfall API
 *
 * @param setCode - The Scryfall set code (e.g., "tla")
 * @returns {Promise<ScryfallSet>} The validated set data
 * @throws {Error} If the API request fails or validation fails
 */
async function fetchSetData(setCode: string): Promise<ScryfallSet> {
  const url = `https://api.scryfall.com/sets/${setCode}`

  console.log(`Fetching set data from: ${url}`)

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'scryscraper/1.0',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(
      `Scryfall API request failed: ${response.status} ${response.statusText}`
    )
  }

  const data = await response.json()

  // Validate the response using Zod schema
  const validationResult = safeValidateSetResponse(data)

  if (!validationResult.success) {
    console.error('Schema validation failed:', validationResult.error.format())
    throw new Error(
      `Invalid API response schema: ${validationResult.error.message}`
    )
  }

  console.log(
    `Successfully fetched and validated set: ${validationResult.data.name}`
  )
  console.log(`Card count: ${validationResult.data.card_count}`)
  console.log(`Released: ${validationResult.data.released_at}`)

  return validationResult.data
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
    console.log(`Target log group: ${env.LOG_GROUP_NAME}`)
    console.log(`Scraping set: ${env.SCRYFALL_SET_CODE}`)

    // Fetch and validate set data from Scryfall API
    const setData = await fetchSetData(env.SCRYFALL_SET_CODE)

    // Create CloudWatch log publisher
    const publisher = new CloudWatchLogPublisher({
      logGroupName: env.LOG_GROUP_NAME,
      logStreamPrefix: env.LOG_STREAM_PREFIX,
    })

    // Publish the set data to CloudWatch
    await publisher.publish({
      message: 'Scryfall set data fetched successfully',
      timestamp: new Date().toISOString(),
      source: 'scryscraper',
      type: 'scryfall_set',
      setCode: setData.code,
      setName: setData.name,
      cardCount: setData.card_count,
      releasedAt: setData.released_at,
      setType: setData.set_type,
    })

    console.log('Handler completed successfully')
  } catch (error) {
    console.error('Error in Lambda handler:', error)
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    throw error
  }
}
