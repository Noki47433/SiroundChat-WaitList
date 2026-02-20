-- Summary: Aligns businesses with Supabase auth users and secures dashboard data by business ownership.
-- Core because dashboard reads/writes must be scoped to the authenticated business owner.

-- Ensure business profile fields exist for bot settings + industry metadata.
alter table businesses add column if not exists business_name text;
alter table businesses add column if not exists industry text;
alter table businesses add column if not exists greeting text;
alter table businesses add column if not exists tone text;
alter table businesses add column if not exists logo_url text;
alter table businesses add column if not exists updated_at timestamptz default now();

-- Backfill business_name from legacy column (if present) and enforce not-null.
do $$ begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'businesses' and column_name = 'name'
  ) then
    update businesses set business_name = coalesce(business_name, name);
  end if;
end $$;

update businesses set business_name = coalesce(business_name, 'Your business') where business_name is null;
alter table businesses alter column business_name set not null;

-- Ensure owner_id points to Supabase auth users.
alter table businesses drop constraint if exists businesses_owner_id_fkey;
alter table businesses
  add constraint businesses_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete cascade;

-- Businesses: owner-only access.
alter table businesses enable row level security;
create policy if not exists \"businesses_select_owner\" on businesses
for select using (owner_id = auth.uid());
create policy if not exists \"businesses_insert_owner\" on businesses
for insert with check (owner_id = auth.uid());
create policy if not exists \"businesses_update_owner\" on businesses
for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy if not exists \"businesses_delete_owner\" on businesses
for delete using (owner_id = auth.uid());

-- Conversations: only owners can read/write their business conversations.
alter table chat_conversations enable row level security;
create policy if not exists \"chat_conversations_select_owner\" on chat_conversations
for select using (
  exists (
    select 1 from businesses b
    where b.id = chat_conversations.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists \"chat_conversations_insert_owner\" on chat_conversations
for insert with check (
  exists (
    select 1 from businesses b
    where b.id = chat_conversations.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists \"chat_conversations_update_owner\" on chat_conversations
for update using (
  exists (
    select 1 from businesses b
    where b.id = chat_conversations.business_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from businesses b
    where b.id = chat_conversations.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists \"chat_conversations_delete_owner\" on chat_conversations
for delete using (
  exists (
    select 1 from businesses b
    where b.id = chat_conversations.business_id and b.owner_id = auth.uid()
  )
);

-- Conversation messages: ownership via parent conversation.
alter table chat_messages enable row level security;
create policy if not exists \"chat_messages_select_owner\" on chat_messages
for select using (
  exists (
    select 1
    from chat_conversations c
    join businesses b on b.id = c.business_id
    where c.id = chat_messages.conversation_id and b.owner_id = auth.uid()
  )
);
create policy if not exists \"chat_messages_insert_owner\" on chat_messages
for insert with check (
  exists (
    select 1
    from chat_conversations c
    join businesses b on b.id = c.business_id
    where c.id = chat_messages.conversation_id and b.owner_id = auth.uid()
  )
);
create policy if not exists \"chat_messages_update_owner\" on chat_messages
for update using (
  exists (
    select 1
    from chat_conversations c
    join businesses b on b.id = c.business_id
    where c.id = chat_messages.conversation_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from chat_conversations c
    join businesses b on b.id = c.business_id
    where c.id = chat_messages.conversation_id and b.owner_id = auth.uid()
  )
);
create policy if not exists \"chat_messages_delete_owner\" on chat_messages
for delete using (
  exists (
    select 1
    from chat_conversations c
    join businesses b on b.id = c.business_id
    where c.id = chat_messages.conversation_id and b.owner_id = auth.uid()
  )
);

-- Documents: ownership via business.
alter table documents enable row level security;
drop policy if exists \"documents_select_owner\" on documents;
drop policy if exists \"documents_insert_owner\" on documents;
drop policy if exists \"documents_update_owner\" on documents;
create policy if not exists \"documents_select_owner\" on documents
for select using (
  exists (
    select 1 from businesses b
    where b.id = documents.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists \"documents_insert_owner\" on documents
for insert with check (
  exists (
    select 1 from businesses b
    where b.id = documents.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists \"documents_update_owner\" on documents
for update using (
  exists (
    select 1 from businesses b
    where b.id = documents.business_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from businesses b
    where b.id = documents.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists \"documents_delete_owner\" on documents
for delete using (
  exists (
    select 1 from businesses b
    where b.id = documents.business_id and b.owner_id = auth.uid()
  )
);

-- Leads: ownership via business.
alter table leads enable row level security;
create policy if not exists \"leads_select_owner\" on leads
for select using (
  exists (
    select 1 from businesses b
    where b.id = leads.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists \"leads_insert_owner\" on leads
for insert with check (
  exists (
    select 1 from businesses b
    where b.id = leads.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists \"leads_update_owner\" on leads
for update using (
  exists (
    select 1 from businesses b
    where b.id = leads.business_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from businesses b
    where b.id = leads.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists \"leads_delete_owner\" on leads
for delete using (
  exists (
    select 1 from businesses b
    where b.id = leads.business_id and b.owner_id = auth.uid()
  )
);

-- Analytics: ownership via business.
alter table analytics_events enable row level security;
create policy if not exists \"analytics_select_owner\" on analytics_events
for select using (
  exists (
    select 1 from businesses b
    where b.id = analytics_events.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists \"analytics_insert_owner\" on analytics_events
for insert with check (
  exists (
    select 1 from businesses b
    where b.id = analytics_events.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists \"analytics_update_owner\" on analytics_events
for update using (
  exists (
    select 1 from businesses b
    where b.id = analytics_events.business_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from businesses b
    where b.id = analytics_events.business_id and b.owner_id = auth.uid()
  )
);
create policy if not exists \"analytics_delete_owner\" on analytics_events
for delete using (
  exists (
    select 1 from businesses b
    where b.id = analytics_events.business_id and b.owner_id = auth.uid()
  )
);
