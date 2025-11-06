/**
 * Image Downloader Service for MTG card images
 *
 * This module provides boilerplate code for downloading card images from Scryfall
 * and storing them in S3 or local storage.
 *
 * NOTE: This is boilerplate code - S3 integration is not yet configured.
 * To use this service, you will need to:
 * 1. Add @aws-sdk/client-s3 to dependencies
 * 2. Create an S3 bucket for card images
 * 3. Configure IAM permissions for the Lambda function
 * 4. Set S3_BUCKET_NAME environment variable
 *
 * Scryfall Image Formats:
 * - png: High-resolution PNG (best quality)
 * - border_crop: Card cropped to border
 * - art_crop: Just the artwork
 * - large: Large resolution
 * - normal: Standard resolution (recommended for most uses)
 * - small: Thumbnail size
 */

export interface ImageDownloadOptions {
  /**
   * The image format to download
   * @default 'normal'
   */
  format?: 'png' | 'border_crop' | 'art_crop' | 'large' | 'normal' | 'small'

  /**
   * Whether to overwrite existing images
   * @default false
   */
  overwrite?: boolean

  /**
   * Maximum retry attempts on failure
   * @default 3
   */
  maxRetries?: number
}

export interface ImageDownloadResult {
  /**
   * The S3 key or file path where the image was stored
   */
  location: string

  /**
   * The image format that was downloaded
   */
  format: string

  /**
   * Size of the downloaded image in bytes
   */
  sizeBytes: number

  /**
   * Whether the image was newly downloaded or already existed
   */
  wasDownloaded: boolean
}

/**
 * Interface for card image URIs from Scryfall
 * Multi-faced cards will have these in the card_faces array
 */
export interface CardImageUris {
  small?: string
  normal?: string
  large?: string
  png?: string
  art_crop?: string
  border_crop?: string
}

/**
 * Image Downloader Service
 *
 * @example
 * ```typescript
 * const downloader = new ImageDownloaderService()
 *
 * // Single-faced card
 * const result = await downloader.downloadCardImage(
 *   'card-id',
 *   imageUris,
 *   { format: 'normal' }
 * )
 *
 * // Multi-faced card
 * const results = await downloader.downloadMultiFacedCard(
 *   'card-id',
 *   cardFaces
 * )
 * ```
 */
export class ImageDownloaderService {
  private bucketName: string
  private bucketPrefix: string
  // private s3Client: S3Client // Uncomment when AWS SDK is added

  constructor(bucketName?: string, bucketPrefix: string = 'cards/images') {
    this.bucketName = bucketName || process.env.S3_BUCKET_NAME || ''
    this.bucketPrefix = bucketPrefix

    if (!this.bucketName) {
      console.warn(
        'S3 bucket name not configured. Set S3_BUCKET_NAME environment variable.'
      )
    }

    // TODO: Initialize S3 client when AWS SDK is added
    // import { S3Client } from '@aws-sdk/client-s3'
    //
    // this.s3Client = new S3Client({})
  }

  /**
   * Downloads a card image and stores it in S3
   *
   * @param cardId - The Scryfall card ID
   * @param imageUris - The image URIs from Scryfall
   * @param options - Download options
   * @returns Promise that resolves to download result
   */
  async downloadCardImage(
    cardId: string,
    imageUris: CardImageUris,
    options: ImageDownloadOptions = {}
  ): Promise<ImageDownloadResult> {
    const format = options.format || 'normal'
    const imageUrl = imageUris[format]

    if (!imageUrl) {
      throw new Error(
        `Image format "${format}" not available for card ${cardId}`
      )
    }

    const s3Key = `${this.bucketPrefix}/${cardId}/${format}.jpg`

    console.log('Image download boilerplate called:', {
      cardId,
      format,
      imageUrl,
      s3Key,
    })

    // TODO: Check if image already exists (unless overwrite is true)
    // if (!options.overwrite) {
    //   const exists = await this.imageExists(s3Key)
    //   if (exists) {
    //     return {
    //       location: s3Key,
    //       format,
    //       sizeBytes: 0,
    //       wasDownloaded: false,
    //     }
    //   }
    // }

    // TODO: Download image from Scryfall
    // const response = await fetch(imageUrl)
    // if (!response.ok) {
    //   throw new Error(`Failed to download image: ${response.statusText}`)
    // }
    // const imageBuffer = Buffer.from(await response.arrayBuffer())

    // TODO: Upload to S3
    // import { PutObjectCommand } from '@aws-sdk/client-s3'
    //
    // const command = new PutObjectCommand({
    //   Bucket: this.bucketName,
    //   Key: s3Key,
    //   Body: imageBuffer,
    //   ContentType: 'image/jpeg',
    //   Metadata: {
    //     cardId,
    //     format,
    //     sourceUrl: imageUrl,
    //     downloadedAt: new Date().toISOString(),
    //   },
    // })
    //
    // await this.s3Client.send(command)

    console.log(`Image would be downloaded and stored at: ${s3Key}`)

    return {
      location: s3Key,
      format,
      sizeBytes: 0, // Would be imageBuffer.length
      wasDownloaded: true,
    }
  }

