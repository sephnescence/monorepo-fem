import { MockCloudWatchLogPublisher } from '@monorepo-fem/cloudwatch-log-publisher/testing'
import type { ScheduledEvent } from 'aws-lambda'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

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

// Mock the cloudwatch-log-publisher module
let mockPublisherInstance: MockCloudWatchLogPublisher | null = null
let pendingPublishError: Error | null = null

vi.mock('@monorepo-fem/cloudwatch-log-publisher', () => {
  return {
    CloudWatchLogPublisher: class MockedCloudWatchLogPublisher {
      constructor(config: any) {
        mockPublisherInstance = new MockCloudWatchLogPublisher(config)
        // Apply any pending error
        if (pendingPublishError) {
          mockPublisherInstance.setPublishError(pendingPublishError)
        }
        return mockPublisherInstance as any
      }
    },
  }
})

// Mock global fetch
let mockFetchResponse: any = exampleSetResponse
let mockFetchError: Error | null = null

const defaultFetchMock = vi.fn(async (url: string) => {
  if (mockFetchError) {
    throw mockFetchError
  }

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => mockFetchResponse,
  } as Response
})

global.fetch = defaultFetchMock

// Import the handler after mocking
const { handler } = await import('./index.js')

// Helper to get the mock publisher instance
function getMockPublisher(): MockCloudWatchLogPublisher {
  if (!mockPublisherInstance) {
    throw new Error('Mock publisher instance not available')
  }
  return mockPublisherInstance
}

// Helper to set an error that will be applied to the next mock instance created
function setPendingPublishError(error: Error): void {
  pendingPublishError = error
}

describe('Lambda Handler - Scryscraper', () => {
  // Store original env vars
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment variables
    process.env = {
      ...originalEnv,
      LOG_GROUP_NAME: '/test/scryscraper',
      LOG_STREAM_PREFIX: 'test-stream',
      SCRYFALL_SET_CODE: 'tla',
    }

    // Reset fetch mocks
    mockFetchResponse = exampleSetResponse
    mockFetchError = null
    global.fetch = defaultFetchMock

    // Clear console spies
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clear any mock publisher errors
    pendingPublishError = null
    try {
      const mockPublisher = getMockPublisher()
      if (mockPublisher) {
        mockPublisher.clearPublishError()
        mockPublisher.clearPublishedEvents()
      }
    } catch {
      // Ignore if no mock instance exists
    }

    // Restore original environment
    process.env = originalEnv
  })

  describe('Environment Validation', () => {
    it('should throw error when LOG_GROUP_NAME is missing', async () => {
      delete process.env.LOG_GROUP_NAME

      const event = createMockScheduledEvent()

      await expect(handler(event)).rejects.toThrow(
        'Missing required environment variable: LOG_GROUP_NAME'
      )
    })

    it('should throw error when LOG_STREAM_PREFIX is missing', async () => {
      delete process.env.LOG_STREAM_PREFIX

      const event = createMockScheduledEvent()

      await expect(handler(event)).rejects.toThrow(
        'Missing required environment variable: LOG_STREAM_PREFIX'
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

      // Verify that publisher was configured correctly
      const mockPublisher = getMockPublisher()
      expect(mockPublisher.getLogGroupName()).toBe('/test/scryscraper')
      expect(mockPublisher.getLogStreamPrefix()).toBe('test-stream')
    })
  })

  describe('Scryfall API Integration', () => {
    it('should fetch and validate set data from Scryfall API', async () => {
      const event = createMockScheduledEvent()
      await handler(event)

      // Verify fetch was called with correct URL and headers
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.scryfall.com/sets/tla',
        expect.objectContaining({
          headers: {
            'User-Agent': 'scryscraper/1.0',
            Accept: 'application/json',
          },
        })
      )

      // Verify data was published
      const mockPublisher = getMockPublisher()
      expect(mockPublisher.getPublishedEventCount()).toBe(1)

      const publishedEvent = mockPublisher.getLastPublishedEvent()
      expect(publishedEvent).toBeDefined()
      expect(publishedEvent!.logEvent).toMatchObject({
        message: 'Scryfall set data fetched successfully',
        source: 'scryscraper',
        type: 'scryfall_set',
        setCode: 'tla',
        setName: 'Avatar: The Last Airbender',
        cardCount: 358,
        releasedAt: '2025-11-21',
        setType: 'expansion',
        timestamp: expect.any(String),
      })
    })

    it('should handle API request failures', async () => {
      // Mock a failed API response
      global.fetch = vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({}),
      })) as any

      const event = createMockScheduledEvent()

      await expect(handler(event)).rejects.toThrow(
        'Scryfall API request failed: 404 Not Found'
      )
    })

    it('should handle network errors', async () => {
      mockFetchError = new Error('Network error')

      const event = createMockScheduledEvent()

      await expect(handler(event)).rejects.toThrow('Network error')
    })

    it('should validate API response schema', async () => {
      // Mock an invalid response that doesn't match the schema
      mockFetchResponse = {
        object: 'invalid',
        // Missing required fields
      }

      const event = createMockScheduledEvent()

      await expect(handler(event)).rejects.toThrow(
        'Invalid API response schema'
      )
    })
  })

  describe('Schema Validation', () => {
    it('should accept valid set response', async () => {
      const event = createMockScheduledEvent()

      await expect(handler(event)).resolves.not.toThrow()

      const mockPublisher = getMockPublisher()
      const publishedEvent = mockPublisher.getLastPublishedEvent()
      expect(publishedEvent!.logEvent.setCode).toBe('tla')
    })

    it('should reject response with invalid object type', async () => {
      mockFetchResponse = {
        ...exampleSetResponse,
        object: 'card', // Invalid - should be "set"
      }

      const event = createMockScheduledEvent()

      await expect(handler(event)).rejects.toThrow(
        'Invalid API response schema'
      )
    })

    it('should reject response missing required fields', async () => {
      mockFetchResponse = {
        object: 'set',
        // Missing other required fields
      }

      const event = createMockScheduledEvent()

      await expect(handler(event)).rejects.toThrow(
        'Invalid API response schema'
      )
    })

    it('should reject response with invalid date format', async () => {
      mockFetchResponse = {
        ...exampleSetResponse,
        released_at: 'invalid-date',
      }

      const event = createMockScheduledEvent()

      await expect(handler(event)).rejects.toThrow(
        'Invalid API response schema'
      )
    })
  })

  describe('Publisher Integration', () => {
    it('should propagate publisher errors', async () => {
      // Set error before creating the mock instance
      setPendingPublishError(new Error('CloudWatch service unavailable'))

      const event = createMockScheduledEvent()
      await expect(handler(event)).rejects.toThrow(
        'CloudWatch service unavailable'
      )
    })
  })

  describe('Handler Execution', () => {
    it('should complete full execution flow successfully', async () => {
      const event = createMockScheduledEvent()

      await expect(handler(event)).resolves.not.toThrow()

      // Verify event was published
      const mockPublisher = getMockPublisher()
      expect(mockPublisher.getPublishedEventCount()).toBe(1)
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
  })

  describe('Error Handling', () => {
    it('should log error details when handler fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      mockFetchError = new Error('Test error')

      const event = createMockScheduledEvent()
      await expect(handler(event)).rejects.toThrow('Test error')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in Lambda handler:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it('should re-throw errors for Lambda retry logic', async () => {
      mockFetchError = new Error('Service error')

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
