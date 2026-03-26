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
