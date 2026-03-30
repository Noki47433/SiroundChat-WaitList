update public.businesses
set launch_access = true
where coalesce(launch_access, false) = false;
