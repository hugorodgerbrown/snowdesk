/**
 * SnowDesk — end-to-end email test script
 *
 * Runs the full bulletin fetch → Claude analysis → email send pipeline
 * without touching the database or cron endpoint.
 *
 * Usage:
 *   npx tsx scripts/test-email.ts
 *
 * Options (set as env vars or edit the CONFIG block below):
 *   TEST_EMAIL      recipient address (defaults to your Gmail)
 *   TEST_REGION     area slug (defaults to "verbier")
 *   TEST_CODE       SLF region code (defaults to "4116")
 *   TEST_STYLES     comma-separated styles (defaults to "piste,offpiste,touring")
 *   TEST_DELIVERY   "morning" | "evening" | "both" (defaults to "morning")
 */

import * as fs from 'fs'
import * as path from 'path'

// Load .env.local manually — no dotenv dependency required
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
}
loadEnv()

import { fetchStructuredBulletin } from '../src/lib/bulletin'
import { analyseBulletin } from '../src/lib/analyse'
import { sendBriefingEmail } from '../src/lib/email'
import type { Subscriber, SkiStyle, DeliveryPreference } from '../src/types'

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  email:    process.env.TEST_EMAIL    ?? 'hugorodgerbrown@gmail.com',
  area:     process.env.TEST_REGION   ?? 'verbier',
  code:     process.env.TEST_CODE     ?? '4116',
  styles:  (process.env.TEST_STYLES   ?? 'piste,offpiste,touring').split(',') as SkiStyle[],
  delivery: (process.env.TEST_DELIVERY ?? 'morning') as DeliveryPreference,
}
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n━━━ SnowDesk email test ━━━')
  console.log(`  Recipient : ${CONFIG.email}`)
  console.log(`  Area      : ${CONFIG.area}`)
  console.log(`  Region    : ${CONFIG.code}`)
  console.log(`  Styles    : ${CONFIG.styles.join(', ')}`)
  console.log(`  Delivery  : ${CONFIG.delivery}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Check required env vars
  const required = ['ANTHROPIC_API_KEY', 'RESEND_API_KEY', 'RESEND_FROM_ADDRESS', 'NEXT_PUBLIC_APP_URL']
  const missing = required.filter(k => !process.env[k])
  if (missing.length) {
    console.error(`✗ Missing environment variables: ${missing.join(', ')}`)
    console.error('  Make sure .env.local is in the project root.\n')
    process.exit(1)
  }

  // Step 1: fetch structured bulletin from GeoJSON API
  console.log('1. Fetching bulletin from SLF GeoJSON API...')
  let bulletin: Awaited<ReturnType<typeof fetchStructuredBulletin>>
  try {
    bulletin = await fetchStructuredBulletin(CONFIG.code)
    console.log(`   ✓ Region   : ${bulletin.regionName}`)
    console.log(`   ✓ Published: ${bulletin.publicationTime}`)
    console.log(`   ✓ Valid    : ${bulletin.validFrom} → ${bulletin.validUntil}`)
    console.log(`   ✓ Danger   : ${bulletin.dangerRatings.map(d => `${d.level}${d.subdivision ? ` (${d.subdivision})` : ''}`).join(', ')}`)
    console.log(`   ✓ Problems : ${bulletin.avalancheProblems.map(p => p.type).join(', ') || 'none'}`)
    console.log()
  } catch (err) {
    console.error('   ✗ Failed to fetch bulletin:', err)
    process.exit(1)
  }

  // Step 2: analyse with Claude
  console.log('2. Sending to Claude for analysis...')
  let analysis: Awaited<ReturnType<typeof analyseBulletin>>
  try {
    const regionName = `${bulletin.regionName} (${CONFIG.code})`
    analysis = await analyseBulletin(bulletin, CONFIG.styles, regionName)
    console.log(`   ✓ Verdict    : ${analysis.overallVerdict} (${analysis.dangerLevel})`)
    console.log(`   ✓ On-piste   : ${analysis.onPiste.rating}`)
    console.log(`   ✓ Off-piste  : ${analysis.offPiste.rating}`)
    console.log(`   ✓ Ski touring: ${analysis.skiTouring.rating}`)
    console.log(`   ✓ Summit temp: ${analysis.weather.summitTemp}`)
    console.log(`   ✓ Wind       : ${analysis.weather.wind}`)
    console.log()
  } catch (err) {
    console.error('   ✗ Claude analysis failed:', err)
    process.exit(1)
  }

  // Step 3: send email
  console.log(`3. Sending email to ${CONFIG.email}...`)
  const testSubscriber: Subscriber = {
    id: 'test-' + Date.now(),
    email: CONFIG.email,
    region_area: CONFIG.area,
    region_code: CONFIG.code,
    styles: CONFIG.styles,
    delivery: CONFIG.delivery,
    confirmed: true,
    unsubscribe_token: 'test-unsubscribe-token-do-not-use',
    created_at: new Date().toISOString(),
  }

  try {
    await sendBriefingEmail(testSubscriber, analysis, `${bulletin.regionName} (${CONFIG.code})`)
    console.log('   ✓ Email sent successfully\n')
  } catch (err) {
    console.error('   ✗ Failed to send email:', err)
    process.exit(1)
  }

  console.log('━━━ Done — check your inbox ━━━\n')
}

main().catch(err => {
  console.error('\nUnexpected error:', err)
  process.exit(1)
})
