-- Fix RLS policies so non-restaurant appointments (restaurant_id IS NULL)
-- are readable/writable by the business owner via is_business_owner(business_id).
-- Previously, all policies used can_access_restaurant(restaurant_id) which always
-- returned false for NULL restaurant_id, making chatbot-collected appointments
-- invisible in the dashboard.

DROP POLICY IF EXISTS reservations_select_access ON public.reservations;
CREATE POLICY reservations_select_access
ON public.reservations
FOR SELECT
USING (
  CASE
    WHEN restaurant_id IS NOT NULL THEN public.can_access_restaurant(restaurant_id)
    ELSE public.is_business_owner(business_id)
  END
);

DROP POLICY IF EXISTS reservations_update_access ON public.reservations;
CREATE POLICY reservations_update_access
ON public.reservations
FOR UPDATE
USING (
  CASE
    WHEN restaurant_id IS NOT NULL THEN public.can_access_restaurant(restaurant_id)
    ELSE public.is_business_owner(business_id)
  END
)
WITH CHECK (
  CASE
    WHEN restaurant_id IS NOT NULL THEN public.can_access_restaurant(restaurant_id)
    ELSE public.is_business_owner(business_id)
  END
);

DROP POLICY IF EXISTS reservations_insert_access ON public.reservations;
CREATE POLICY reservations_insert_access
ON public.reservations
FOR INSERT
WITH CHECK (
  CASE
    WHEN restaurant_id IS NOT NULL THEN public.can_access_restaurant(restaurant_id)
    ELSE public.is_business_owner(business_id)
  END
);
