-- Step 1: enum-only migration.
-- IMPORTANT: Do not use the new enum value in this same migration transaction.

do $$
begin
  if exists (select 1 from pg_type where typname = 'plan_id_enum') then
    alter type plan_id_enum add value if not exists 'chatbot';
  end if;
end;
$$;
