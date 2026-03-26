import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchBulletinForSubscriber } from '@/lib/bulletin'
import { analyseBulletin } from '@/lib/analyse'
import { sendBriefingEmail } from '@/lib/email'
import { REGION_MAP, type Subscriber } from '@/types'

// Vercel calls this endpoint on the cron schedule defined in vercel.json.
// It also accepts a CRON_SECRET header so you can trigger it manually.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Determine which delivery slot is running now (morning or evening)
  const hour = new Date().getUTCHours() // 7 = morning slot, 16 = evening slot
  const slot: 'morning' | 'evening' = hour < 12 ? 'morning' : 'evening'

  console.log(`[cron/send] Running ${slot} slot at ${new Date().toISOString()}`)

  // Fetch all confirmed subscribers who should receive this slot
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
    return NextResponse.json({ sent: 0, slot })
  }

  // Group subscribers by region_area + region_code to batch bulletin fetches
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

  // Process each unique region
  for (const [, group] of regionGroups) {
    let bulletinText: string
    let regionName: string

    try {
      const result = await fetchBulletinForSubscriber(group.areaKey, group.regionCode)
      bulletinText = result.text

      const regionEntries = REGION_MAP[group.areaKey] ?? []
      const match = regionEntries.find(([code]) => code === group.regionCode)
      regionName = match ? `${match[1]} (${match[0]})` : group.areaKey
    } catch (err) {
      console.error(`[cron/send] Failed to fetch bulletin for ${group.areaKey}:`, err)
      errors += group.subscribers.length
      continue
    }

    // Send to each subscriber in this region
    for (const subscriber of group.subscribers) {
      try {
        const analysis = await analyseBulletin(bulletinText, subscriber.styles, regionName)
        await sendBriefingEmail(subscriber, analysis, regionName)

        // Log the send
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
