-- Summary: Adds leads capture and embedding storage with similarity search per business.
-- Core because lead intake and RAG features depend on these tables and functions; removing them breaks chat lead capture and search.
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- Captures leads from chat/widget flows; if removed, lead tracking and CRM exports fail.
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  conversation_id uuid references chat_conversations(id) on delete set null,
  name text not null,
  phone text,
  email text,
  source text not null default 'widget',
  created_at timestamptz default now()
);
create index if not exists leads_business_id_idx on leads(business_id);

-- Stores raw embeddings for business knowledge; used by retrieval functions.
create table if not exists embeddings (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  content text not null,
  embedding vector(1536) not null,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists embeddings_business_id_idx on embeddings(business_id);
-- IVFFLAT index keeps similarity search fast; without it vector queries slow down quickly as data grows.
create index if not exists embeddings_embedding_idx on embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Similarity search RPC used by RAG retrieval; deleting it breaks AI answers and chat grounding.
create or replace function match_business_embeddings(
  query_embedding vector(1536),
  match_count int default 5,
  business uuid
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
as $$
  select
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from embeddings
  where business_id = business
  order by embedding <=> query_embedding
  limit match_count;
$$;
