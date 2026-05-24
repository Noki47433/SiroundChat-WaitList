-- Adds action_type and collected_fields to reservations for multi-industry action support.
-- Existing rows default to 'restaurant_reservation' to preserve backward compatibility.

alter table public.reservations
  add column if not exists action_type text not null default 'restaurant_reservation',
  add column if not exists collected_fields jsonb null;

-- Backfill existing rows (no-op if column was just created; handles re-run safety)
update public.reservations
set action_type = 'restaurant_reservation'
where action_type is null or action_type = '';

-- Make conversation_id nullable so non-restaurant requests without a conversation can be created manually
alter table public.reservations
  alter column conversation_id drop not null;

-- Make customer_phone nullable (code already sends null; this aligns schema with reality)
alter table public.reservations
  alter column customer_phone drop not null;

create index if not exists reservations_business_action_type_idx
  on public.reservations (business_id, action_type, created_at desc);
