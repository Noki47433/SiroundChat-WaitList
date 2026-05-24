-- Summary: Extends builder_sites.template_key to support integrated template slugs.

alter table if exists public.builder_sites
  drop constraint if exists builder_sites_template_key_check;

alter table if exists public.builder_sites
  add constraint builder_sites_template_key_check
  check (
    template_key in (
      'restaurant_v1',
      'service_v1',
      'generic_v1',
      'evasion',
      'essence',
      'hously',
      'food-truck'
    )
  );
