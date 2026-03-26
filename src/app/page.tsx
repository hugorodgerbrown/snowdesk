'use client'

import { useState } from 'react'
import { REGION_MAP } from '@/types'

const AREA_LABELS: Record<string, string> = {
  verbier: 'Verbier / 4 Vallées',
  zermatt: 'Zermatt / Saas Fee',
  crans: 'Crans-Montana',
  saas: 'Saas / Simplon',
  obergoms: 'Obergoms / Aletsch',
  grindelwald: 'Grindelwald / Jungfrau',
  adelboden: 'Adelboden / Lenk',
  gstaad: 'Gstaad',
  kandersteg: 'Kandersteg',
  davos: 'Davos / Klosters',
  stmoritz: 'St. Moritz / Engadine',
  laax: 'Laax / Flims',
  arosa: 'Arosa / Lenzerheide',
  andermatt: 'Andermatt / Sedrun',
  engelberg: 'Engelberg',
  lugano: 'Lugano area',
  leventina: 'Leventina / Blenio',
}

const AREA_GROUPS: Record<string, string[]> = {
  'Valais':                 ['verbier','zermatt','crans','saas','obergoms'],
  'Bernese Alps':           ['grindelwald','adelboden','gstaad','kandersteg'],
  'Grisons':                ['davos','stmoritz','laax','arosa'],
  'Central Switzerland':    ['andermatt','engelberg'],
  'Ticino / Southern Alps': ['lugano','leventina'],
}

export default function Home() {
  const [email, setEmail]           = useState('')
  const [area, setArea]             = useState('')
  const [code, setCode]             = useState('')
  const [styles, setStyles]         = useState<string[]>(['piste'])
  const [delivery, setDelivery]     = useState('morning')
  const [status, setStatus]         = useState<'idle'|'submitting'|'done'|'error'>('idle')
  const [errorMsg, setErrorMsg]     = useState('')

  const subRegions = area ? REGION_MAP[area] ?? [] : []

  const toggleStyle = (s: string) =>
    setStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !area || !styles.length) return
    setStatus('submitting')
    setErrorMsg('')

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, region_area: area, region_code: code || null, styles, delivery }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Subscription failed')
      }
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  const deliveryLabel = delivery === 'both' ? '08:15 and 17:15 CET'
    : delivery === 'morning' ? '08:15 CET' : '17:15 CET'

  // Inject the static HTML page (from public/signup.html) via an iframe,
  // or render the React form below. Using the React form keeps state in one place.
  return (
    <>
      {/* The full styled page is in public/index.html — swap to that for production
          or convert it to a proper React component. This minimal form is the 
          functional wiring you need. */}
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px', fontFamily: 'Georgia, serif' }}>
        <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase' }}>SnowDesk</p>
        <h1 style={{ fontSize: 36, fontWeight: 700, margin: '8px 0 8px' }}>Know before you drop in.</h1>
        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.8, marginBottom: 32 }}>
          Daily avalanche briefings for the Swiss Alps — sourced from the SLF bulletin, tailored to your skiing style.
        </p>

        {status === 'done' ? (
          <div style={{ padding: '28px 24px', border: '1px solid #c5b9a8', borderRadius: 3, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>You&apos;re subscribed.</h2>
            <p style={{ fontSize: 14, color: '#555' }}>Check your inbox for a confirmation. Your first briefing arrives at {deliveryLabel}.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#888' }}>Email address</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
                style={{ padding: '10px 12px', border: '1px solid #c5b9a8', borderRadius: 2, fontSize: 14, fontFamily: 'Georgia, serif' }} />
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#888' }}>Region</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <select value={area} onChange={e => { setArea(e.target.value); setCode('') }} required
                  style={{ padding: '10px 12px', border: '1px solid #c5b9a8', borderRadius: 2, fontSize: 13, fontFamily: 'Georgia, serif' }}>
                  <option value="" disabled>Select area</option>
                  {Object.entries(AREA_GROUPS).map(([group, areas]) => (
                    <optgroup key={group} label={group}>
                      {areas.map(a => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
                    </optgroup>
                  ))}
                </select>
                <select value={code} onChange={e => setCode(e.target.value)} disabled={!subRegions.length}
                  style={{ padding: '10px 12px', border: '1px solid #c5b9a8', borderRadius: 2, fontSize: 13, fontFamily: 'Georgia, serif' }}>
                  <option value="">Sub-region (optional)</option>
                  {subRegions.map(([val, label]) => <option key={val} value={val}>{label} ({val})</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#888' }}>Skiing style</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[['piste','⛷','On-piste'],['offpiste','🌨','Off-piste'],['touring','🎿','Ski touring']].map(([val, icon, label]) => (
                  <button key={val} type="button" onClick={() => toggleStyle(val)}
                    style={{ padding: '12px 8px', border: `1px solid ${styles.includes(val) ? '#2d4a3e' : '#c5b9a8'}`, borderRadius: 2, background: styles.includes(val) ? '#2d4a3e' : 'rgba(255,255,255,0.4)', color: styles.includes(val) ? '#fff' : '#4a4035', cursor: 'pointer', fontSize: 13 }}>
                    <div style={{ fontSize: 18 }}>{icon}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#888' }}>Delivery</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[['morning','08:15 CET','Morning only','Start your day'],['evening','17:15 CET','Evening only','Plan tomorrow'],['both','08:15 + 17:15','Both','Full coverage']].map(([val, time, name, desc]) => (
                  <button key={val} type="button" onClick={() => setDelivery(val)}
                    style={{ padding: '12px 10px', border: `1px solid ${delivery === val ? '#2d4a3e' : '#c5b9a8'}`, borderRadius: 2, background: delivery === val ? '#2d4a3e' : 'rgba(255,255,255,0.4)', color: delivery === val ? '#fff' : '#4a4035', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{time}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 }}>{name}</div>
                    <div style={{ fontSize: 10, marginTop: 2, opacity: 0.75 }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {status === 'error' && (
              <p style={{ color: '#b91c1c', fontSize: 13 }}>⚠ {errorMsg}</p>
            )}

            <button type="submit" disabled={status === 'submitting'}
              style={{ padding: '13px 28px', background: '#1a1612', color: '#f5f0e8', border: 'none', borderRadius: 2, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', alignSelf: 'flex-start' }}>
              {status === 'submitting' ? 'Subscribing...' : 'Start my briefings →'}
            </button>

          </form>
        )}
      </main>
    </>
  )
}
