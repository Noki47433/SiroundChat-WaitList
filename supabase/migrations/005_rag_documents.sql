-- Summary: Sets up the RAG storage layer (documents, chunks, embeddings) for each business.
-- This is core because the app relies on these tables and policies to store, search, and protect uploaded knowledge.
-- Without it, uploads, embedding search, and access control for business data would all fail.

-- Extensions that power UUIDs and vector similarity.
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- Businesses table stub (skip if you already have one)
create table if not exists businesses (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users not null,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Document status enum tracks ingestion pipeline state; removing it would break status checks.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'document_status') then
    create type document_status as enum ('uploaded', 'processing', 'ready', 'error');
  end if;
end $$;

create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  user_id uuid references auth.users on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  status document_status not null default 'uploaded',
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists documents_business_idx on documents(business_id);
create index if not exists documents_status_idx on documents(status);

create table if not exists document_chunks (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid references documents(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  created_at timestamptz default now()
);
create index if not exists document_chunks_document_idx on document_chunks(document_id);
create index if not exists document_chunks_business_idx on document_chunks(business_id);

create table if not exists document_chunk_embeddings (
  id uuid primary key default uuid_generate_v4(),
  chunk_id uuid references document_chunks(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
  embedding vector(1536) not null,
  created_at timestamptz default now()
);
create index if not exists document_chunk_embeddings_chunk_idx on document_chunk_embeddings(chunk_id);
create index if not exists document_chunk_embeddings_business_idx on document_chunk_embeddings(business_id);
-- IVFFLAT index keeps similarity search fast; without it queries get slow as data grows.
create index if not exists document_chunk_embeddings_embedding_idx on document_chunk_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Helper RPC for similarity search scoped to a business; removing it would break retrieval in the app.
create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_business_id uuid,
  match_count int
)
returns table (
  chunk_id uuid,
  content text,
  similarity double precision
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.content,
    1 - (e.embedding <=> query_embedding) as similarity
  from document_chunk_embeddings e
  join document_chunks c on c.id = e.chunk_id
  where e.business_id = match_business_id
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- Row Level Security (single-owner; adapt to team tables as needed)
alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table document_chunk_embeddings enable row level security;

-- Users can read documents they own
create policy if not exists "documents_select_owner" on documents
for select using (auth.uid() = user_id);

-- Users can insert documents for businesses they own
create policy if not exists "documents_insert_owner" on documents
for insert with check (auth.uid() = user_id);

-- Users can update their own documents (status/errors)
create policy if not exists "documents_update_owner" on documents
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Chunks follow same ownership
create policy if not exists "document_chunks_select_owner" on document_chunks
for select using (auth.uid() = (select user_id from documents where id = document_id));

create policy if not exists "document_chunks_insert_owner" on document_chunks
for insert with check (auth.uid() = (select user_id from documents where id = document_id));

-- Embeddings ownership via chunk -> document
create policy if not exists "document_chunk_embeddings_select_owner" on document_chunk_embeddings
for select using (
  auth.uid() = (
    select user_id from documents d
    join document_chunks dc on dc.document_id = d.id
    where dc.id = document_chunk_embeddings.chunk_id
  )
);

create policy if not exists "document_chunk_embeddings_insert_owner" on document_chunk_embeddings
for insert with check (
  auth.uid() = (
    select user_id from documents d
    join document_chunks dc on dc.document_id = d.id
    where dc.id = document_chunk_embeddings.chunk_id
  )
);

-- NOTE: For team/shared businesses, replace auth.uid() checks with membership lookups, e.g. exists(select 1 from business_members bm where bm.business_id = documents.business_id and bm.user_id = auth.uid()).
