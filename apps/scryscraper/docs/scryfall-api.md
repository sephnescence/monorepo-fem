# Scryfall REST API Documentation

## API Endpoint & Access

The Scryfall API is accessible at `https://api.scryfall.com` and is only served over HTTPS, using TLS 1.2 or better.

## Required Headers

All requests must include:

- **User-Agent**: Should accurately reflect your application (e.g., `scryscraper/1.0`)
- **Accept**: `application/json` is preferred, though generic values like `*/*` or `application/json;q=0.9,*/*;q=0.8` also work

## Rate Limiting

Users should insert 50-100 milliseconds of delay between requests (approximately 10 requests per second). Exceeding limits results in `HTTP 429 Too Many Requests`, with potential IP bans for persistent violations.

## Data Usage Guidelines

The documentation specifies that Scryfall data can be used for creating Magic software, research, or community content. Key restrictions include:

- Cannot paywall access to Scryfall data
- Must not repackage or republish without adding value
- Cannot create competing games using the data
- Should cache data for at least 24 hours

## Image Usage Restrictions

When using card imagery, you must:

- Retain copyright and artist attribution (not crop or cover)
- Avoid distortion, desaturation, or colour-shifting
- Not add watermarks or claim alternative sources

## Set API Response Structure

The `/sets/{code}` endpoint returns a set object with the following fields:

| Field        | Data Type         | Description                        |
| ------------ | ----------------- | ---------------------------------- |
| object       | String            | Always "set"                       |
| id           | String (UUID)     | Unique identifier for the set      |
| code         | String            | The set code (e.g., "tla")         |
| mtgo_code    | String            | Magic Online set code              |
| arena_code   | String            | Arena format code                  |
| tcgplayer_id | Integer           | TCGPlayer marketplace identifier   |
| name         | String            | Full name of the set               |
| uri          | String (URL)      | API endpoint reference             |
| scryfall_uri | String (URL)      | Web interface link                 |
| search_uri   | String (URL)      | Parameterised card search          |
| released_at  | String (ISO Date) | Release date (YYYY-MM-DD)          |
| set_type     | String            | Type of set (e.g., "expansion")    |
| card_count   | Integer           | Number of cards in the set         |
| digital      | Boolean           | Whether this is a digital-only set |
| nonfoil_only | Boolean           | Whether the set is non-foil only   |
| foil_only    | Boolean           | Whether the set is foil only       |
| icon_svg_uri | String (URL)      | SVG asset reference for set icon   |

## Cards API

Cards within a set can have multiple faces (for double-faced cards, split cards, etc.). When parsing card data, always check for the presence of `card_faces` array which may contain:

- Image URIs for each face
- Separate mana costs, names, and oracle text
- Individual artist attributions

## Images

Cards may have various image formats available:

- `png` - High resolution PNG
- `border_crop` - Cropped to card border
- `art_crop` - Just the artwork
- `large` - Large resolution
- `normal` - Standard resolution
- `small` - Thumbnail size

For double-faced cards, check the `card_faces` array for individual `image_uris` for each face.

## References

- [Scryfall API Documentation](https://scryfall.com/docs/api)
- [Rate Limiting Policy](https://scryfall.com/docs/api#rate-limits-and-good-citizenship)
