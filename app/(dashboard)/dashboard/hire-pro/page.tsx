import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default function HireProPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Hire a Professional</p>
        <h2 className="text-3xl font-semibold">Get expert help for your site</h2>
        <p className="text-sm text-white/60">
          We are building a network of vetted designers and developers to help you launch faster.
        </p>
      </div>

      <Card>
        <div className="space-y-4">
          <Badge variant="info">Coming Soon</Badge>
          <p className="text-sm text-white/70">
            Leave your email and we will notify you when the marketplace opens.
          </p>
          <form className="flex flex-col gap-3 sm:flex-row">
            <Input name="email" type="email" placeholder="you@company.com" required />
            <Button type="submit" variant="primary">
              Notify me
            </Button>
          </form>
          <p className="text-xs text-white/40">We will only use your email for this update.</p>
        </div>
      </Card>
    </div>
  );
}
