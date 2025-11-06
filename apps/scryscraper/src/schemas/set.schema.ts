import { z } from 'zod'

/**
 * Zod schema for Scryfall Set API response
 * Based on API documentation and example response from https://api.scryfall.com/sets/{code}
 *
 * @see https://scryfall.com/docs/api/sets
 */
export const ScryfallSetSchema = z
  .object({
    object: z.literal('set').describe('Object type identifier, always "set"'),
    id: z.string().uuid().describe('Unique identifier for the set'),
    code: z
      .string()
      .min(3)
      .max(5)
      .describe('The set code (e.g., "tla", "one")'),
    mtgo_code: z
      .string()
      .optional()
      .describe('Magic Online set code, if applicable'),
    arena_code: z
      .string()
      .optional()
      .describe('Arena format code, if applicable'),
    tcgplayer_id: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('TCGPlayer marketplace identifier'),
    name: z.string().min(1).describe('Full name of the set'),
    uri: z.string().url().describe('API endpoint reference for this set'),
    scryfall_uri: z.string().url().describe('Web interface link for this set'),
    search_uri: z
      .string()
      .url()
      .describe('Parameterised card search URI for this set'),
    released_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe('Release date in ISO 8601 format (YYYY-MM-DD)'),
    set_type: z
      .string()
      .min(1)
      .describe('Type of set (e.g., "expansion", "core", "masters")'),
    card_count: z
      .number()
      .int()
      .nonnegative()
      .describe('Total number of cards in the set'),
    digital: z.boolean().describe('Whether this is a digital-only set'),
    nonfoil_only: z
      .boolean()
      .describe('Whether the set is available in non-foil only'),
    foil_only: z
      .boolean()
      .describe('Whether the set is available in foil only'),
    icon_svg_uri: z
      .string()
      .url()
      .describe('SVG asset reference for set icon'),
  })
  .strict()

/**
 * TypeScript type inferred from the Zod schema
 */
export type ScryfallSet = z.infer<typeof ScryfallSetSchema>

/**
 * Validates a Scryfall Set API response
 *
 * @param data - The data to validate
 * @returns Parsed and validated ScryfallSet object
 * @throws {z.ZodError} If validation fails
 */
export function validateSetResponse(data: unknown): ScryfallSet {
  return ScryfallSetSchema.parse(data)
}

/**
 * Safely validates a Scryfall Set API response
 *
 * @param data - The data to validate
 * @returns Success object with parsed data, or failure object with error
 */
export function safeValidateSetResponse(
  data: unknown
): z.SafeParseReturnType<unknown, ScryfallSet> {
  return ScryfallSetSchema.safeParse(data)
}
