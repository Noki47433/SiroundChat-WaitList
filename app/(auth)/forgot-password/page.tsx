"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function ForgotPasswordContent() {
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) return;
    setStatus("sending");
    const supabase = getSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      setStatus("idle");
      push({ title: "Reset failed", message: error.message, variant: "error" });
      return;
    }
    setStatus("sent");
    push({ title: "Password reset link sent", message: "Check your inbox for the next steps.", variant: "success" });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <Card className="border-white/10 bg-white/5">
          <h1 className="text-2xl font-semibold">Reset your password</h1>
          <p className="mt-2 text-sm text-white/70">
            Enter the email linked to your account and we will send a reset link.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm text-white/70">Email address</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
            <Button type="submit" disabled={status === "sending"} className="w-full">
              {status === "sending" ? "Sending..." : status === "sent" ? "Sent" : "Send reset link"}
            </Button>
          </form>
          <div className="mt-6 text-sm text-white/60">
            Back to{" "}
            <Link href="/login" className="text-[#00A3FF]">
              login
            </Link>
            .
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <ToastProvider>
      <ForgotPasswordContent />
    </ToastProvider>
  );
}
