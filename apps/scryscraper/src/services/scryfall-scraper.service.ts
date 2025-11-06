/**
 * Scryfall Scraper Service
 *
 * Fetches MTG set data from Scryfall API with 24-hour S3 caching.
 * Respects Scryfall's rate limiting and data usage guidelines.
 */

import { createHash } from 'crypto'
import { createS3Client, type S3ClientWrapper } from '@monorepo-fem/s3-client'
import axios, { type AxiosInstance } from 'axios'
import { ScryfallSetSchema, type ScryfallSet } from '../schemas/set.schema.js'

/**
 * Configuration for Scryfall Scraper Service
 */
export interface ScryScraperConfig {
  s3BucketName: string
  userAgent?: string
  s3Client?: S3ClientWrapper
  axiosInstance?: AxiosInstance
}

/**
 * Result of fetching set data (includes cache status)
 */
export interface ScryScraperResult {
  data: ScryfallSet
  fromCache: boolean
  cacheAge?: number
}

/**
 * Cache duration in milliseconds (24 hours)
 */
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

/**
 * Scryfall Scraper Service
 *
 * Fetches MTG set data from Scryfall API with intelligent caching.
 * Implements 24-hour caching as per Scryfall's data usage guidelines.
 */
export class ScryScraperService {
  private s3Client: S3ClientWrapper
  private axios: AxiosInstance
  private userAgent: string

  constructor(config: ScryScraperConfig) {
    this.s3Client =
      config.s3Client ?? createS3Client({ bucketName: config.s3BucketName })
    this.userAgent = config.userAgent ?? 'scryscraper/1.0'
    this.axios = config.axiosInstance ?? this.createAxiosInstance()
  }

  /**
   * Creates a configured axios instance for Scryfall API requests
   */
  private createAxiosInstance(): AxiosInstance {
    return axios.create({
      baseURL: 'https://api.scryfall.com',
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/json',
      },
      timeout: 10000,
    })
  }

  /**
   * Generates an idempotent cache key for a Scryfall API URL
   * Uses SHA256 hash of the normalised URL to ensure consistent keys
   */
  private generateCacheKey(url: string): string {
    const normalisedUrl = url.toLowerCase().trim()
    const hash = createHash('sha256').update(normalisedUrl).digest('hex')
    return 'scryfall-cache/' + hash + '.json'
  }

  /**
   * Fetches set data from S3 cache if fresh (< 24 hours old)
   */
  private async getCachedSet(
    cacheKey: string
  ): Promise<{ data: ScryfallSet; ageMs: number } | null> {
    try {
      const ageMs = await this.s3Client.getObjectAgeMs(cacheKey)

      if (ageMs === null || ageMs >= TWENTY_FOUR_HOURS_MS) {
        return null // Cache miss or stale
      }

      const result = await this.s3Client.getObject(cacheKey)
      if (!result) {
        return null
      }

      const parsed = JSON.parse(result.body) as unknown
      const validation = ScryfallSetSchema.safeParse(parsed)

      if (!validation.success) {
        console.warn('Cached data failed validation, ignoring cache:', {
          cacheKey,
          errors: validation.error.errors,
        })
        return null
      }

      return { data: validation.data, ageMs }
    } catch (error: unknown) {
      console.warn('Error reading from S3 cache, proceeding to API fetch:', {
        cacheKey,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Stores set data in S3 cache
   */
  private async cacheSet(cacheKey: string, data: ScryfallSet): Promise<void> {
    try {
      await this.s3Client.putObject(
        cacheKey,
        JSON.stringify(data, null, 2),
        'application/json',
        {
          sourceUrl: 'https://api.scryfall.com/sets/' + data.code,
          cachedAt: new Date().toISOString(),
        }
      )
    } catch (error: unknown) {
      console.error('Error caching to S3:', {
        cacheKey,
        error: error instanceof Error ? error.message : String(error),
      })
      // Don't throw - caching failures shouldn't break the service
    }
  }

  /**
   * Fetches set data from Scryfall API
   */
  private async fetchSetFromAPI(setCode: string): Promise<ScryfallSet> {
    const url = '/sets/' + setCode

    try {
      const response = await this.axios.get<unknown>(url)

      const validation = ScryfallSetSchema.safeParse(response.data)

      if (!validation.success) {
        const errorMessages = validation.error.errors
          .map((e) => e.path.join('.') + ': ' + e.message)
          .join(', ')

        console.error('Scryfall API response validation failed:', {
          setCode,
          errors: validation.error.errors,
        })

        throw new Error(
          'Invalid Scryfall API response for set ' +
            setCode +
            ': ' +
            errorMessages
        )
      }

      return validation.data
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          console.error('Scryfall API rate limit hit (HTTP 429):', {
            setCode,
            headers: error.response.headers,
          })
          throw new Error('Scryfall API rate limit exceeded for set ' + setCode)
        }

        if (error.response?.status === 404) {
          throw new Error('Set not found: ' + setCode)
        }

        console.error('Scryfall API request failed:', {
          setCode,
          status: error.response?.status,
          message: error.message,
        })
        throw new Error(
          'Scryfall API error for set ' + setCode + ': ' + error.message
        )
      }

      throw error
    }
  }

  /**
   * Gets set data with 24-hour caching
   *
   * 1. Checks S3 cache for fresh data (< 24 hours)
   * 2. Returns cached data if available
   * 3. Fetches from Scryfall API if cache miss/stale
   * 4. Stores response in S3 for future requests
   */
  async getSet(setCode: string): Promise<ScryScraperResult> {
    const url = 'https://api.scryfall.com/sets/' + setCode
    const cacheKey = this.generateCacheKey(url)

    // Try cache first
    const cached = await this.getCachedSet(cacheKey)
    if (cached) {
      console.log('Cache hit for set:', {
        setCode,
        cacheKey,
        ageMs: cached.ageMs,
      })
      return {
        data: cached.data,
        fromCache: true,
        cacheAge: cached.ageMs,
      }
    }

    // Cache miss/stale - fetch from API
    console.log('Cache miss for set, fetching from API:', {
      setCode,
      cacheKey,
    })

    const data = await this.fetchSetFromAPI(setCode)

    // Store in cache for future requests
    await this.cacheSet(cacheKey, data)

    return {
      data,
      fromCache: false,
    }
  }

  /**
   * Gets the S3 client instance (for testing/debugging)
   */
  getS3Client(): S3ClientWrapper {
    return this.s3Client
  }

  /**
   * Gets the axios instance (for testing/debugging)
   */
  getAxiosInstance(): AxiosInstance {
    return this.axios
  }
}

/**
 * Creates a Scryfall Scraper Service instance
 */
export function createScryScraperService(
  config: ScryScraperConfig
): ScryScraperService {
  return new ScryScraperService(config)
}
