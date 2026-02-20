-- Summary: Bootstraps the core business, website, page/block, and chat data model.
-- Core because all app features (builder, chat, leads, billing) rely on these base tables; removing or changing them breaks most of the product.
-- UUID extension supplies primary keys used everywhere.
create extension if not exists "uuid-ossp";

-- Accounts for app users; removing columns like onboarding_complete breaks onboarding flow checks.
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  password_hash text,
  name text not null,
  onboarding_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Businesses owned by users; ties together subscriptions, sites, and chat.
create table if not exists businesses (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references users(id) on delete cascade,
  business_name text not null,
  logo_url text,
  timezone text,
  created_at timestamptz default now()
);

-- Billing plans and states; used to gate features and show billing UI.
create type plan as enum ('free', 'local_basic', 'pro', 'enterprise');
create type subscription_status as enum ('active', 'past_due', 'canceled', 'trialing');

create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  plan plan not null,
  status subscription_status not null default 'active',
  renewal_date timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now()
);

-- Website + page + block tables power the site builder; changing structure would break builder reads/writes.
create table if not exists websites (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  site_name text not null,
  domain text,
  status text default 'draft',
  last_published_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists pages (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid references websites(id) on delete cascade,
  slug text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists blocks (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid references pages(id) on delete cascade,
  position int not null,
  type text not null,
  data jsonb,
  created_at timestamptz default now()
);

-- Chat pipeline: conversations group messages and track lead status for each business/site.
create table if not exists chat_conversations (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  site_id uuid references websites(id),
  user_name text,
  user_email text,
  is_lead boolean default false,
  created_at timestamptz default now()
);

-- Chat messages attached to conversations; removing the index slows chat history queries.
create table if not exists chat_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references chat_conversations(id) on delete cascade,
  sender text not null,
  message_text text not null,
  created_at timestamptz default now()
);
create index if not exists chat_messages_conversation_id_idx on chat_messages(conversation_id);
