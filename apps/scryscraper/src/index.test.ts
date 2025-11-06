import type { ScheduledEvent } from 'aws-lambda'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type {
  ScryscraperResult,
  ScryscraperService,
} from './services/scryfall-scraper.service.js'

// Load the example set response
const exampleSetResponse = {
  object: 'set',
  id: '118f7e64-5caa-4cb7-99a8-184f4d3a7422',
  code: 'tla',
  mtgo_code: 'tla',
  arena_code: 'tla',
  tcgplayer_id: 24421,
  name: 'Avatar: The Last Airbender',
  uri: 'https://api.scryfall.com/sets/118f7e64-5caa-4cb7-99a8-184f4d3a7422',
  scryfall_uri: 'https://scryfall.com/sets/tla',
  search_uri:
    'https://api.scryfall.com/cards/search?include_extras=true&include_variations=true&order=set&q=e%3Atla&unique=prints',
  released_at: '2025-11-21',
  set_type: 'expansion',
  card_count: 358,
  digital: false,
  nonfoil_only: false,
  foil_only: false,
  icon_svg_uri: 'https://svgs.scryfall.io/sets/tla.svg?1762146000',
}

// Mock the scryfall-scraper service
let mockGetSetResult: ScryscraperResult = {
  data: exampleSetResponse,
  fromCache: false,
}
let mockGetSetError: Error | null = null

const mockGetSet = vi.fn(
  async (): Promise<ScryscraperResult> => {
    if (mockGetSetError) {
      throw mockGetSetError
    }
    return mockGetSetResult
  }
)

const mockCreateScryscraperService = vi.fn(
  (): ScryscraperService => {
    return {
      getSet: mockGetSet,
    } as ScryscraperService
  }
)

vi.mock('./services/scryfall-scraper.service.js', () => {
  return {
    createScryscraperService: mockCreateScryscraperService,
  }
})

// Import the handler after mocking
const { handler } = await import('./index.js')

