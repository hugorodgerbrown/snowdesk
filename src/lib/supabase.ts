import { createClient } from '@supabase/supabase-js'

// Browser-safe client (uses anon key)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Server-only client (uses service role key — full access, never expose to browser)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
  ── DATABASE SCHEMA ──────────────────────────────────────────────────────────
  Run this SQL in the Supabase SQL editor to create the required tables.

  -- Bulletin preview cache (pre-computed analyses written by the cron job,
  -- read by /api/preview so the sign-up page never calls Claude live)
  create table bulletin_previews (
    region_code  text primary key,
    analysis     jsonb not null,
    cached_at    timestamptz not null default now()
  );

  -- Subscribers table
  create table subscribers (
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

  -- Index for fast lookups by delivery preference during cron job
  create index on subscribers (delivery, confirmed);

  -- Bulletin cache table (avoids fetching the same region PDF multiple times per run)
  create table bulletin_cache (
    region_code  text primary key,
    content      text not null,
    fetched_at   timestamptz not null default now()
  );

  -- Send log (prevents duplicate sends, useful for debugging)
  create table send_log (
    id            uuid primary key default gen_random_uuid(),
    subscriber_id uuid references subscribers(id) on delete cascade,
    region_code   text not null,
    send_slot     text not null,   -- 'morning' | 'evening'
    sent_at       timestamptz not null default now()
  );

  create index on send_log (subscriber_id, send_slot, sent_at);
  ─────────────────────────────────────────────────────────────────────────────
*/
