# SIRound Founder Dashboard Setup

## 1) Run migrations

Use your normal Supabase migration flow and include:

- `supabase/migrations/020_founder_admin_dashboard.sql`

This adds founder tables, triggers, admin policies, and compatibility sync from `chat_*` tables.

## 2) Enable replication for realtime tables

In Supabase Dashboard:

1. Open `Database` -> `Replication`.
2. Add these tables to the publication used by Realtime (`supabase_realtime`):
   - `events`
   - `conversations`
   - `messages`
   - `business_metrics_daily`
   - `business_metrics_realtime`
3. Save changes.

Without this step, websocket subscriptions will connect but no table change events will arrive.

## 3) Assign founder admin role

Set `profiles.role = 'admin'` for your user id.

Example SQL:

```sql
update profiles
set role = 'admin'
where id = '<your-auth-user-id>';
```

## 4) Seed sample data (optional)

```bash
SEED_OWNER_USER_ID=<auth-user-id> \
SEED_ADMIN_USER_ID=<auth-user-id> \
NEXT_PUBLIC_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/seed-founder-dashboard.mjs
```

## 5) Dev simulation endpoint

Generate live events quickly:

```bash
curl -X POST http://localhost:3000/api/dev/simulate-event \
  -H 'Content-Type: application/json' \
  -d '{"kind":"message"}'
```

Allowed `kind`: `message`, `lead`, `session`, `escalation`, `payment_failed`.
