"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { BillingPlan, BillingState } from "@/lib/types";
import { payByInvoice, upgradePlan } from "@/lib/api";

export function BillingPanel({ plans, initialState }: { plans: BillingPlan[]; initialState: BillingState }) {
  const { push } = useToast();
  const [state, setState] = useState(initialState);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<BillingPlan["id"] | null>(null);
  const [invoiceEmail, setInvoiceEmail] = useState("");

  const currentPlan = useMemo(
    () => plans.find((plan) => plan.id === state.currentPlan) ?? plans[0],
    [plans, state.currentPlan]
  );

  const handleUpgrade = async () => {
    if (!selectedPlanId) return;
    const updated = await upgradePlan(selectedPlanId);
    setState(updated);
    setUpgradeOpen(false);
    push({ title: "Upgrade started", message: "Payment is pending approval.", variant: "info" });
  };

  const handleInvoice = async () => {
    if (!invoiceEmail) return;
    const updated = await payByInvoice();
    setState(updated);
    setInvoiceOpen(false);
    push({ title: "Invoice requested", message: "We will email the invoice shortly.", variant: "success" });
    setInvoiceEmail("");
  };

  return (
    <div className="space-y-6">
      {state.status === "pending" ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="warning">Payment pending</Badge>
            <span>We are waiting for confirmation. We will notify you once it clears.</span>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <Card className="space-y-4">
          <div>
            <p className="text-sm font-semibold">Current plan</p>
            <p className="text-xs text-white/60">Active until {state.renewalDate}</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-2xl font-semibold">{currentPlan?.name}</p>
            <Badge variant={state.status === "pending" ? "warning" : "success"}>
              {state.status === "pending" ? "Pending" : "Active"}
            </Badge>
          </div>
          <p className="text-sm text-white/70">{currentPlan?.price} / billed monthly</p>
          <ul className="space-y-2 text-sm text-white/70">
            {currentPlan?.features.map((feature) => (
              <li key={feature} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                {feature}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-4">
          <div>
            <p className="text-sm font-semibold">Manual payment</p>
            <p className="text-xs text-white/60">Prefer a manual invoice workflow.</p>
          </div>
          <Button variant="outline" onClick={() => setInvoiceOpen(true)}>
            Pay via invoice
          </Button>
          <p className="text-xs text-white/50">We will email an invoice with payment instructions.</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = plan.id === state.currentPlan;
          return (
            <Card key={plan.id} className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold">{plan.name}</p>
                  <p className="text-sm text-white/60">{plan.price}</p>
                </div>
                {isCurrent ? <Badge variant="info">Current</Badge> : null}
              </div>
              <ul className="space-y-2 text-sm text-white/70">
                {plan.features.map((feature) => (
                  <li key={feature} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    {feature}
                  </li>
                ))}
              </ul>
              <div>
                {isCurrent ? (
                  <p className="text-xs text-white/60">Active plan</p>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => {
                      setSelectedPlanId(plan.id);
                      setUpgradeOpen(true);
                    }}
                  >
                    Upgrade
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title="Confirm plan upgrade"
        footer={
          <>
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUpgrade}>
              Confirm upgrade
            </Button>
          </>
        }
      >
        You are about to move to the {plans.find((plan) => plan.id === selectedPlanId)?.name ?? "new"} plan. The
        upgrade will stay in pending status until payment is confirmed.
      </Modal>

      <Modal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        title="Request an invoice"
        footer={
          <>
            <Button variant="outline" onClick={() => setInvoiceOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleInvoice} disabled={!invoiceEmail}>
              Request invoice
            </Button>
          </>
        }
      >
        <label className="text-sm text-white/70">
          Invoice email
          <Input
            value={invoiceEmail}
            onChange={(event) => setInvoiceEmail(event.target.value)}
            placeholder="billing@company.com"
            type="email"
          />
        </label>
        <p className="text-xs text-white/50">
          We will send billing instructions to this address.
        </p>
      </Modal>
    </div>
  );
}
