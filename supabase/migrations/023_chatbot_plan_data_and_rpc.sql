-- Step 2: data migration + RPC replacement after enum value exists.

-- Migrate old enterprise rows to chatbot for the new 3-plan model.
update subscriptions
set plan_id = 'chatbot'::plan_id_enum
where plan_id::text = 'enterprise';

-- Keep legacy plan column coherent when present.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'plan'
  ) then
    update subscriptions
    set plan = case
      when plan_id::text in ('bundle', 'chatbot', 'enterprise') then 'pro'::plan
      else 'local_basic'::plan
    end;
  end if;
end;
$$;

create or replace function change_workspace_plan(p_workspace_id uuid, p_plan_id plan_id_enum)
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_is_owner boolean := false;
  v_is_admin boolean := false;
  v_old_plan plan_id_enum;
  v_subscription subscriptions%rowtype;
begin
  if p_workspace_id is null then
    raise exception 'workspace_id is required' using errcode = '22023';
  end if;

  select exists (
    select 1
    from businesses b
    where b.id = p_workspace_id
      and coalesce(b.owner_user_id, b.owner_id) = v_actor_id
  )
  into v_is_owner;

  select exists (
    select 1
    from profiles p
    where p.id = v_actor_id
      and p.role = 'admin'
  )
  into v_is_admin;

  if not (v_is_owner or v_is_admin) then
    raise exception 'Not authorized to change this workspace plan' using errcode = '42501';
  end if;

  select s.plan_id
  into v_old_plan
  from subscriptions s
  where s.business_id = p_workspace_id;

  insert into subscriptions (
    business_id,
    plan,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    created_at,
    updated_at
  )
  values (
    p_workspace_id,
    case
      when p_plan_id::text in ('bundle', 'chatbot', 'enterprise') then 'pro'::plan
      else 'local_basic'::plan
    end,
    case
      when p_plan_id::text = 'enterprise' then 'chatbot'::plan_id_enum
      else p_plan_id
    end,
    'active',
    now(),
    now() + interval '30 days',
    false,
    now(),
    now()
  )
  on conflict (business_id) do update
  set
    plan = case
      when excluded.plan_id::text in ('bundle', 'chatbot', 'enterprise') then 'pro'::plan
      else 'local_basic'::plan
    end,
    plan_id = case
      when excluded.plan_id::text = 'enterprise' then 'chatbot'::plan_id_enum
      else excluded.plan_id
    end,
    status = 'active',
    cancel_at_period_end = false,
    updated_at = now()
  returning * into v_subscription;

  insert into billing_events (business_id, actor_user_id, event_type, payload)
  values (
    p_workspace_id,
    v_actor_id,
    'plan_changed',
    jsonb_build_object(
      'old_plan', v_old_plan,
      'new_plan', v_subscription.plan_id
    )
  );

  return v_subscription;
end;
$$;
