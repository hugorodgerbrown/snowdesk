'use client'

import { useEffect, useState } from 'react'
import type { BulletinAnalysis } from '@/types'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; analysis: BulletinAnalysis }

const VERDICT_CLASS: Record<string, string> = {
  green: 'verdict-green',
  amber: 'verdict-amber',
  red:   'verdict-red',
}

const RATING_CLASS: Record<string, string> = {
  Excellent: 'good', Epic: 'good', Ideal: 'good', Good: 'good',
  Fair: 'risky', Acceptable: 'risky', 'Experts Only': 'risky',
  Risky: 'risky',
  'Very Risky': 'avoid', Avoid: 'avoid', Closed: 'avoid',
}

const WIND_WARN = ['storm','strong','gust','force']
const VIS_WARN  = ['poor','low','limited','fog','whiteout','heavy']

function isWarn(s: string) {
  const lower = s.toLowerCase()
  return WIND_WARN.some(w => lower.includes(w)) || VIS_WARN.some(w => lower.includes(w))
}

export default function LivePreview() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    fetch('/api/preview')
      .then(r => r.json())
      .then(data => {
        if (data.analysis) setState({ status: 'ok', analysis: data.analysis })
        else setState({ status: 'error' })
      })
      .catch(() => setState({ status: 'error' }))
  }, [])

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })
  const slotStr = now.getUTCHours() < 12 ? '08:15 CET' : '17:15 CET'

  if (state.status === 'loading') {
    return (
      <div className="preview-strip">
        <p className="preview-label">Live bulletin · Verbier / Haut Val de Bagnes</p>
        <div className="preview-card preview-card--loading">
          <div className="preview-skeleton preview-skeleton--title" />
          <div className="preview-skeleton preview-skeleton--sub" />
          <div className="preview-skeleton-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="preview-skeleton preview-skeleton--cell" />
            ))}
          </div>
          <div className="preview-skeleton preview-skeleton--row" />
          <div className="preview-skeleton preview-skeleton--row" />
          <div className="preview-skeleton preview-skeleton--row" />
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="preview-strip">
        <p className="preview-label">Live bulletin · Verbier / Haut Val de Bagnes</p>
        <div className="preview-card preview-card--error">
          <span className="preview-error-icon">⚠</span>
          <p className="preview-error-msg">Could not load today&apos;s bulletin. <a href="https://whiterisk.ch" target="_blank" rel="noopener noreferrer">Check whiterisk.ch →</a></p>
        </div>
      </div>
    )
  }

  const { analysis: d } = state
  const verdictClass = VERDICT_CLASS[d.verdictColour] ?? 'verdict-amber'

  const weatherCells = [
    { val: d.weather.summitTemp,    key: 'summit',              warn: false },
    { val: d.weather.midTemp,       key: 'mid-mountain',        warn: false },
    { val: d.weather.resortTemp,    key: 'resort',              warn: false },
    { val: d.weather.freezingLevel, key: 'freezing level',      warn: false },
    { val: d.weather.wind,          key: 'wind',                warn: isWarn(d.weather.wind) },
    { val: d.weather.visibility,    key: 'visibility',          warn: isWarn(d.weather.visibility) },
    { val: d.weather.newSnow24h,    key: 'new snow (24h)',      warn: false },
    { val: d.weather.baseDepth,     key: 'base depth',          warn: false },
  ]

  const conditions = [
    { label: 'On-piste',    rating: d.onPiste.rating,    notes: d.onPiste.notes },
    { label: 'Off-piste',   rating: d.offPiste.rating,   notes: d.offPiste.notes },
    { label: 'Ski touring', rating: d.skiTouring.rating, notes: d.skiTouring.notes },
  ]

  return (
    <div className="preview-strip">
      <p className="preview-label">Live bulletin · Verbier / Haut Val de Bagnes</p>
      <div className="preview-card">

        <div className="preview-header">
          <div>
            <div className="preview-date">{dateStr} · {slotStr} · Haut Val de Bagnes (4116)</div>
            <div className="preview-subject">🏔 {d.overallVerdict} — {d.dangerLevel}</div>
          </div>
          <span className={`preview-verdict-badge ${verdictClass}`}>{d.verdictColour === 'green' ? 'Go' : d.verdictColour === 'red' ? 'Avoid' : 'Caution'}</span>
        </div>

        <p className="preview-summary">{d.summary}</p>

        {/* Weather grid */}
        <div className="preview-weather">
          <div className="preview-weather-label">Weather · now</div>
          <div className="preview-weather-grid">
            {weatherCells.map(({ val, key, warn }) => (
              <div key={key} className="weather-cell">
                <span className={`weather-cell-val${warn ? ' warn-val' : ''}`}>{val}</span>
                <span className="weather-cell-key">{key}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Conditions */}
        {conditions.map(({ label, rating, notes }) => (
          <div key={label} className="preview-row preview-row--with-notes">
            <div className="preview-row-left">
              <span className="preview-row-label">{label}</span>
              <span className={`preview-row-val ${RATING_CLASS[rating] ?? ''}`}>{rating}</span>
            </div>
            <span className="preview-row-notes">{notes}</span>
          </div>
        ))}

        {/* Outlook */}
        <div className="preview-row preview-row--outlook">
          <span className="preview-row-label">Outlook</span>
          <span className="preview-row-val">{d.outlook}</span>
        </div>

        <div className="preview-source">
          Source: SLF / WSL Institute ·{' '}
          <a
            href="https://whiterisk.ch/en/conditions/bulletin"
            target="_blank"
            rel="noopener noreferrer"
          >
            View full bulletin on whiterisk.ch →
          </a>
          {' '}· Updated {slotStr}
        </div>
      </div>
    </div>
  )
}
