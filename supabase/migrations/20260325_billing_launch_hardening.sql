-- Launch hardening for Paysera billing: immutable payment snapshots, callback audit trail,
-- idempotent callback finalization, and stale/superseded payment support.

alter table billing_payments
  add column if not exists plan_id_snapshot text references billing_plans(id),
  add column if not exists provider_project_id text,
  add column if not exists provider_test_mode boolean not null default false,
  add column if not exists provider_status text,
  add column if not exists failure_reason text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists processed_at timestamptz null,
  add column if not exists superseded_at timestamptz null,
  add column if not exists superseded_by_payment_id uuid null references billing_payments(id) on delete set null,
  add column if not exists requires_manual_review boolean not null default false;

update billing_payments bp
set plan_id_snapshot = bs.plan_id
from billing_subscriptions bs
where bp.subscription_id = bs.id
  and bp.plan_id_snapshot is null;

create table if not exists billing_callback_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paysera',
  paysera_orderid text null,
  payment_id uuid null references billing_payments(id) on delete set null,
  subscription_id uuid null references billing_subscriptions(id) on delete set null,
  business_id uuid null references businesses(id) on delete set null,
  provider_status text null,
  outcome text not null,
  review_required boolean not null default false,
  acknowledged boolean not null default false,
  raw_payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists billing_callback_events_order_idx
  on billing_callback_events (paysera_orderid, created_at desc);

create index if not exists billing_callback_events_review_idx
  on billing_callback_events (review_required, created_at desc);

create unique index if not exists billing_payments_pending_setup_unique_idx
  on billing_payments (subscription_id, kind)
  where kind = 'setup' and status = 'pending';

create or replace function public.set_billing_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists billing_payments_set_updated_at on billing_payments;
create trigger billing_payments_set_updated_at
before update on billing_payments
for each row execute function public.set_billing_payments_updated_at();

alter table billing_callback_events enable row level security;

drop policy if exists billing_payments_select_owner on billing_payments;

