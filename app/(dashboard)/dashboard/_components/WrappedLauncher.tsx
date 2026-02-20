"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WrappedModal } from "@/components/wrapped/WrappedModal";
import type { Period } from "@/lib/wrapped/computeWrapped";
import type { WrappedPostAction } from "@/components/wrapped/types";

export function WrappedLauncher({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Period>("weekly");
  const router = useRouter();

  const handleOpen = (nextMode: Period) => {
    setMode(nextMode);
    setOpen(true);
  };

  const handlePostAction = (action: WrappedPostAction) => {
    switch (action.type) {
      case "leads":
        router.push("/dashboard/leads");
        break;
      case "reservations":
        router.push("/dashboard/reservations");
        break;
      case "conversations":
        router.push("/dashboard/conversations");
        break;
      case "conversation":
        router.push(`/dashboard/conversations/${action.id}`);
        break;
      case "analytics":
      case "impact-details":
        router.push("/dashboard/analytics");
        break;
      case "settings":
        router.push("/dashboard/settings");
        break;
      default:
        break;
    }
  };

  return (
    <Card className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Impact wrapped</p>
        <p className="mt-1 text-xs text-white/60">A Spotify-Wrapped-style recap of your AI’s wins.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="primary" onClick={() => handleOpen("weekly")}>View Weekly Wrapped</Button>
        <Button type="button" variant="secondary" onClick={() => handleOpen("monthly")}>View Monthly Wrapped</Button>
      </div>

      <WrappedModal
        open={open}
        mode={mode}
        businessId={businessId}
        onClose={(action) => {
          setOpen(false);
          if (action) {
            handlePostAction(action);
          }
        }}
      />
    </Card>
  );
}
