-- Summary: Adds business_id + timestamp index for analytics events lookups.
create index if not exists analytics_events_business_id_timestamp_idx
  on analytics_events(business_id, timestamp desc);
