import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { REGION_MAP } from '@/types'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://snowdesk.co'
const FROM = process.env.RESEND_FROM_ADDRESS ?? 'briefings@snowdesk.co'

// Input validation schema
const SubscribeSchema = z.object({
  email: z.string().email(),
  region_area: z.string().refine(v => v in REGION_MAP, {
    message: 'Unknown region area',
  }),
  region_code: z.string().nullable().optional(),
  styles: z.array(z.enum(['piste', 'offpiste', 'touring'])).min(1),
  delivery: z.enum(['morning', 'evening', 'both']),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = SubscribeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { email, region_area, region_code, styles, delivery } = parsed.data

    // Upsert subscriber (update if email+region_area already exists)
    const { data: subscriber, error } = await supabaseAdmin
      .from('subscribers')
      .upsert(
        { email, region_area, region_code: region_code ?? null, styles, delivery, confirmed: false },
        { onConflict: 'email,region_area', ignoreDuplicates: false }
      )
      .select('id, unsubscribe_token')
      .single()

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Send confirmation email
    const confirmUrl = `${APP_URL}/api/confirm?token=${subscriber.unsubscribe_token}`
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Confirm your SnowDesk subscription',
      html: confirmationEmailHTML(confirmUrl, region_area, delivery),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Subscribe error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function confirmationEmailHTML(confirmUrl: string, region: string, delivery: string): string {
  const deliveryLabel = delivery === 'both'
    ? '08:15 and 17:15 CET'
    : delivery === 'morning' ? '08:15 CET' : '17:15 CET'

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Georgia,serif;background:#f8f7f4;color:#1a1a1a;padding:32px 24px;max-width:480px;margin:0 auto">
  <p style="font-family:monospace;font-size:11px;color:#999;letter-spacing:0.1em;text-transform:uppercase">SnowDesk</p>
  <h2 style="font-size:22px;font-weight:700;margin:8px 0 16px">Confirm your subscription</h2>
  <p style="font-size:14px;line-height:1.8;color:#444">
    You signed up for daily avalanche briefings for <strong>${region}</strong>, 
    delivered at <strong>${deliveryLabel}</strong>.
  </p>
  <p style="font-size:14px;line-height:1.8;color:#444">
    Click below to confirm your email address and activate your subscription:
  </p>
  <a href="${confirmUrl}" style="display:inline-block;background:#2d4a3e;color:#fff;padding:12px 28px;border-radius:2px;font-family:monospace;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;margin:8px 0 24px">
    Confirm subscription →
  </a>
  <p style="font-size:12px;color:#aaa;border-top:1px solid #ddd;padding-top:16px;font-family:monospace">
    If you didn't sign up for SnowDesk, ignore this email.
  </p>
</body></html>`
}
