-- Backfill founder daily metrics history and estimate legacy AI usage for old assistant messages.

with ai_message_estimates as (
  select
    ranked.message_id,
    greatest(24, ceil(char_length(ranked.ai_content)::numeric / 4.0))::int as estimated_output_tokens,
    greatest(
      700,
      greatest(12, ceil(char_length(coalesce(ranked.previous_content, ''))::numeric / 4.0))::int +
        greatest(24, ceil(char_length(ranked.ai_content)::numeric / 4.0))::int +
        500
    )::int as estimated_input_tokens
  from (
    select
      m.id as message_id,
      coalesce(m.content, '') as ai_content,
      lag(m.content) over (partition by m.conversation_id order by m.created_at, m.id) as previous_content
    from public.messages m
    where m.sender = 'ai'
  ) ranked
  join public.messages existing on existing.id = ranked.message_id
  where coalesce(existing.tokens_in, 0) = 0
    and coalesce(existing.tokens_out, 0) = 0
    and coalesce(existing.cost_usd, 0) = 0
)
update public.messages as m
set
  tokens_in = est.estimated_input_tokens,
  tokens_out = est.estimated_output_tokens,
  cost_usd = round(
    ((est.estimated_input_tokens::numeric / 1000000.0) * 0.15) +
    ((est.estimated_output_tokens::numeric / 1000000.0) * 0.6),
    4
  )
from ai_message_estimates est
where m.id = est.message_id;

with conversation_daily as (
  select
    business_id,
    (created_at at time zone 'utc')::date as day,
    count(*)::int as conversations_count
  from public.conversations
  group by business_id, (created_at at time zone 'utc')::date
),
message_daily as (
  select
    business_id,
    (created_at at time zone 'utc')::date as day,
    count(*)::int as messages_count,
    count(*) filter (where sender = 'ai')::int as ai_messages_count,
    count(*) filter (where sender = 'human')::int as human_messages_count,
    coalesce(sum(tokens_in), 0)::int as tokens_in,
    coalesce(sum(tokens_out), 0)::int as tokens_out,
    coalesce(sum(cost_usd), 0)::numeric(12, 4) as ai_cost_usd
  from public.messages
  group by business_id, (created_at at time zone 'utc')::date
),
lead_daily as (
  select
    business_id,
    (created_at at time zone 'utc')::date as day,
    count(*)::int as leads_count
  from public.leads
  group by business_id, (created_at at time zone 'utc')::date
),
visitor_daily as (
  select
    business_id,
    (occurred_at at time zone 'utc')::date as day,
    count(distinct session_id)::int as visitors_count
  from public.website_analytics_events
  where event_type = 'page_view'
    and session_id is not null
  group by business_id, (occurred_at at time zone 'utc')::date
),
all_days as (
  select business_id, day from conversation_daily
  union
  select business_id, day from message_daily
  union
  select business_id, day from lead_daily
  union
  select business_id, day from visitor_daily
)
insert into public.business_metrics_daily (
  business_id,
  day,
  conversations_count,
  messages_count,
  ai_messages_count,
  human_messages_count,
  leads_count,
  visitors_count,
  tokens_in,
  tokens_out,
  ai_cost_usd
)
select
  d.business_id,
  d.day,
  coalesce(c.conversations_count, 0),
  coalesce(m.messages_count, 0),
  coalesce(m.ai_messages_count, 0),
  coalesce(m.human_messages_count, 0),
  coalesce(l.leads_count, 0),
  coalesce(v.visitors_count, 0),
  coalesce(m.tokens_in, 0),
  coalesce(m.tokens_out, 0),
  coalesce(m.ai_cost_usd, 0)
from all_days d
left join conversation_daily c using (business_id, day)
left join message_daily m using (business_id, day)
left join lead_daily l using (business_id, day)
left join visitor_daily v using (business_id, day)
on conflict (business_id, day) do update
set
  conversations_count = excluded.conversations_count,
  messages_count = excluded.messages_count,
  ai_messages_count = excluded.ai_messages_count,
  human_messages_count = excluded.human_messages_count,
  leads_count = excluded.leads_count,
  visitors_count = excluded.visitors_count,
  tokens_in = excluded.tokens_in,
  tokens_out = excluded.tokens_out,
  ai_cost_usd = excluded.ai_cost_usd;
