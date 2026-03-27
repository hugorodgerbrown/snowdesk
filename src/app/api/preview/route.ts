/**
 * GET /api/preview
 *
 * Returns a pre-computed BulletinAnalysis for Verbier / Haut Val de Bagnes
 * (region 4116), used to populate the live bulletin preview card on the
 * sign-up page.
 *
 * Cache strategy (two layers):
 *   1. Supabase — the cron job writes a fresh analysis to the `bulletin_previews`
 *      table at 08:15 and 17:15 CET, immediately after each SLF bulletin update.
 *      This route reads from there first, returning the cached row with a
 *      { source: "cache" } flag so the client knows the data is pre-computed.
 *   2. Live fallback — if the table is empty (e.g. before the cron has ever run),
 *      this route fetches the bulletin from the SLF API, calls Claude to analyse
 *      it, writes the result to `bulletin_previews` for next time, and returns
 *      { source: "live" }. This should only happen once on a fresh deployment.
 *
 * HTTP caching: responses carry Cache-Control: public, s-maxage=300 so Vercel's
 * CDN caches the response for 5 minutes between cron runs.
 *
 * To seed the cache before the first cron run, trigger /api/cron/send manually:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" https://your-app.vercel.app/api/cron/send
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchBulletinForSubscriber } from '@/lib/bulletin'
import { analyseBulletin } from '@/lib/analyse'

// No Next.js revalidation — freshness is controlled by the cron job writing to the DB
export const revalidate = 0

export async function GET() {
  // 1. Try the cache first
  const { data: cached, error } = await supabaseAdmin
    .from('bulletin_previews')
    .select('analysis, cached_at')
    .eq('region_code', '4116')
    .order('cached_at', { ascending: false })
    .limit(1)
    .single()

  if (!error && cached?.analysis) {
    return NextResponse.json(
      { analysis: cached.analysis, cached_at: cached.cached_at, source: 'cache' },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  }

  // 2. Cache miss — fetch live and populate the cache for next time
  console.log('[api/preview] Cache miss, fetching live bulletin...')
  try {
    const { bulletin } = await fetchBulletinForSubscriber('verbier', '4116')

    const analysis = await analyseBulletin(
      bulletin,
      ['piste', 'offpiste', 'touring'],
      'Haut Val de Bagnes (4116)',
    )

    // Write to cache so subsequent visitors don't trigger a live fetch
    await supabaseAdmin
      .from('bulletin_previews')
      .upsert({ region_code: '4116', analysis, cached_at: new Date().toISOString() })

    return NextResponse.json(
      { analysis, source: 'live' },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  } catch (err) {
    console.error('[api/preview] Live fetch failed:', err)
    return NextResponse.json({ error: 'Failed to load bulletin' }, { status: 500 })
  }
}
