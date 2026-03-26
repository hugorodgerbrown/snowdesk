import Anthropic from '@anthropic-ai/sdk'
import type { BulletinAnalysis, SkiStyle } from '@/types'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are an expert Swiss avalanche and ski conditions analyst. 
Given raw SLF avalanche bulletin text, produce a structured daily briefing.
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
    "summitTemp":    "e.g. −12°C",
    "midTemp":       "e.g. −6°C",
    "resortTemp":    "e.g. −1°C",
    "freezingLevel": "e.g. ~1000m",
    "wind":          "e.g. Storm NNW 80 km/h",
    "visibility":    "e.g. Poor — heavy snowfall",
    "newSnow24h":    "e.g. 40–60 cm",
    "baseDepth":     "e.g. 200–240 cm (upper mountain)"
  }
}`

export async function analyseBulletin(
  bulletinText: string,
  styles: SkiStyle[],
  regionName: string,
): Promise<BulletinAnalysis> {
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const styleNote = styles.length
    ? `The subscriber is interested in: ${styles.join(', ')}.`
    : ''

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Today is ${today}. Region: ${regionName}. ${styleNote}

Bulletin data:
${bulletinText}

Respond with JSON only.`,
    }],
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
