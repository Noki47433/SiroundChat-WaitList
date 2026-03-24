import { redirect } from "next/navigation";

const toQueryString = (searchParams?: Record<string, string | string[] | undefined>) => {
  const params = new URLSearchParams();
  if (!searchParams) return "";

  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === "string") {
      params.set(key, value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    }
  });

  return params.toString();
};

export default function DashboardBillingRedirect({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const query = toQueryString(searchParams);
  redirect(query ? `/billing?${query}` : "/billing");
}
