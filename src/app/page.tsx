'use client'

import { useState, useRef } from 'react'
import LivePreview from './LivePreview'

const REGION_CODES: Record<string, [string, string][]> = {
  verbier:     [['4115','Martigny–Verbier'],['4116','Haut Val de Bagnes']],
  zermatt:     [['4222','Zermatt'],['4223','Saas Fee'],['4224','Monte Rosa']],
  crans:       [['4121','Montana'],['4124',"Val d'Anniviers"]],
  saas:        [['4231','N. Simplon'],['4232','S. Simplon']],
  obergoms:    [['4241','Reckingen'],['4243','N. Obergoms'],['4244','S. Obergoms']],
  grindelwald: [['1242','Grindelwald'],['1234','Jungfrau–Schilthorn'],['1233','Lauterbrunnen']],
  adelboden:   [['1226','Adelboden'],['1224','Lenk'],['1227','Engstligen']],
  gstaad:      [['1222','Gstaad'],['1223','Wildhorn']],
  kandersteg:  [['1231','Kandersteg'],['1232','Blüemlisalp']],
  davos:       [['5123','Davos'],['5122','Schanfigg'],['5111','N. Prättigau']],
  stmoritz:    [['7114','St Moritz'],['7111','Corvatsch'],['7112','Bernina']],
  laax:        [['5124','Flims'],['5214','Obersaxen–Safien']],
  arosa:       [['5221','Domleschg–Lenzerheide'],['5231','Albulatal']],
  andermatt:   [['2223','N. Urseren'],['2224','S. Urseren'],['2221','Meiental']],
  engelberg:   [['2122','Engelberg'],['2121','Glaubenberg']],
  lugano:      [['6131','Lugano area'],['6132','Mendrisio']],
  leventina:   [['6112','Upper Leventina'],['6113','Val Blenio']],
}

type Status = 'idle' | 'submitting' | 'done' | 'error'

