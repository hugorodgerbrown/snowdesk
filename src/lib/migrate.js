/**
 * SnowDesk — database migration script
 *
 * Checks which tables exist in your Supabase project and prints the SQL
 * needed to create any that are missing.
 *
 * Usage:
 *   npm run db:migrate
 *
 * Requirements:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

const fs = require('fs')
const path = require('path')
const https = require('https')

// ── Load .env.local manually (no dotenv dependency) ──────────────────────────

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('✗ .env.local not found in project root')
    process.exit(1)
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('\n✗ Missing required environment variables in .env.local:')
  if (!SUPABASE_URL)     console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  if (!SERVICE_ROLE_KEY) console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// ── SQL for each required table ───────────────────────────────────────────────

const TABLES = {
  bulletin_previews: `
create table if not exists bulletin_previews (
  region_code  text primary key,
  analysis     jsonb not null,
  cached_at    timestamptz not null default now()
);`.trim(),

  subscribers: `
create table if not exists subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  region_area       text not null,
  region_code       text,
  styles            text[] not null default '{"piste"}',
  delivery          text not null default 'morning'
                      check (delivery in ('morning', 'evening', 'both')),
  confirmed         boolean not null default false,
  unsubscribe_token text not null default encode(gen_random_bytes(32), 'hex'),
  created_at        timestamptz not null default now(),
  unique (email, region_area)
);

create index if not exists subscribers_delivery_confirmed_idx
  on subscribers (delivery, confirmed);`.trim(),

  send_log: `
create table if not exists send_log (
  id            uuid primary key default gen_random_uuid(),
  subscriber_id uuid references subscribers(id) on delete cascade,
  region_code   text not null,
  send_slot     text not null,
  sent_at       timestamptz not null default now()
);

create index if not exists send_log_subscriber_slot_idx
  on send_log (subscriber_id, send_slot, sent_at);`.trim(),
}

// ── Minimal Supabase REST client (no SDK dependency) ─────────────────────────

function supabaseFetch(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL)
    const reqOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }

    const req = https.request(reqOptions, res => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }) }
        catch { resolve({ status: res.statusCode, data: body }) }
      })
    })

    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

// ── Check which tables exist by probing each one ─────────────────────────────

async function tableExists(name) {
  const { status } = await supabaseFetch(
    `/rest/v1/${name}?limit=0`,
    { headers: { 'Accept': 'application/json', 'Prefer': 'count=none' } }
  )
  // 200 = exists, 404 or 42P01 error = does not exist
  return status === 200
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n━━━ SnowDesk database migration ━━━')
  console.log(`  Project: ${SUPABASE_URL}\n`)

  const results = {}
  for (const table of Object.keys(TABLES)) {
    process.stdout.write(`  Checking ${table}...`)
    results[table] = await tableExists(table)
    console.log(results[table] ? ' ✓ exists' : ' ✗ missing')
  }

  console.log()

  const missing = Object.keys(TABLES).filter(t => !results[t])

  if (missing.length === 0) {
    console.log('━━━ All tables present — nothing to do ━━━\n')
    return
  }

  // Build the project ref from the URL for a direct dashboard link
  const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0]
  const dashboardUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`

  console.log('━━━ Run the following SQL in the Supabase SQL Editor ━━━')
  console.log(`  ${dashboardUrl}\n`)
  console.log('-- SnowDesk schema --\n')
  missing.forEach(table => {
    console.log(TABLES[table])
    console.log()
  })
  console.log('-- Run npm run db:migrate again to verify --\n')
}

main().catch(err => {
  console.error('\nUnexpected error:', err.message)
  process.exit(1)
})
