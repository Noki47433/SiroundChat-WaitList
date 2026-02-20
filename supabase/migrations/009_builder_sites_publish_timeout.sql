-- Summary: Track publish start time to prevent stuck "publishing" states.

alter table builder_sites
  add column if not exists publishing_started_at timestamptz null;
