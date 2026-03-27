/**
 * GET /api/confirm?token=<token>
 *
 * Confirms a subscriber's email address after they click the link in their
 * confirmation email.
 *
 * - Looks up the subscriber by their unique `unsubscribe_token`
 * - Sets `confirmed = true` on the matching row in the `subscribers` table
 * - Redirects to /?confirmed=true on success so the sign-up page can show
 *   a confirmation message
 * - Redirects to /?error=confirm_failed if the token is not found or the
 *   database update fails
 *
 * Unconfirmed subscribers are never included in the cron job send runs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/?error=invalid_token', req.url))
  }

  const { error } = await supabaseAdmin
    .from('subscribers')
    .update({ confirmed: true })
    .eq('unsubscribe_token', token)

  if (error) {
    console.error('Confirm error:', error)
    return NextResponse.redirect(new URL('/?error=confirm_failed', req.url))
  }

  return NextResponse.redirect(new URL('/?confirmed=true', req.url))
}
