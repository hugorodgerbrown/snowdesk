/**
 * GET /unsubscribe?token=<token>
 *
 * Handles one-click unsubscribes from the footer link in every briefing email.
 *
 * - Looks up the subscriber by their unique `unsubscribe_token`
 * - Permanently deletes the row from the `subscribers` table
 * - Redirects to /?unsubscribed=true on success
 * - Redirects to /?error=unsub_failed if the token is not found or the
 *   delete fails
 *
 * The unsubscribe_token is the same token used for email confirmation —
 * it is included in the footer of every briefing email so users can
 * unsubscribe without logging in.
 *
 * Note: deletion is permanent. If a user wants to resubscribe they must
 * sign up again via the sign-up page.
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
    .delete()
    .eq('unsubscribe_token', token)

  if (error) {
    console.error('Unsubscribe error:', error)
    return NextResponse.redirect(new URL('/?error=unsub_failed', req.url))
  }

  return NextResponse.redirect(new URL('/?unsubscribed=true', req.url))
}
