/**
 * GET /api/cron/send
 *
 * The daily send job. Runs twice a day via Vercel's cron scheduler:
 *   - 07:15 UTC (08:15 CET) — morning slot, 15 minutes after the SLF bulletin updates
 *   - 16:15 UTC (17:15 CET) — evening slot, 15 minutes after the SLF bulletin updates
 *
 * Can also be triggered manually for testing:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" https://your-app.vercel.app/api/cron/send
 *
 * Authentication: requires an Authorization: Bearer <CRON_SECRET> header.
 * Returns 401 if the header is missing or the secret does not match.
 *
 * What it does, in order:
 *   1. Determines the current slot (morning or evening) based on UTC hour
 *   2. Warms the `bulletin_previews` cache for Verbier region 4116 — always,
 *      regardless of whether there are any subscribers, so the sign-up page
 *      preview card is always up to date
 *   3. Fetches all confirmed subscribers whose delivery preference matches
 *      the current slot (delivery = slot OR delivery = 'both')
 *   4. Groups subscribers by region to avoid fetching the same bulletin twice
 *   5. For each region group:
 *        a. Fetches the bulletin PDF text from the SLF API (aws.slf.ch)
 *        b. Calls Claude once to produce a base analysis, writes it to
 *           `bulletin_previews` for that region
 *        c. For each subscriber in the group, re-calls Claude with their
 *           specific skiing styles for a personalised analysis, sends the
 *           briefing email via Resend, and logs the send to `send_log`
 *   6. Returns a summary: { sent, errors, slot }
 *
 * The send_log table records every successful send. It can be used to debug
 * delivery issues and to detect duplicate sends (though the job itself does
 * not currently deduplicate — running it twice in the same slot will send
 * duplicate emails).
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchBulletinForSubscriber } from '@/lib/bulletin'
import { analyseBulletin } from '@/lib/analyse'
import { sendBriefingEmail } from '@/lib/email'
import { REGION_MAP, type Subscriber } from '@/types'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hour = new Date().getUTCHours()
  const slot: 'morning' | 'evening' = hour < 12 ? 'morning' : 'evening'

  console.log(`[cron/send] Running ${slot} slot at ${new Date().toISOString()}`)

  // Always warm the preview cache for Verbier 4116, even if there are no subscribers
  await warmPreviewCache('verbier', '4116')

  const { data: subscribers, error } = await supabaseAdmin
    .from('subscribers')
    .select('*')
    .eq('confirmed', true)
    .or(`delivery.eq.${slot},delivery.eq.both`)

  if (error) {
    console.error('[cron/send] Failed to fetch subscribers:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!subscribers?.length) {
    console.log('[cron/send] No subscribers for this slot')
    return NextResponse.json({ sent: 0, slot })
  }

  // Group subscribers by region to batch bulletin fetches
  const regionGroups = new Map<string, { subscribers: Subscriber[]; regionCode: string; areaKey: string }>()

  for (const sub of subscribers as Subscriber[]) {
    const regions = REGION_MAP[sub.region_area]
    const code = sub.region_code ?? regions?.[0]?.[0] ?? sub.region_area
    const key = `${sub.region_area}::${code}`
    if (!regionGroups.has(key)) {
      regionGroups.set(key, { subscribers: [], regionCode: code, areaKey: sub.region_area })
    }
    regionGroups.get(key)!.subscribers.push(sub)
  }

  let sent = 0
  let errors = 0

  for (const [, group] of regionGroups) {
    let bulletin: Awaited<ReturnType<typeof fetchBulletinForSubscriber>>['bulletin']
    let regionName: string

    try {
      const result = await fetchBulletinForSubscriber(group.areaKey, group.regionCode)
      bulletin = result.bulletin

      const regionEntries = REGION_MAP[group.areaKey] ?? []
      const match = regionEntries.find(([code]) => code === group.regionCode)
      regionName = match ? `${match[1]} (${match[0]})` : group.areaKey
    } catch (err) {
      console.error(`[cron/send] Failed to fetch bulletin for ${group.areaKey}:`, err)
      errors += group.subscribers.length
      continue
    }

    // Analyse once per region, then reuse for all subscribers in that region
    let cachedAnalysis: Awaited<ReturnType<typeof analyseBulletin>> | null = null

    for (const subscriber of group.subscribers) {
      try {
        // Analyse once per region group — re-use for subsequent subscribers in same region
        if (!cachedAnalysis) {
          cachedAnalysis = await analyseBulletin(bulletin, ['piste', 'offpiste', 'touring'], regionName)

          // Write to preview cache so /api/preview doesn't need to call Claude live
          await supabaseAdmin
            .from('bulletin_previews')
            .upsert({
              region_code: group.regionCode,
              analysis: cachedAnalysis,
              cached_at: new Date().toISOString(),
            })
          console.log(`[cron/send] Preview cache updated for region ${group.regionCode}`)
        }

        // Re-analyse with subscriber-specific styles for personalised email
        const personalAnalysis = await analyseBulletin(bulletin, subscriber.styles, regionName)
        await sendBriefingEmail(subscriber, personalAnalysis, regionName)

        await supabaseAdmin.from('send_log').insert({
          subscriber_id: subscriber.id,
          region_code: group.regionCode,
          send_slot: slot,
        })

        sent++
        console.log(`[cron/send] Sent to ${subscriber.email} (${regionName})`)
      } catch (err) {
        console.error(`[cron/send] Failed for ${subscriber.email}:`, err)
        errors++
      }
    }
  }

  console.log(`[cron/send] Done. Sent: ${sent}, Errors: ${errors}`)
  return NextResponse.json({ sent, errors, slot })
}

// Fetches and caches a fresh analysis for a region — used to warm the preview cache
// even when there are no subscribers for that region
async function warmPreviewCache(areaKey: string, regionCode: string) {
  try {
    const { bulletin } = await fetchBulletinForSubscriber(areaKey, regionCode)
    const regionEntries = REGION_MAP[areaKey] ?? []
    const match = regionEntries.find(([code]) => code === regionCode)
    const regionName = match ? `${match[1]} (${match[0]})` : areaKey

    const analysis = await analyseBulletin(bulletin, ['piste', 'offpiste', 'touring'], regionName)

    await supabaseAdmin
      .from('bulletin_previews')
      .upsert({ region_code: regionCode, analysis, cached_at: new Date().toISOString() })

    console.log(`[cron/send] Warmed preview cache for ${regionCode}`)
  } catch (err) {
    // Non-fatal — don't let a cache warm failure stop the email sends
    console.error(`[cron/send] Failed to warm preview cache for ${regionCode}:`, err)
  }
}
