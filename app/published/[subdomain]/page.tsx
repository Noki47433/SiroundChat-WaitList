import { redirect } from "next/navigation";

export default function PublishedRedirectPage({ params }: { params: { subdomain: string } }) {
  redirect(`/published/${params.subdomain}/index.html`);
}
