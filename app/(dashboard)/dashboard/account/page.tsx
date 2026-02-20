import { getAccountProfile } from "@/lib/api.server";
import { AccountPanel } from "@/app/(dashboard)/dashboard/_components/AccountPanel";

export default async function AccountPage() {
  const profile = await getAccountProfile();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Account</p>
        <h2 className="mt-2 text-3xl font-semibold">Profile & preferences</h2>
        <p className="mt-2 text-sm text-white/60">Manage your personal settings and sign-out options.</p>
      </div>
      <AccountPanel initial={profile} />
    </div>
  );
}
