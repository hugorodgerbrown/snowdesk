/**
 * Fetches the plain-text content of an SLF avalanche bulletin PDF.
 * The aws.slf.ch API returns a PDF which we request as text via the
 * Accept header — in practice the endpoint streams readable text content.
 */

const SLF_BASE = 'https://aws.slf.ch/api/bulletin/document'

export async function fetchRegionalBulletin(regionCode: string): Promise<string> {
  const url = `${SLF_BASE}/regional/en/${regionCode}`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/pdf, text/plain' },
    next: { revalidate: 3600 }, // cache for 1 hour in Next.js
  })

  if (!res.ok) {
    throw new Error(`SLF API error ${res.status} for region ${regionCode}`)
  }

  const text = await res.text()
  return text.trim()
}

export async function fetchFullBulletin(): Promise<string> {
  const url = `${SLF_BASE}/full/en`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/pdf, text/plain' },
    next: { revalidate: 3600 },
  })

  if (!res.ok) {
    throw new Error(`SLF full bulletin API error ${res.status}`)
  }

  return (await res.text()).trim()
}

/**
 * Given an area slug (e.g. "verbier") and optional specific region code,
 * fetches the most relevant bulletin text.
 * Falls back to the primary region code for the area if no specific code given.
 */
export async function fetchBulletinForSubscriber(
  regionArea: string,
  regionCode: string | null,
): Promise<{ text: string; regionCode: string }> {
  const { REGION_MAP } = await import('@/types')

  const regions = REGION_MAP[regionArea]
  if (!regions?.length) {
    throw new Error(`Unknown region area: ${regionArea}`)
  }

  // Use the subscriber's chosen sub-region, or default to the first in the area
  const code = regionCode ?? regions[0][0]
  const text = await fetchRegionalBulletin(code)
  return { text, regionCode: code }
}
