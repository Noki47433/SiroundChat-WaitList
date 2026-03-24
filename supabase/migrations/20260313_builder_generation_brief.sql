alter table if exists builder_sites
  add column if not exists content_language text not null default 'en',
  add column if not exists generation_brief jsonb not null default '{}'::jsonb;
