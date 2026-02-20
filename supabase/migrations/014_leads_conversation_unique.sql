-- Summary: Enforce one lead per conversation without losing existing rows.

with ranked as (
  select
    id,
    conversation_id,
    row_number() over (partition by conversation_id order by created_at asc, id) as rn
  from leads
  where conversation_id is not null
)
update leads l
set conversation_id = null
from ranked r
where l.id = r.id and r.rn > 1;

create unique index if not exists leads_conversation_unique
  on leads(conversation_id)
  where conversation_id is not null;
