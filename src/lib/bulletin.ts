/**
 * SLF Avalanche Bulletin fetcher
 *
 * Uses the SLF CAAMLv6 GeoJSON API instead of the PDF text endpoint.
 * This gives us structured, typed data rather than narrative prose,
 * which reduces token usage and makes Claude's analysis more reliable.
 *
 * API: GET https://aws.slf.ch/api/bulletin/caaml/en/geojson
 *
 * Returns a GeoJSON FeatureCollection. Each Feature covers one bulletin
 * zone (which may span multiple warning regions). The `properties.regions`
 * array lists the SLF region codes covered by that feature.
 *
 * We find the feature whose regions array contains our target region code,
 * extract the relevant fields, and return a compact structured summary
 * ready to pass to Claude.
 */

const GEOJSON_URL = 'https://aws.slf.ch/api/bulletin/caaml/en/geojson'

// ── Types matching the CAAMLv6 GeoJSON schema ────────────────────────────────

interface CAAMLRegion {
  regionID: string
  name: string
}

interface DangerRating {
  mainValue: 'no_rating' | 'no_snow' | 'low' | 'moderate' | 'considerable' | 'high' | 'very_high'
  elevation?: { lowerBound?: string; upperBound?: string }
  aspects?: string[]
  validTimePeriod?: string
  customData?: { CH?: { subdivision?: string } }
}

interface AvalancheProblem {
  problemType: string
  elevation?: { lowerBound?: string; upperBound?: string }
  aspects?: string[]
  avalancheSize?: number
  snowpackStability?: string
  frequency?: string
  comment?: string
  customData?: { CH?: { coreZoneText?: string } }
}

interface BulletinProperties {
  bulletinID: string
  publicationTime: string
  validTime: { startTime: string; endTime: string }
  regions: CAAMLRegion[]
  dangerRatings: DangerRating[]
  avalancheProblems?: AvalancheProblem[]
  highlights?: string
  snowpackStructure?: { highlights?: string; comment?: string }
  weatherForecast?: { highlights?: string; comment?: string }
  weatherReview?: { highlights?: string; comment?: string }
  avalancheActivity?: { highlights?: string; comment?: string }
  travelAdvisory?: { highlights?: string; comment?: string }
  tendency?: { highlights?: string; comment?: string }[]
}

interface BulletinFeature {
  type: 'Feature'
  id: string
  properties: BulletinProperties
}

interface BulletinFeatureCollection {
  type: 'FeatureCollection'
  features: BulletinFeature[]
}

// ── Public types ─────────────────────────────────────────────────────────────

export interface StructuredBulletin {
  regionCode: string
  regionName: string
  publicationTime: string
  validFrom: string
  validUntil: string

  // Danger — there may be two ratings (above/below elevation split)
  dangerRatings: {
    level: string          // e.g. "considerable", "high"
    subdivision: string    // e.g. "plus", "minus", "" (no subdivision)
    elevationLower?: string
    elevationUpper?: string
    aspects?: string[]
  }[]

  // Avalanche problems (typically 1-3)
  avalancheProblems: {
    type: string           // e.g. "new_snow", "wind_slab", "persistent_weak_layers"
    elevationLower?: string
    elevationUpper?: string
    aspects?: string[]
    size?: number          // 1-5
    stability?: string
    frequency?: string
    description?: string
  }[]

  // Narrative text fields (passed to Claude for human-readable context)
  highlights: string
  snowpackSummary: string
  weatherForecast: string
  avalancheActivity: string
  tendency: string
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

/**
 * Fetches the full GeoJSON bulletin and extracts the entry for a specific
 * SLF region code (e.g. "4116"). Returns a compact StructuredBulletin.
 */
export async function fetchStructuredBulletin(regionCode: string): Promise<StructuredBulletin> {
  const res = await fetch(GEOJSON_URL, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 },
  })

  if (!res.ok) {
    throw new Error(`SLF GeoJSON API error ${res.status}: ${res.statusText}`)
  }

  const data: BulletinFeatureCollection = await res.json()

  if (!data.features?.length) {
    throw new Error('SLF API returned an empty bulletin (no features)')
  }

  // Find the feature covering our region code.
  // regionID format in the API is "CH-4116" — handle both bare and prefixed forms.
  const normalised = regionCode.replace(/^CH-/i, '')

  const feature = data.features.find(f =>
    f.properties.regions.some(r =>
      r.regionID === regionCode ||
      r.regionID === `CH-${normalised}` ||
      r.regionID.endsWith(`-${normalised}`)
    )
  )

  if (!feature) {
    const available = data.features
      .flatMap(f => f.properties.regions.map(r => r.regionID))
      .join(', ')
    throw new Error(
      `Region code ${regionCode} not found in bulletin. ` +
      `Available region IDs: ${available}`
    )
  }

  const p = feature.properties

  const regionEntry = p.regions.find(r =>
    r.regionID === regionCode ||
    r.regionID === `CH-${normalised}` ||
    r.regionID.endsWith(`-${normalised}`)
  )

  return {
    regionCode,
    regionName: regionEntry?.name ?? regionCode,
    publicationTime: p.publicationTime,
    validFrom: p.validTime.startTime,
    validUntil: p.validTime.endTime,

    dangerRatings: p.dangerRatings.map(d => ({
      level: d.mainValue,
      subdivision: d.customData?.CH?.subdivision ?? '',
      elevationLower: d.elevation?.lowerBound,
      elevationUpper: d.elevation?.upperBound,
      aspects: d.aspects,
    })),

    avalancheProblems: (p.avalancheProblems ?? []).map(a => ({
      type: a.problemType,
      elevationLower: a.elevation?.lowerBound,
      elevationUpper: a.elevation?.upperBound,
      aspects: a.aspects,
      size: a.avalancheSize,
      stability: a.snowpackStability,
      frequency: a.frequency,
      description: a.comment ?? a.customData?.CH?.coreZoneText,
    })),

    highlights:        p.highlights ?? '',
    snowpackSummary:   [p.snowpackStructure?.highlights, p.snowpackStructure?.comment].filter(Boolean).join(' '),
    weatherForecast:   [p.weatherForecast?.highlights, p.weatherForecast?.comment].filter(Boolean).join(' '),
    avalancheActivity: [p.avalancheActivity?.highlights, p.avalancheActivity?.comment].filter(Boolean).join(' '),
    tendency:          (p.tendency ?? []).map(t => [t.highlights, t.comment].filter(Boolean).join(' ')).join(' '),
  }
}

/**
 * Convenience wrapper used by /api/preview and /api/cron/send.
 * Accepts the area slug + optional region code and returns the structured bulletin.
 * Falls back to the first region code in the area if none specified.
 */
export async function fetchBulletinForSubscriber(
  regionArea: string,
  regionCode: string | null,
): Promise<{ bulletin: StructuredBulletin; regionCode: string }> {
  const { REGION_MAP } = await import('@/types')

  const regions = REGION_MAP[regionArea]
  if (!regions?.length) {
    throw new Error(`Unknown region area: ${regionArea}`)
  }

  const code = regionCode ?? regions[0][0]
  const bulletin = await fetchStructuredBulletin(code)
  return { bulletin, regionCode: code }
}
