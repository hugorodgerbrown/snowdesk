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
