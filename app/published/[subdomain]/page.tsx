import { redirect } from "next/navigation";
import { buildPublishedSiteUrl } from "@/lib/utils/published-site-url";

export default function PublishedRedirectPage({ params }: { params: { subdomain: string } }) {
  redirect(buildPublishedSiteUrl(params.subdomain));
}