describe('Lambda Handler - Scryscraper', () => {
  // Store original env vars
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment variables
    process.env = {
      ...originalEnv,
      SCRYSCRAPER_CACHE_BUCKET: 'test-cache-bucket',
      SCRYFALL_SET_CODE: 'tla',
    }

    // Reset service mocks
    mockGetSetResult = {
      data: exampleSetResponse,
      fromCache: false,
    }
    mockGetSetError = null

    // Clear mock calls
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('Environment Validation', () => {
    it('should throw error when SCRYSCRAPER_CACHE_BUCKET is missing', async () => {
      delete process.env.SCRYSCRAPER_CACHE_BUCKET

      const event = createMockScheduledEvent()

      await expect(handler(event)).rejects.toThrow(
        'Missing required environment variable: SCRYSCRAPER_CACHE_BUCKET'
      )
    })

    it('should throw error when SCRYFALL_SET_CODE is missing', async () => {
      delete process.env.SCRYFALL_SET_CODE

      const event = createMockScheduledEvent()

      await expect(handler(event)).rejects.toThrow(
        'Missing required environment variable: SCRYFALL_SET_CODE'
      )
    })

    it('should accept valid environment variables', async () => {
      const event = createMockScheduledEvent()

      await expect(handler(event)).resolves.not.toThrow()

      // Verify that service was created with correct config
      expect(mockCreateScryscraperService).toHaveBeenCalledWith({
        s3BucketName: 'test-cache-bucket',
        userAgent: 'scryscraper/1.0',
      })
    })
  })

  describe('Scryfall Service Integration', () => {
    it('should fetch and validate set data using the scraper service', async () => {
      const event = createMockScheduledEvent()
      await handler(event)

      // Verify service was created
      expect(mockCreateScryscraperService).toHaveBeenCalledWith({
        s3BucketName: 'test-cache-bucket',
        userAgent: 'scryscraper/1.0',
      })

      // Verify getSet was called with correct set code
      expect(mockGetSet).toHaveBeenCalledWith('tla')
    })

    it('should handle cache hit scenarios', async () => {
      mockGetSetResult = {
        data: exampleSetResponse,
        fromCache: true,
        cacheAge: 1000 * 60 * 30, // 30 minutes
      }

      const event = createMockScheduledEvent()
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {})

      await handler(event)

      expect(consoleLogSpy).toHaveBeenCalledWith('Cache status: HIT')
      expect(consoleLogSpy).toHaveBeenCalledWith('Cache age: 30 minutes')

      consoleLogSpy.mockRestore()
    })

    it('should handle cache miss scenarios', async () => {
      mockGetSetResult = {
        data: exampleSetResponse,
        fromCache: false,
      }

      const event = createMockScheduledEvent()
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {})

      await handler(event)

      expect(consoleLogSpy).toHaveBeenCalledWith('Cache status: MISS')

      consoleLogSpy.mockRestore()
    })

    it('should handle service errors', async () => {
      mockGetSetError = new Error('Service error')

      const event = createMockScheduledEvent()

      await expect(handler(event)).rejects.toThrow('Service error')
    })

    it('should handle Scryfall API errors (404)', async () => {
      mockGetSetError = new Error('Set not found: invalid')

      const event = createMockScheduledEvent()

      await expect(handler(event)).rejects.toThrow('Set not found: invalid')
    })

    it('should handle Scryfall API rate limiting (429)', async () => {
      mockGetSetError = new Error(
        'Scryfall API rate limit exceeded for set tla'
      )

      const event = createMockScheduledEvent()

      await expect(handler(event)).rejects.toThrow(
        'Scryfall API rate limit exceeded for set tla'
      )
    })

    it('should handle validation errors', async () => {
      mockGetSetError = new Error('Invalid Scryfall API response for set tla')

      const event = createMockScheduledEvent()

      await expect(handler(event)).rejects.toThrow(
        'Invalid Scryfall API response for set tla'
      )
    })
  })

  describe('Handler Execution', () => {
    it('should complete full execution flow successfully', async () => {
      const event = createMockScheduledEvent()

      await expect(handler(event)).resolves.not.toThrow()

      expect(mockGetSet).toHaveBeenCalledTimes(1)
    })

    it('should handle EventBridge scheduled event structure', async () => {
      const event: ScheduledEvent = {
        version: '0',
        id: 'test-event-id',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: '2024-01-01T12:00:00Z',
        region: 'ap-southeast-2',
        resources: [
          'arn:aws:events:ap-southeast-2:123456789012:rule/test-rule',
        ],
        detail: {},
      }

      await expect(handler(event)).resolves.not.toThrow()
    })

    it('should log set information', async () => {
      const event = createMockScheduledEvent()
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {})

      await handler(event)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Successfully fetched set: Avatar: The Last Airbender (tla)'
      )
      expect(consoleLogSpy).toHaveBeenCalledWith('Card count: 358')
      expect(consoleLogSpy).toHaveBeenCalledWith('Released: 2025-11-21')
      expect(consoleLogSpy).toHaveBeenCalledWith('Set type: expansion')

      consoleLogSpy.mockRestore()
    })
  })

  describe('Error Handling', () => {
    it('should log error details when handler fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      mockGetSetError = new Error('Test error')

      const event = createMockScheduledEvent()
      await expect(handler(event)).rejects.toThrow('Test error')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in Lambda handler:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it('should re-throw errors for Lambda retry logic', async () => {
      mockGetSetError = new Error('Service error')

      const event = createMockScheduledEvent()

      // Error should propagate up for Lambda to handle
      await expect(handler(event)).rejects.toThrow('Service error')
    })
  })
})

/**
 * Helper function to create a mock EventBridge scheduled event
 */
function createMockScheduledEvent(): ScheduledEvent {
  return {
    version: '0',
    id: 'mock-event-id',
    'detail-type': 'Scheduled Event',
    source: 'aws.events',
    account: '123456789012',
    time: new Date().toISOString(),
    region: 'ap-southeast-2',
    resources: ['arn:aws:events:ap-southeast-2:123456789012:rule/mock-rule'],
    detail: {},
  }
}