  /**
   * Downloads all images for a multi-faced card
   *
   * Multi-faced cards have image URIs in the card_faces array rather than
   * at the top level. Each face needs to be downloaded separately.
   *
   * @param cardId - The Scryfall card ID
   * @param cardFaces - Array of card faces with image URIs
   * @param options - Download options
   * @returns Promise that resolves to array of download results
   */
  async downloadMultiFacedCard(
    cardId: string,
    cardFaces: Array<{ name: string; image_uris?: CardImageUris }>,
    options: ImageDownloadOptions = {}
  ): Promise<ImageDownloadResult[]> {
    console.log(
      `Downloading ${cardFaces.length} faces for multi-faced card ${cardId}`
    )

    const results: ImageDownloadResult[] = []

    for (let i = 0; i < cardFaces.length; i++) {
      const face = cardFaces[i]

      if (!face.image_uris) {
        console.warn(
          `Face ${i} of card ${cardId} (${face.name}) has no image URIs`
        )
        continue
      }

      // Download with face index in the path
      const faceResult = await this.downloadCardImageWithFace(
        cardId,
        i,
        face.image_uris,
        options
      )

      results.push(faceResult)
    }

    return results
  }

  /**
   * Downloads a specific face of a multi-faced card
   *
   * @param cardId - The Scryfall card ID
   * @param faceIndex - The index of the face (0-based)
   * @param imageUris - The image URIs for this face
   * @param options - Download options
   * @returns Promise that resolves to download result
   */
  private async downloadCardImageWithFace(
    cardId: string,
    faceIndex: number,
    imageUris: CardImageUris,
    options: ImageDownloadOptions = {}
  ): Promise<ImageDownloadResult> {
    const format = options.format || 'normal'
    const imageUrl = imageUris[format]

    if (!imageUrl) {
      throw new Error(
        `Image format "${format}" not available for card ${cardId} face ${faceIndex}`
      )
    }

    const s3Key = `${this.bucketPrefix}/${cardId}/face-${faceIndex}-${format}.jpg`

    console.log('Multi-faced image download boilerplate called:', {
      cardId,
      faceIndex,
      format,
      imageUrl,
      s3Key,
    })

    // Same implementation as downloadCardImage but with different key
    console.log(`Face ${faceIndex} image would be stored at: ${s3Key}`)

    return {
      location: s3Key,
      format,
      sizeBytes: 0,
      wasDownloaded: true,
    }
  }

  /**
   * Checks if an image already exists in S3
   *
   * @param s3Key - The S3 key to check
   * @returns Promise that resolves to true if the image exists
   */
  private async imageExists(s3Key: string): Promise<boolean> {
    console.log(`Checking if image exists: ${s3Key}`)

    // TODO: Implement S3 head object check
    // import { HeadObjectCommand } from '@aws-sdk/client-s3'
    //
    // try {
    //   const command = new HeadObjectCommand({
    //     Bucket: this.bucketName,
    //     Key: s3Key,
    //   })
    //   await this.s3Client.send(command)
    //   return true
    // } catch (error) {
    //   if (error.name === 'NotFound') {
    //     return false
    //   }
    //   throw error
    // }

    return false
  }

  /**
   * Generates a public URL for an image stored in S3
   *
   * @param s3Key - The S3 key of the image
   * @returns The public URL (if bucket is public) or signed URL
   */
  getImageUrl(s3Key: string): string {
    // TODO: Generate actual S3 URL
    // For public buckets:
    // return `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`
    //
    // For private buckets, generate a signed URL:
    // import { GetObjectCommand } from '@aws-sdk/client-s3'
    // import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
    //
    // const command = new GetObjectCommand({
    //   Bucket: this.bucketName,
    //   Key: s3Key,
    // })
    // return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 })

    return `https://placeholder.s3.amazonaws.com/${s3Key}`
  }
}

/**
 * Creates an image downloader service instance with the default configuration
 *
 * @returns Image downloader service instance
 */
export function createImageDownloaderService(): ImageDownloaderService {
  return new ImageDownloaderService()
}
