-- Summary: Adds conversation feedback records and prompt tracking on conversations.

create table if not exists conversation_feedback (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  site_id uuid references websites(id),
  message_id uuid not null references chat_messages(id) on delete cascade,
  rating text not null check (rating in ('up', 'down')),
  tags text[],
  comment text,
  created_at timestamptz default now()
);

create unique index if not exists conversation_feedback_conversation_unique
  on conversation_feedback(conversation_id);
create index if not exists conversation_feedback_site_id_idx
  on conversation_feedback(site_id);
create index if not exists conversation_feedback_rating_idx
  on conversation_feedback(rating);
create index if not exists conversation_feedback_created_at_idx
  on conversation_feedback(created_at);

alter table chat_conversations
  add column if not exists should_prompt_feedback boolean not null default false,
  add column if not exists feedback_prompted_at timestamptz,
  add column if not exists followup_prompted_at timestamptz;

alter table conversation_feedback enable row level security;

drop policy if exists "conversation_feedback_select_owner" on conversation_feedback;
create policy "conversation_feedback_select_owner" on conversation_feedback
for select using (
  exists (
    select 1
    from chat_conversations c
    join businesses b on b.id = c.business_id
    where c.id = conversation_feedback.conversation_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "conversation_feedback_insert_owner" on conversation_feedback;
create policy "conversation_feedback_insert_owner" on conversation_feedback
for insert with check (
  exists (
    select 1
    from chat_conversations c
    join businesses b on b.id = c.business_id
    where c.id = conversation_feedback.conversation_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "conversation_feedback_update_owner" on conversation_feedback;
create policy "conversation_feedback_update_owner" on conversation_feedback
for update using (
  exists (
    select 1
    from chat_conversations c
    join businesses b on b.id = c.business_id
    where c.id = conversation_feedback.conversation_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from chat_conversations c
    join businesses b on b.id = c.business_id
    where c.id = conversation_feedback.conversation_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "conversation_feedback_delete_owner" on conversation_feedback;
create policy "conversation_feedback_delete_owner" on conversation_feedback
for delete using (
  exists (
    select 1
    from chat_conversations c
    join businesses b on b.id = c.business_id
    where c.id = conversation_feedback.conversation_id and b.owner_id = auth.uid()
  )
);
