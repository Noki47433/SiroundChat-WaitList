-- Summary: Persists reservation collection state per conversation.

create table if not exists conversation_reservation_state (
  conversation_id uuid primary key references chat_conversations(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists conversation_reservation_state_business_id_idx
  on conversation_reservation_state(business_id);

create or replace function set_conversation_reservation_state_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists conversation_reservation_state_set_updated_at on conversation_reservation_state;
create trigger conversation_reservation_state_set_updated_at
before update on conversation_reservation_state
for each row execute function set_conversation_reservation_state_updated_at();

alter table conversation_reservation_state enable row level security;
create policy if not exists "conversation_reservation_state_select_owner" on conversation_reservation_state
for select using (is_business_owner(business_id));
create policy if not exists "conversation_reservation_state_insert_owner" on conversation_reservation_state
for insert with check (is_business_owner(business_id));
create policy if not exists "conversation_reservation_state_update_owner" on conversation_reservation_state
for update using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create policy if not exists "conversation_reservation_state_delete_owner" on conversation_reservation_state
for delete using (is_business_owner(business_id));