export default function Home() {
  const [area, setArea]         = useState('')
  const [subCode, setSubCode]   = useState('')
  const [styles, setStyles]     = useState<string[]>(['piste'])
  const [delivery, setDelivery] = useState('morning')
  const [status, setStatus]     = useState<Status>('idle')
  const [successTime, setSuccessTime] = useState('08:15 CET')
  const emailRef = useRef<HTMLInputElement>(null)

  const subRegions = area ? (REGION_CODES[area] ?? []) : []

  const toggleStyle = (s: string) =>
    setStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = emailRef.current?.value.trim() ?? ''
    if (!email || !area) return
    setStatus('submitting')

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, region_area: area, region_code: subCode || null, styles, delivery }),
      })
      if (!res.ok) throw new Error('failed')
      const timeLabel =
        delivery === 'morning' ? '08:15 CET' :
        delivery === 'evening' ? '17:15 CET' :
        '08:15 and 17:15 CET'
      setSuccessTime(timeLabel)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      <svg className="mountain-bg" viewBox="0 0 1440 260" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="M0,260 L0,180 L80,140 L140,165 L200,100 L280,130 L340,60 L420,100 L500,40 L560,80 L620,30 L700,70 L760,20 L820,55 L880,10 L940,50 L1000,80 L1060,35 L1120,70 L1180,45 L1260,90 L1320,60 L1380,100 L1440,80 L1440,260 Z" fill="var(--ink)"/>
        <path d="M0,260 L0,210 L100,185 L180,200 L260,160 L340,175 L400,140 L480,160 L560,120 L640,145 L720,110 L800,135 L860,105 L940,130 L1020,145 L1100,115 L1180,140 L1260,155 L1340,135 L1440,150 L1440,260 Z" fill="var(--ink)" opacity="0.5"/>
      </svg>

      <div className="page">
        <header className="masthead">
          <span className="masthead-logo">SnowDesk</span>
          <span className="masthead-tag">Daily avalanche briefings · Swiss Alps</span>
        </header>

        <section className="hero">
          <p className="hero-kicker">Free daily briefing</p>
          <h1 className="hero-headline">Know before<br />you <em>drop in.</em></h1>
          <p className="hero-sub">Every morning, a concise avalanche briefing for your region — sourced directly from the SLF bulletin, analysed for your style of skiing.</p>
          <div className="sample-strip">
            <span className="sample-pill pill-safe"><span className="pill-dot" />Level 1–2 · Go</span>
            <span className="sample-pill pill-warn"><span className="pill-dot" />Level 3 · Caution</span>
            <span className="sample-pill pill-danger"><span className="pill-dot" />Level 4–5 · Avoid backcountry</span>
          </div>
        </section>

        <LivePreview />

        <div className="divider">
          <span className="divider-line" />
          <span className="divider-text">Subscribe</span>
          <span className="divider-line" />
        </div>

        <div className="form-wrap">
          {status === 'done' ? (
            <div className="success-panel visible">
              <span className="success-mark">✓</span>
              <h2 className="success-headline">You&apos;re subscribed.</h2>
              <p className="success-sub">Check your inbox for a confirmation.<br />Your first briefing arrives tomorrow at <strong>{successTime}</strong>.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>

              <div className="form-row">
                <label className="form-label" htmlFor="email">Email address</label>
                <input type="email" id="email" ref={emailRef} placeholder="you@example.com" required autoComplete="email" />
              </div>

              <div className="form-row">
                <label className="form-label">Region</label>
                <p className="form-hint">Choose the area you ski most. You can add more regions later.</p>
                <div className="region-group">
                  <div className="select-wrap">
                    <select value={area} onChange={e => { setArea(e.target.value); setSubCode('') }} required>
                      <option value="" disabled>Select area</option>
                      <optgroup label="Valais">
                        <option value="verbier">Verbier / 4 Vallées</option>
                        <option value="zermatt">Zermatt / Saas Fee</option>
                        <option value="crans">Crans-Montana</option>
                        <option value="saas">Saas Grund / Simplon</option>
                        <option value="obergoms">Obergoms / Aletsch</option>
                      </optgroup>
                      <optgroup label="Bernese Alps">
                        <option value="grindelwald">Grindelwald / Jungfrau</option>
                        <option value="adelboden">Adelboden / Lenk</option>
                        <option value="gstaad">Gstaad</option>
                        <option value="kandersteg">Kandersteg</option>
                      </optgroup>
                      <optgroup label="Grisons">
                        <option value="davos">Davos / Klosters</option>
                        <option value="stmoritz">St. Moritz / Engadine</option>
                        <option value="laax">Laax / Flims</option>
                        <option value="arosa">Arosa / Lenzerheide</option>
                      </optgroup>
                      <optgroup label="Central Switzerland">
                        <option value="andermatt">Andermatt / Sedrun</option>
                        <option value="engelberg">Engelberg</option>
                      </optgroup>
                      <optgroup label="Ticino / Southern Alps">
                        <option value="lugano">Lugano area</option>
                        <option value="leventina">Leventina / Blenio</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="select-wrap">
                    <select value={subCode} onChange={e => setSubCode(e.target.value)} disabled={subRegions.length === 0}>
                      <option value="">Sub-region (optional)</option>
                      {subRegions.map(([val, label]) => (
                        <option key={val} value={val}>{label} ({val})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">Your skiing style</label>
                <p className="form-hint">Select all that apply — your briefing will be tailored accordingly.</p>
                <div className="tile-group">
                  {[['piste','⛷','On-piste'],['offpiste','🌨','Off-piste / powder'],['touring','🎿','Ski touring']].map(([val,icon,name]) => (
                    <div key={val} className="tile">
                      <input type="checkbox" id={`style_${val}`} value={val} checked={styles.includes(val)} onChange={() => toggleStyle(val)} />
                      <label htmlFor={`style_${val}`}>
                        <span className="tile-icon">{icon}</span>
                        <span className="tile-name">{name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">Delivery</label>
                <p className="form-hint">The SLF bulletin publishes at 08:00 and 17:00 CET. Your briefing arrives 15 minutes after each update.</p>
                <div className="delivery-tile-group">
                  {[
                    ['morning','08:15 CET','Morning only','Start your day with the latest bulletin'],
                    ['evening','17:15 CET','Evening only',"Plan tomorrow's skiing the night before"],
                    ['both','08:15 + 17:15','Both','Morning update and evening forecast'],
                  ].map(([val,time,name,desc]) => (
                    <div key={val} className="delivery-tile">
                      <input type="radio" id={`delivery_${val}`} name="delivery" value={val} checked={delivery === val} onChange={() => setDelivery(val)} />
                      <label htmlFor={`delivery_${val}`}>
                        <span className="delivery-tile-time">{time}</span>
                        <span className="delivery-tile-name">{name}</span>
                        <span className="delivery-tile-desc">{desc}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {status === 'error' && (
                <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>⚠ Something went wrong — please try again.</p>
              )}

              <div className="submit-row">
                <button type="submit" className="submit-btn" disabled={status === 'submitting'}>
                  {status === 'submitting' ? 'Subscribing...' : 'Start my briefings →'}
                </button>
                <p className="submit-note">Free forever. One email per day. Unsubscribe in a single click.</p>
              </div>
            </form>
          )}
        </div>

        <footer className="site-footer">
          <span className="footer-copy">© {new Date().getFullYear()} SnowDesk</span>
          <span className="footer-source">Data: SLF / WSL Institute · whiterisk.ch · aws.slf.ch</span>
        </footer>
      </div>
    </>
  )
}
