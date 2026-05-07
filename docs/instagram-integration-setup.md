# Instagram Integration Setup

SiroundChat uses the shared Meta webhook, inbox, chatbot engine, and reservation flow for Instagram DMs.

## Current IDs

- Facebook Page ID: `1091067627420352`
- Instagram Business Account ID: `17841426807814654`

## Required Vercel environment variable

Set this in Vercel for the project:

- `META_PAGE_ACCESS_TOKEN`

SiroundChat will use `META_PAGE_ACCESS_TOKEN` first for Instagram sends. If it is missing, the code falls back to `META_ACCESS_TOKEN`.

## Required `business_channels` row

You need a connected `business_channels` row for the business:

- `channel_type = 'instagram'`
- `provider = 'meta'`
- `status = 'connected'`
- `auto_reply_enabled = true`
- `instagram_business_account_id = '17841426807814654'`
- `instagram_page_id = '1091067627420352'`

Example shape:

```sql
insert into business_channels (
  business_id,
  channel_type,
  provider,
  status,
  auto_reply_enabled,
  instagram_business_account_id,
  instagram_page_id
) values (
  'BUSINESS_ID_HERE',
  'instagram',
  'meta',
  'connected',
  true,
  '17841426807814654',
  '1091067627420352'
);
```

## Webhook subscription requirement

In Meta/Facebook Developers, the webhook app subscription must include message events for Instagram DMs. The shared webhook endpoint is:

- `https://siroundchat.com/api/meta/webhook`

Make sure the app is live and the relevant messaging subscription is enabled so inbound Instagram DM text events are delivered.
