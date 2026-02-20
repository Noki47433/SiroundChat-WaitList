-- Summary: Adds publishing status for builder_sites.

alter table builder_sites drop constraint if exists builder_sites_status_check;
alter table builder_sites
  add constraint builder_sites_status_check
  check (status in ('draft', 'publishing', 'published'));
