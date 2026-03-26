import { Resend } from 'resend'
import type { BulletinAnalysis, Subscriber } from '@/types'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_ADDRESS ?? 'briefings@snowdesk.co'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://snowdesk.co'

export async function sendBriefingEmail(
  subscriber: Subscriber,
  analysis: BulletinAnalysis,
  regionName: string,
) {
  const unsubUrl = `${APP_URL}/unsubscribe?token=${subscriber.unsubscribe_token}`
  const html = buildEmailHTML(analysis, regionName, unsubUrl)

  const verdictText = `${analysis.overallVerdict} — ${analysis.dangerLevel}`
  const subject = `🏔 ${regionName} · ${analysis.date}: ${verdictText}`

  await resend.emails.send({
    from: FROM,
    to: subscriber.email,
    subject,
    html,
  })
}

function buildEmailHTML(
  d: BulletinAnalysis,
  regionName: string,
  unsubUrl: string,
): string {
  const verdictBg    = d.verdictColour === 'green' ? '#f0fdf4' : d.verdictColour === 'red' ? '#fef2f2' : '#fffbeb'
  const verdictBorder = d.verdictColour === 'green' ? '#16a34a' : d.verdictColour === 'red' ? '#dc2626' : '#d97706'
  const verdictColor  = d.verdictColour === 'green' ? '#15803d' : d.verdictColour === 'red' ? '#b91c1c' : '#b45309'

  const ratingColor = (r: string) => {
    if (['Excellent','Good','Epic','Ideal'].includes(r)) return '#15803d'
    if (['Very Risky','Avoid','Closed'].includes(r)) return '#b91c1c'
    return '#b45309'
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:Georgia,serif;background:#f8f7f4;color:#1a1a1a;margin:0;padding:0}
.wrap{max-width:560px;margin:0 auto;padding:32px 24px}
.header{border-bottom:2px solid #1a1a1a;padding-bottom:18px;margin-bottom:24px}
.masthead{font-family:monospace;font-size:11px;color:#999;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px}
.title{font-size:22px;font-weight:700;margin:0 0 3px}
.subtitle{font-family:monospace;font-size:10px;color:#aaa;letter-spacing:0.05em;text-transform:uppercase}
.verdict{display:inline-block;background:${verdictBg};border:1px solid ${verdictBorder};border-radius:3px;padding:10px 16px;margin:20px 0}
.verdict-label{font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#999}
.verdict-text{font-size:17px;font-weight:700;color:${verdictColor};margin:2px 0 0}
.verdict-sub{font-size:12px;color:#888;margin-top:3px}
p{font-size:14px;line-height:1.8;margin:0 0 20px}
.section-label{font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:#999;border-bottom:1px solid #e5e5e5;padding-bottom:5px;margin:24px 0 12px}
.weather-grid{display:table;width:100%;border-collapse:collapse;margin-bottom:4px}
.weather-row{display:table-row}
.weather-cell{display:table-cell;padding:6px 10px;border:1px solid #ece8e0;vertical-align:top;width:25%}
.w-val{font-family:monospace;font-size:12px;font-weight:700;color:#1a1a1a}
.w-val.warn{color:#c2410c}
.w-key{font-size:10px;color:#888;line-height:1.3;margin-top:1px}
.row{margin-bottom:14px}
.row-name{font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:2px}
.row-val{font-size:15px;font-weight:700}
.row-note{font-size:13px;color:#555;line-height:1.6}
.list-item{font-size:13px;color:#444;padding:5px 0;border-bottom:1px solid #eee;line-height:1.5}
.list-item:last-child{border-bottom:none}
.outlook{background:#f5f5f0;border-left:3px solid #1a1a1a;padding:12px 16px;font-size:13px;line-height:1.8;margin-top:8px}
.footer{margin-top:32px;padding-top:14px;border-top:1px solid #ddd;font-size:10px;color:#bbb;font-family:monospace;line-height:1.8}
.footer a{color:#888;text-decoration:underline}
</style>
</head>
<body><div class="wrap">

<div class="header">
  <div class="masthead">SnowDesk</div>
  <div class="title">🏔 ${regionName}</div>
  <div class="subtitle">${d.date.toUpperCase()} · SLF AVALANCHE BRIEFING</div>
</div>

<div class="verdict">
  <div class="verdict-label">Today's verdict</div>
  <div class="verdict-text">${d.overallVerdict}</div>
  <div class="verdict-sub">Danger: ${d.dangerLevel}</div>
</div>

<p>${d.summary}</p>

<div class="section-label">Weather</div>
<table class="weather-grid">
<tr>
  <td class="weather-cell"><div class="w-val">${d.weather.summitTemp}</div><div class="w-key">summit</div></td>
  <td class="weather-cell"><div class="w-val">${d.weather.midTemp}</div><div class="w-key">mid-mountain</div></td>
  <td class="weather-cell"><div class="w-val">${d.weather.resortTemp}</div><div class="w-key">resort</div></td>
  <td class="weather-cell"><div class="w-val">${d.weather.freezingLevel}</div><div class="w-key">freezing level</div></td>
</tr>
<tr>
  <td class="weather-cell"><div class="w-val warn">${d.weather.wind}</div><div class="w-key">wind</div></td>
  <td class="weather-cell"><div class="w-val warn">${d.weather.visibility}</div><div class="w-key">visibility</div></td>
  <td class="weather-cell"><div class="w-val">${d.weather.newSnow24h}</div><div class="w-key">new snow (24h)</div></td>
  <td class="weather-cell"><div class="w-val">${d.weather.baseDepth}</div><div class="w-key">base depth</div></td>
</tr>
</table>

<div class="section-label">Conditions</div>
<div class="row">
  <div class="row-name">On-piste</div>
  <div class="row-val" style="color:${ratingColor(d.onPiste.rating)}">${d.onPiste.rating}</div>
  <div class="row-note">${d.onPiste.notes}</div>
</div>
<div class="row">
  <div class="row-name">Off-piste</div>
  <div class="row-val" style="color:${ratingColor(d.offPiste.rating)}">${d.offPiste.rating}</div>
  <div class="row-note">${d.offPiste.notes}</div>
</div>
<div class="row">
  <div class="row-name">Ski touring</div>
  <div class="row-val" style="color:${ratingColor(d.skiTouring.rating)}">${d.skiTouring.rating}</div>
  <div class="row-note">${d.skiTouring.notes}</div>
</div>

<div class="section-label">Key hazards</div>
${d.keyHazards.map(h => `<div class="list-item">⚠ ${h}</div>`).join('')}

<div class="section-label">Best bets today</div>
${d.bestBets.map(b => `<div class="list-item" style="color:#15803d">✓ ${b}</div>`).join('')}

<div class="section-label">Outlook</div>
<div class="outlook">${d.outlook}</div>

<div class="footer">
  Source: SLF / WSL Institute · whiterisk.ch · aws.slf.ch<br>
  Always verify at <a href="https://whiterisk.ch">whiterisk.ch</a> before heading out. This briefing is for information only.<br><br>
  <a href="${unsubUrl}">Unsubscribe</a> · © ${new Date().getFullYear()} SnowDesk
</div>

</div></body></html>`
}
