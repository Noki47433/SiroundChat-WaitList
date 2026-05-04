-- Replace BUSINESS_ID_HERE with the business you want to connect in your local/dev database.

insert into public.business_channels (
  business_id,
  channel_type,
  provider,
  status,
  whatsapp_phone_number_id,
  whatsapp_business_account_id,
  display_phone_number,
  auto_reply_enabled
) values (
  'BUSINESS_ID_HERE',
  'whatsapp',
  'meta',
  'connected',
  '1101681226367076',
  '2112045726250668',
  '1101681226367076',
  true
)
on conflict do nothing;