create or replace function public.billing_finalize_paysera_callback(
  p_paysera_orderid text,
  p_provider_status text,
  p_amount_cents int,
  p_currency text,
  p_provider_project_id text,
  p_provider_test_mode boolean,
  p_raw_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_payment billing_payments%rowtype;
  v_subscription billing_subscriptions%rowtype;
  v_has_reconciled_target boolean := false;
  v_outcome text := 'trusted_callback_recorded';
  v_review_required boolean := false;
  v_mutated boolean := false;
  v_next_period_end timestamptz := null;
  v_event_id uuid;
  v_status text := nullif(trim(coalesce(p_provider_status, '')), '');
  v_currency text := upper(nullif(trim(coalesce(p_currency, '')), ''));
  v_project_id text := nullif(trim(coalesce(p_provider_project_id, '')), '');
  v_payload jsonb := coalesce(p_raw_payload, '{}'::jsonb);
begin
  if nullif(trim(coalesce(p_paysera_orderid, '')), '') is not null then
    select p.*
    into v_payment
    from billing_payments p
    where p.paysera_orderid = p_paysera_orderid
    limit 1
    for update of p;

    if found then
      select s.*
      into v_subscription
      from billing_subscriptions s
      where s.id = v_payment.subscription_id
      for update;

      if found then
        v_has_reconciled_target := true;
      end if;
    end if;
  end if;

  if nullif(trim(coalesce(p_paysera_orderid, '')), '') is null then
    v_outcome := 'missing_orderid';
    v_review_required := true;
  elsif not v_has_reconciled_target then
    v_outcome := 'unmatched_order';
    v_review_required := true;
  else
    if v_payment.superseded_at is not null or v_payment.superseded_by_payment_id is not null then
      update billing_payments
      set
        raw_callback = v_payload,
        provider_status = v_status,
        requires_manual_review = requires_manual_review or (v_status = '5')
      where id = v_payment.id;

      v_outcome := case when v_status = '1' then 'superseded_late_success' else 'superseded_callback' end;
      v_review_required := v_status = '5';
    elsif v_payment.plan_id_snapshot is null then
      update billing_payments
      set
        raw_callback = v_payload,
        provider_status = v_status,
        failure_reason = 'missing_plan_snapshot',
        requires_manual_review = true
      where id = v_payment.id;

      v_outcome := 'missing_plan_snapshot';
      v_review_required := true;
    elsif v_project_id is null or v_payment.provider_project_id is null or v_project_id <> v_payment.provider_project_id then
      update billing_payments
      set
        raw_callback = v_payload,
        provider_status = v_status,
        failure_reason = 'project_mismatch',
        requires_manual_review = true
      where id = v_payment.id;

      v_outcome := 'project_mismatch';
      v_review_required := true;
    elsif p_amount_cents is null or p_amount_cents <> v_payment.amount_cents then
      update billing_payments
      set
        raw_callback = v_payload,
        provider_status = v_status,
        failure_reason = 'amount_mismatch',
        requires_manual_review = true
      where id = v_payment.id;

      v_outcome := 'amount_mismatch';
      v_review_required := true;
    elsif v_currency is null or v_currency <> upper(v_payment.currency) then
      update billing_payments
      set
        raw_callback = v_payload,
        provider_status = v_status,
        failure_reason = 'currency_mismatch',
        requires_manual_review = true
      where id = v_payment.id;

      v_outcome := 'currency_mismatch';
      v_review_required := true;
    elsif coalesce(p_provider_test_mode, false) is distinct from coalesce(v_payment.provider_test_mode, false) then
      update billing_payments
      set
        raw_callback = v_payload,
        provider_status = v_status,
        failure_reason = 'test_mode_mismatch',
        requires_manual_review = true
      where id = v_payment.id;

      v_outcome := 'test_mode_mismatch';
      v_review_required := true;
    elsif v_status = '5' then
      update billing_payments
      set
        raw_callback = v_payload,
        provider_status = v_status,
        requires_manual_review = true
      where id = v_payment.id;

      v_outcome := 'refund_manual_review';
      v_review_required := true;
    elsif v_payment.processed_at is not null then
      update billing_payments
      set
        raw_callback = v_payload,
        provider_status = v_status
      where id = v_payment.id;

      v_outcome := case
        when v_payment.status = 'succeeded' and v_status = '1' then 'duplicate_success'
        when v_payment.status = 'failed' and v_status = '0' then 'duplicate_failure'
        else 'already_processed'
      end;
    elsif v_status in ('2', '3', '4') then
      update billing_payments
      set
        raw_callback = v_payload,
        provider_status = v_status
      where id = v_payment.id;

      v_outcome := case
        when v_status = '2' then 'provider_pending'
        when v_status = '3' then 'provider_additional_info'
        else 'provider_no_bank_confirmation'
      end;
    elsif v_status = '0' then
      update billing_payments
      set
        status = 'failed',
        raw_callback = v_payload,
        provider_status = v_status,
        processed_at = v_now,
        failure_reason = 'provider_status_0'
      where id = v_payment.id;

      if v_payment.kind = 'setup' then
        update billing_subscriptions
        set
          status = 'canceled',
          trial_end = null,
          current_period_end = null
        where id = v_subscription.id;

        v_outcome := 'setup_failed';
      else
        v_outcome := 'renewal_failed';
      end if;
    elsif v_status = '1' then
      if v_payment.status <> 'pending' then
        update billing_payments
        set
          raw_callback = v_payload,
          provider_status = v_status
        where id = v_payment.id;

        v_outcome := 'payment_not_pending';
      elsif v_payment.kind = 'setup' then
        v_next_period_end := v_now + interval '14 days';

        update billing_payments
        set
          status = 'succeeded',
          raw_callback = v_payload,
          provider_status = v_status,
          processed_at = v_now,
          failure_reason = null,
          requires_manual_review = false
        where id = v_payment.id;

        update billing_subscriptions
        set
          plan_id = v_payment.plan_id_snapshot,
          status = 'trialing',
          trial_end = v_next_period_end,
          current_period_end = v_next_period_end
        where id = v_subscription.id;

        v_outcome := 'setup_activated';
        v_mutated := true;
      else
        v_next_period_end := (
          case
            when v_subscription.current_period_end is not null and v_subscription.current_period_end > v_now
              then v_subscription.current_period_end
            else v_now
          end
        ) + interval '1 month';

        update billing_payments
        set
          status = 'succeeded',
          raw_callback = v_payload,
          provider_status = v_status,
          processed_at = v_now,
          failure_reason = null,
          requires_manual_review = false
        where id = v_payment.id;

        update billing_subscriptions
        set
          plan_id = v_payment.plan_id_snapshot,
          status = 'active',
          current_period_end = v_next_period_end
        where id = v_subscription.id;

        v_outcome := 'renewal_activated';
        v_mutated := true;
      end if;
    else
      update billing_payments
      set
        raw_callback = v_payload,
        provider_status = v_status,
        failure_reason = 'unsupported_provider_status',
        requires_manual_review = true
      where id = v_payment.id;

      v_outcome := 'unsupported_provider_status';
      v_review_required := true;
    end if;
  end if;

  insert into billing_callback_events (
    provider,
    paysera_orderid,
    payment_id,
    subscription_id,
    business_id,
    provider_status,
    outcome,
    review_required,
    acknowledged,
    raw_payload
  )
  values (
    'paysera',
    nullif(trim(coalesce(p_paysera_orderid, '')), ''),
    v_payment.id,
    v_subscription.id,
    v_subscription.business_id,
    v_status,
    v_outcome,
    v_review_required,
    true,
    v_payload
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'ack', true,
    'outcome', v_outcome,
    'mutated', v_mutated,
    'review_required', v_review_required,
    'event_id', v_event_id,
    'payment_id', v_payment.id,
    'subscription_id', v_subscription.id,
    'business_id', v_subscription.business_id
  );
end;
$$;
