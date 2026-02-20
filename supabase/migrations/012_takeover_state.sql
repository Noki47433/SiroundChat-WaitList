-- Summary: Adds takeover state to conversations for human handoff.

alter table chat_conversations
  add column if not exists takeover_enabled boolean not null default false,
  add column if not exists takeover_by uuid,
  add column if not exists takeover_at timestamptz,
  add column if not exists takeover_ended_at timestamptz;

create index if not exists chat_conversations_takeover_enabled_idx
  on chat_conversations(business_id, takeover_enabled);
