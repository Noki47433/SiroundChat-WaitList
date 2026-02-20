-- Summary: Optional settings used to estimate business value in impact summaries.

create table if not exists business_value_settings (
  business_id uuid primary key references businesses(id) on delete cascade,
  avg_order_value numeric null,
  reservation_value numeric null,
  lead_value numeric null,
  close_rate numeric null,
  currency text not null default 'EUR'
);

alter table business_value_settings enable row level security;

create policy if not exists "business_value_settings_select_owner" on business_value_settings
for select using (
  exists (
    select 1 from businesses b
    where b.id = business_value_settings.business_id and b.owner_id = auth.uid()
  )
);

create policy if not exists "business_value_settings_insert_owner" on business_value_settings
for insert with check (
  exists (
    select 1 from businesses b
    where b.id = business_value_settings.business_id and b.owner_id = auth.uid()
  )
);

create policy if not exists "business_value_settings_update_owner" on business_value_settings
for update using (
  exists (
    select 1 from businesses b
    where b.id = business_value_settings.business_id and b.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from businesses b
    where b.id = business_value_settings.business_id and b.owner_id = auth.uid()
  )
);
