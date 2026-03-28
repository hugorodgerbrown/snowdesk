-- SnowDesk initial schema

create table if not exists bulletin_previews (
  region_code  text primary key,
  analysis     jsonb not null,
  cached_at    timestamptz not null default now()
);

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
  on subscribers (delivery, confirmed);

create table if not exists send_log (
  id            uuid primary key default gen_random_uuid(),
  subscriber_id uuid references subscribers(id) on delete cascade,
  region_code   text not null,
  send_slot     text not null,
  sent_at       timestamptz not null default now()
);

create index if not exists send_log_subscriber_slot_idx
  on send_log (subscriber_id, send_slot, sent_at);
