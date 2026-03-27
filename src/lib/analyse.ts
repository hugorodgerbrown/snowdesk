import Anthropic from '@anthropic-ai/sdk'
import type { BulletinAnalysis, SkiStyle } from '@/types'
import type { StructuredBulletin } from './bulletin'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are an expert Swiss avalanche and ski conditions analyst.
Given structured CAAMLv6 avalanche bulletin data for a specific Swiss Alpine region,
produce a concise daily briefing for skiers.

The input is already structured JSON — use the typed fields (dangerRatings,
avalancheProblems, elevation bounds, aspects) directly. Use the narrative text fields
(highlights, snowpackSummary, weatherForecast) for context and to fill weather details.

Respond ONLY with valid JSON — no markdown fences, no preamble, no trailing text.

Required JSON shape:
{
  "date": "string (e.g. 26 March 2026)",
  "overallVerdict": "GO | CAUTION | STAY ON PISTE | AVOID BACKCOUNTRY",
  "verdictColour": "green | amber | red",
  "dangerLevel": "e.g. Considerable (3+)",
  "summary": "2-3 sentence plain-English overview",
  "onPiste":    { "rating": "Excellent|Good|Fair|Poor|Closed", "notes": "1-2 sentences" },
  "offPiste":   { "rating": "Epic|Good|Risky|Very Risky|Avoid",  "notes": "1-2 sentences" },
  "skiTouring": { "rating": "Ideal|Acceptable|Experts Only|Avoid", "notes": "1-2 sentences" },
  "keyHazards": ["2-4 short strings"],
  "bestBets":   ["1-3 suggestions for safe terrain or activities"],
  "outlook":    "1-2 sentences on tomorrow and the weekend",
  "weather": {
    "summitTemp":    "extract from weatherForecast text, e.g. −12°C",
    "midTemp":       "extract from weatherForecast text, e.g. −6°C",
    "resortTemp":    "extract from weatherForecast text, e.g. −1°C",
    "freezingLevel": "extract from weatherForecast text, e.g. ~1000m",
    "wind":          "extract from weatherForecast text, e.g. Storm NNW 80 km/h",
    "visibility":    "infer from conditions, e.g. Poor — heavy snowfall",
    "newSnow24h":    "extract from weatherForecast or snowpackSummary, e.g. 40–60 cm",
    "baseDepth":     "extract from snowpackSummary, e.g. 200–240 cm (upper mountain)"
  }
}`

/**
 * Serialises a StructuredBulletin into a compact, token-efficient string
 * for the Claude prompt. Uses structured fields directly rather than
 * passing raw PDF text.
 */
function serialiseBulletin(b: StructuredBulletin, styles: SkiStyle[]): string {
  const dangerStr = b.dangerRatings.map(d => {
    const elev = d.elevationLower
      ? `above ${d.elevationLower}m`
      : d.elevationUpper
      ? `below ${d.elevationUpper}m`
      : 'all elevations'
    const sub = d.subdivision ? ` (${d.subdivision})` : ''
    const asp = d.aspects?.length ? `, aspects: ${d.aspects.join('/')}` : ''
    return `  - ${d.level}${sub} — ${elev}${asp}`
  }).join('\n')

  const problemStr = b.avalancheProblems.map(p => {
    const elev = p.elevationLower
      ? `above ${p.elevationLower}m`
      : p.elevationUpper
      ? `below ${p.elevationUpper}m`
      : 'all elevations'
    const asp = p.aspects?.length ? `, aspects: ${p.aspects.join('/')}` : ''
    const size = p.size ? `, size: ${p.size}/5` : ''
    const desc = p.description ? `\n    "${p.description}"` : ''
    return `  - ${p.type} — ${elev}${asp}${size}${desc}`
  }).join('\n')

  return `Region: ${b.regionName} (${b.regionCode})
Published: ${b.publicationTime}
Valid: ${b.validFrom} → ${b.validUntil}
Subscriber styles: ${styles.join(', ')}

DANGER RATINGS:
${dangerStr}

AVALANCHE PROBLEMS:
${problemStr || '  (none listed)'}

HIGHLIGHTS:
${b.highlights || '(none)'}

SNOWPACK:
${b.snowpackSummary || '(none)'}

WEATHER FORECAST:
${b.weatherForecast || '(none)'}

AVALANCHE ACTIVITY:
${b.avalancheActivity || '(none)'}

TENDENCY / OUTLOOK:
${b.tendency || '(none)'}`
}

export async function analyseBulletin(
  bulletin: StructuredBulletin,
  styles: SkiStyle[],
  regionName: string,
): Promise<BulletinAnalysis> {
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const userMessage = `Today is ${today}. Analyse this bulletin for ${regionName} and respond with JSON only.\n\n${serialiseBulletin(bulletin, styles)}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const raw = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')

  const cleaned = raw.replace(/```json|```/g, '').trim()

  try {
    return JSON.parse(cleaned) as BulletinAnalysis
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${cleaned.slice(0, 200)}`)
  }
}
