"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import {
  ATMOSPHERE_BEST_FOR,
  RESTAURANT_DAY_KEYS,
  RESTAURANT_ONBOARDING_STEP_COUNT,
  RESERVATION_METHODS,
  buildRestaurantReviewLines,
  createDefaultRestaurantOnboardingData,
  generateRestaurantStarterKnowledge,
  getAtmosphereBestForLabel,
  getReservationMethodLabel,
  getRestaurantOnboardingCopy,
  sanitizeRestaurantOnboardingData,
  type OnboardingLanguage,
  type RestaurantOnboardingData,
  validateRestaurantOnboardingCompletion,
  validateRestaurantOnboardingStep
} from "@/lib/onboarding/restaurant";

type StepCardProps = {
  index: number;
  label: string;
  active: boolean;
  completed: boolean;
};

type FieldShellProps = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
};

type ChoiceButtonProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

type BooleanChoiceProps = {
  label: string;
  value: boolean | null;
  onChange: (next: boolean) => void;
  yesLabel: string;
  noLabel: string;
  hint?: string;
  error?: string;
};

const stepIndices = Array.from({ length: RESTAURANT_ONBOARDING_STEP_COUNT }, (_, index) => index);

function StepCard({ index, label, active, completed }: StepCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 transition-colors",
        active
          ? "border-[#00A3FF]/60 bg-[#00A3FF]/10 text-white"
          : completed
            ? "border-emerald-400/25 bg-emerald-400/10 text-white/90"
            : "border-white/10 bg-white/[0.03] text-white/65"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
            active
              ? "border-[#00A3FF] bg-[#00A3FF] text-white"
              : completed
                ? "border-emerald-400 bg-emerald-400 text-neutral-950"
                : "border-white/15 bg-white/[0.04] text-white/60"
          )}
        >
          {completed && !active ? <Check className="h-4 w-4" /> : index + 1}
        </div>
        <p className="text-sm font-medium">{label}</p>
      </div>
    </div>
  );
}

function FieldShell({ label, required, hint, error, children }: FieldShellProps) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white">{label}</span>
        {required ? <span className="text-sm font-semibold text-amber-300">*</span> : null}
      </div>
      {children}
      {hint ? <p className="text-xs text-white/45">{hint}</p> : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </label>
  );
}

function ChoiceButton({ active, onClick, children }: ChoiceButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors",
        active
          ? "border-[#00A3FF]/70 bg-[#00A3FF]/10 text-white"
          : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function BooleanChoice({ label, value, onChange, yesLabel, noLabel, hint, error }: BooleanChoiceProps) {
  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          {hint ? <p className="mt-1 text-xs text-white/45">{hint}</p> : null}
        </div>
      </div>
      <div className="flex gap-2">
        <ChoiceButton active={value === true} onClick={() => onChange(true)}>
          {yesLabel}
        </ChoiceButton>
        <ChoiceButton active={value === false} onClick={() => onChange(false)}>
          {noLabel}
        </ChoiceButton>
      </div>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

export default function RestaurantOnboardingClient() {
  const { push } = useToast();
  const [data, setData] = useState<RestaurantOnboardingData>(() => createDefaultRestaurantOnboardingData());
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const copy = getRestaurantOnboardingCopy(data.language);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/onboarding/restaurant", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) {
          throw new Error(payload?.error ?? "Failed to load onboarding.");
        }

        if (!active) return;
        setData(payload.data ?? createDefaultRestaurantOnboardingData());
        setCurrentStep(
          typeof payload?.data?.currentStep === "number"
            ? Math.min(Math.max(payload.data.currentStep, 0), RESTAURANT_ONBOARDING_STEP_COUNT - 1)
            : 0
        );
        setCompletedAt(payload.completedAt ?? null);
      } catch (error) {
        if (!active) return;
        push({
          title: "Could not load onboarding",
          message: error instanceof Error ? error.message : "Unknown error",
          variant: "error"
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [push]);

  const reviewLines = useMemo(() => buildRestaurantReviewLines(data), [data]);
  const knowledgePreview = useMemo(() => generateRestaurantStarterKnowledge(data), [data]);

  const setAndClearError = (updater: (prev: RestaurantOnboardingData) => RestaurantOnboardingData, keys: string[]) => {
    setData((prev) => updater(prev));
    if (!keys.length) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      keys.forEach((key) => delete next[key]);
      return next;
    });
  };

  const savePayload = async (nextData: RestaurantOnboardingData, stepIndex: number, complete = false) => {
    setSaving(true);
    try {
      const response = await fetch("/api/onboarding/restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: sanitizeRestaurantOnboardingData(nextData),
          stepIndex,
          complete
        })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        if (payload?.error?.fieldErrors) {
          setFieldErrors(payload.error.fieldErrors as Record<string, string>);
        }
        throw new Error(
          payload?.error?.generalErrors?.[0] ||
            payload?.error?.message ||
            payload?.error ||
            "Could not save onboarding."
        );
      }

      setFieldErrors({});
      setLastSavedAt(new Date().toISOString());

      if (complete) {
        setCompletedAt(payload?.completedAt ?? new Date().toISOString());
      } else if (payload?.completedAt) {
        setCompletedAt(payload.completedAt);
      }
    } catch (error) {
      push({
        title: "Save failed",
        message: error instanceof Error ? error.message : "Unknown error",
        variant: "error"
      });
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const validateCurrentStep = () => {
    const validation =
      currentStep === RESTAURANT_ONBOARDING_STEP_COUNT - 1
        ? validateRestaurantOnboardingCompletion(data)
        : validateRestaurantOnboardingStep(data, currentStep);

    setFieldErrors(validation.fieldErrors);
    if (validation.generalErrors.length) {
      push({
        title: "Check this step",
        message: validation.generalErrors[0],
        variant: "error"
      });
      return false;
    }
    return true;
  };

  const handleContinue = async () => {
    if (!validateCurrentStep()) return;
    const nextStep = Math.min(currentStep + 1, RESTAURANT_ONBOARDING_STEP_COUNT - 1);
    const nextData = sanitizeRestaurantOnboardingData({ ...data, currentStep: nextStep });
    await savePayload(nextData, currentStep, false);
    setData(nextData);
    setCurrentStep(nextStep);
  };

  const handleBack = () => {
    const nextStep = Math.max(currentStep - 1, 0);
    setCurrentStep(nextStep);
    setData((prev) => ({ ...prev, currentStep: nextStep }));
    setFieldErrors({});
  };

  const handleFinish = async () => {
    const validation = validateRestaurantOnboardingCompletion(data);
    setFieldErrors(validation.fieldErrors);
    if (validation.generalErrors.length) {
      push({
        title: "Finish blocked",
        message: validation.generalErrors[0],
        variant: "error"
      });
      return;
    }

    const nextData = sanitizeRestaurantOnboardingData({
      ...data,
      currentStep: RESTAURANT_ONBOARDING_STEP_COUNT - 1
    });
    await savePayload(nextData, currentStep, true);
    setData(nextData);
    setCurrentStep(RESTAURANT_ONBOARDING_STEP_COUNT - 1);
    push({
      title: completedAt ? "Onboarding updated" : "Onboarding complete",
      message: copy.completedDescription,
      variant: "success"
    });
  };

  const renderError = (key: string) => fieldErrors[key];

  const renderStepContent = () => {
    if (currentStep === 0) {
      return (
        <div className="space-y-4">
          <ChoiceButton
            active={data.industry === "restaurant"}
            onClick={() => setAndClearError((prev) => ({ ...prev, industry: "restaurant" }), ["industry"])}
          >
            <p className="font-semibold">{copy.restaurantLabel}</p>
            <p className="mt-1 text-xs text-white/55">{copy.restaurantDescription}</p>
          </ChoiceButton>
          {renderError("industry") ? <p className="text-xs text-rose-300">{renderError("industry")}</p> : null}
        </div>
      );
    }

    if (currentStep === 1) {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          {(["en", "sq"] as OnboardingLanguage[]).map((language) => (
            <ChoiceButton
              key={language}
              active={data.language === language}
              onClick={() => setAndClearError((prev) => ({ ...prev, language }), ["language"])}
            >
              <p className="font-semibold">{copy.languageOptions[language]}</p>
              <p className="mt-1 text-xs text-white/55">
                {data.language === "sq"
                  ? language === "en"
                    ? "Etiketat, ndihmat, validimi dhe dija fillestare do të jenë në anglisht."
                    : "Etiketat, ndihmat, validimi dhe dija fillestare do të jenë në shqip."
                  : language === "en"
                    ? "Labels, helpers, validation, and starter knowledge will use English."
                    : "Labels, helpers, validation, and starter knowledge will use Albanian."}
              </p>
            </ChoiceButton>
          ))}
          {renderError("language") ? <p className="text-xs text-rose-300">{renderError("language")}</p> : null}
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <FieldShell label={copy.fieldLabels.restaurantName} required error={renderError("restaurantName")}>
            <Input
              value={data.restaurantName}
              onChange={(event) =>
                setAndClearError((prev) => ({ ...prev, restaurantName: event.target.value }), ["restaurantName"])
              }
              placeholder={copy.placeholders.restaurantName}
            />
          </FieldShell>
          <FieldShell label={copy.fieldLabels.cuisineType} required error={renderError("cuisineType")}>
            <Input
              value={data.cuisineType}
              onChange={(event) =>
                setAndClearError((prev) => ({ ...prev, cuisineType: event.target.value }), ["cuisineType"])
              }
              placeholder={copy.placeholders.cuisineType}
            />
          </FieldShell>
          <FieldShell
            label={copy.fieldLabels.shortDescription}
            required
            hint={copy.hints.shortDescription}
            error={renderError("shortDescription")}
          >
            <Textarea
              value={data.shortDescription}
              onChange={(event) =>
                setAndClearError((prev) => ({ ...prev, shortDescription: event.target.value }), ["shortDescription"])
              }
              placeholder={copy.placeholders.shortDescription}
              className="min-h-[120px]"
            />
          </FieldShell>
          <div className="grid gap-4">
            <FieldShell label={copy.fieldLabels.address} required error={renderError("address")}>
              <Input
                value={data.address}
                onChange={(event) => setAndClearError((prev) => ({ ...prev, address: event.target.value }), ["address"])}
                placeholder={copy.placeholders.address}
              />
            </FieldShell>
            <FieldShell label={copy.fieldLabels.city} required error={renderError("city")}>
              <Input
                value={data.city}
                onChange={(event) => setAndClearError((prev) => ({ ...prev, city: event.target.value }), ["city"])}
                placeholder={copy.placeholders.city}
              />
            </FieldShell>
          </div>
          <FieldShell label={copy.fieldLabels.phone} required error={renderError("phone")}>
            <Input
              value={data.phone}
              onChange={(event) => setAndClearError((prev) => ({ ...prev, phone: event.target.value }), ["phone"])}
              placeholder={copy.placeholders.phone}
            />
          </FieldShell>
          <FieldShell label={copy.fieldLabels.whatsappPhone}>
            <Input
              value={data.whatsappPhone}
              onChange={(event) =>
                setAndClearError((prev) => ({ ...prev, whatsappPhone: event.target.value }), ["whatsappPhone"])
              }
              placeholder={copy.placeholders.whatsappPhone}
            />
          </FieldShell>
          <FieldShell label={copy.fieldLabels.email}>
            <Input
              value={data.email}
              onChange={(event) => setAndClearError((prev) => ({ ...prev, email: event.target.value }), ["email"])}
              placeholder={copy.placeholders.email}
            />
          </FieldShell>
          <FieldShell label={copy.fieldLabels.website}>
            <Input
              value={data.website}
              onChange={(event) => setAndClearError((prev) => ({ ...prev, website: event.target.value }), ["website"])}
              placeholder={copy.placeholders.website}
            />
          </FieldShell>
          <div className="md:col-span-2">
            <FieldShell label={copy.fieldLabels.socialLinks} hint={copy.hints.socialLinks}>
              <Input
                value={data.socialLinks}
                onChange={(event) =>
                  setAndClearError((prev) => ({ ...prev, socialLinks: event.target.value }), ["socialLinks"])
                }
                placeholder={copy.placeholders.socialLinks}
              />
            </FieldShell>
          </div>
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="space-y-3">
          <p className="text-xs text-white/45">{copy.hints.hours}</p>
          {renderError("hours") ? <p className="text-xs text-rose-300">{renderError("hours")}</p> : null}
          {RESTAURANT_DAY_KEYS.map((day) => {
            const row = data.hours[day];
            return (
              <div key={day} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="w-full lg:max-w-[180px]">
                    <p className="text-sm font-semibold text-white">{copy.dayLabels[day]}</p>
                    <div className="mt-3 flex items-center gap-3 text-sm text-white/70">
                      <Switch
                        checked={row.closed}
                        onChange={(event) =>
                          setAndClearError(
                            (prev) => ({
                              ...prev,
                              hours: {
                                ...prev.hours,
                                [day]: {
                                  ...prev.hours[day],
                                  closed: event.target.checked
                                }
                              }
                            }),
                            [`hours.${day}`, "hours"]
                          )
                        }
                      />
                      <span>{row.closed ? copy.closed : copy.open}</span>
                    </div>
                  </div>

                  <div className="grid w-full gap-3 md:grid-cols-[1fr_1fr_2fr]">
                    <FieldShell label={copy.fieldLabels.openTime}>
                      <Input
                        type="time"
                        value={row.open}
                        disabled={row.closed}
                        onChange={(event) =>
                          setAndClearError(
                            (prev) => ({
                              ...prev,
                              hours: {
                                ...prev.hours,
                                [day]: {
                                  ...prev.hours[day],
                                  open: event.target.value
                                }
                              }
                            }),
                            [`hours.${day}`, "hours"]
                          )
                        }
                      />
                    </FieldShell>
                    <FieldShell label={copy.fieldLabels.closeTime}>
                      <Input
                        type="time"
                        value={row.close}
                        disabled={row.closed}
                        onChange={(event) =>
                          setAndClearError(
                            (prev) => ({
                              ...prev,
                              hours: {
                                ...prev.hours,
                                [day]: {
                                  ...prev.hours[day],
                                  close: event.target.value
                                }
                              }
                            }),
                            [`hours.${day}`, "hours"]
                          )
                        }
                      />
                    </FieldShell>
                    <FieldShell label={copy.fieldLabels.dayNote} hint={copy.placeholders.dayNote}>
                      <Input
                        value={row.note}
                        disabled={row.closed}
                        onChange={(event) =>
                          setAndClearError(
                            (prev) => ({
                              ...prev,
                              hours: {
                                ...prev.hours,
                                [day]: {
                                  ...prev.hours[day],
                                  note: event.target.value
                                }
                              }
                            }),
                            [`hours.${day}`]
                          )
                        }
                        placeholder={copy.placeholders.dayNote}
                      />
                    </FieldShell>
                  </div>
                </div>
                {renderError(`hours.${day}`) ? <p className="mt-3 text-xs text-rose-300">{renderError(`hours.${day}`)}</p> : null}
              </div>
            );
          })}
        </div>
      );
    }

    if (currentStep === 4) {
      return (
        <div className="space-y-4">
          <BooleanChoice
            label={copy.fieldLabels.acceptsReservations}
            value={data.reservationSettings.acceptsReservations}
            onChange={(next) =>
              setAndClearError(
                (prev) => ({
                  ...prev,
                  reservationSettings: {
                    ...prev.reservationSettings,
                    acceptsReservations: next
                  }
                }),
                ["acceptsReservations", "reservationMethods"]
              )
            }
            yesLabel={copy.yes}
            noLabel={copy.no}
            error={renderError("acceptsReservations")}
          />

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <FieldShell
              label={copy.fieldLabels.reservationMethods}
              hint={copy.hints.reservations}
              error={renderError("reservationMethods")}
            >
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {RESERVATION_METHODS.map((method) => {
                  const active = data.reservationSettings.methods.includes(method);
                  return (
                    <ChoiceButton
                      key={method}
                      active={active}
                      onClick={() =>
                        setAndClearError(
                          (prev) => ({
                            ...prev,
                            reservationSettings: {
                              ...prev.reservationSettings,
                              methods: active
                                ? prev.reservationSettings.methods.filter((item) => item !== method)
                                : [...prev.reservationSettings.methods, method]
                            }
                          }),
                          ["reservationMethods"]
                        )
                      }
                    >
                      {getReservationMethodLabel(method, data.language)}
                    </ChoiceButton>
                  );
                })}
              </div>
            </FieldShell>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FieldShell label={copy.fieldLabels.reservationOtherMethod}>
                <Input
                  value={data.reservationSettings.otherMethod}
                  onChange={(event) =>
                    setAndClearError(
                      (prev) => ({
                        ...prev,
                        reservationSettings: {
                          ...prev.reservationSettings,
                          otherMethod: event.target.value
                        }
                      }),
                      ["reservationMethods"]
                    )
                  }
                  placeholder={copy.placeholders.reservationOtherMethod}
                />
              </FieldShell>
              <FieldShell label={copy.fieldLabels.maxGroupSize}>
                <Input
                  inputMode="numeric"
                  value={data.reservationSettings.maxGroupSize}
                  onChange={(event) =>
                    setAndClearError(
                      (prev) => ({
                        ...prev,
                        reservationSettings: {
                          ...prev.reservationSettings,
                          maxGroupSize: event.target.value.replace(/[^\d]/g, "")
                        }
                      }),
                      ["maxGroupSize"]
                    )
                  }
                  placeholder="8"
                />
              </FieldShell>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <BooleanChoice
                label={copy.fieldLabels.sameDay}
                value={data.reservationSettings.sameDay}
                onChange={(next) =>
                  setAndClearError(
                    (prev) => ({
                      ...prev,
                      reservationSettings: {
                        ...prev.reservationSettings,
                        sameDay: next
                      }
                    }),
                    ["sameDay"]
                  )
                }
                yesLabel={copy.yes}
                noLabel={copy.no}
              />
              <BooleanChoice
                label={copy.fieldLabels.largeGroupConfirmationRequired}
                value={data.reservationSettings.largeGroupConfirmationRequired}
                onChange={(next) =>
                  setAndClearError(
                    (prev) => ({
                      ...prev,
                      reservationSettings: {
                        ...prev.reservationSettings,
                        largeGroupConfirmationRequired: next
                      }
                    }),
                    ["largeGroupConfirmationRequired"]
                  )
                }
                yesLabel={copy.yes}
                noLabel={copy.no}
              />
            </div>

            <div className="mt-4">
              <FieldShell label={copy.fieldLabels.reservationPolicyNotes}>
                <Textarea
                  value={data.reservationSettings.policyNotes}
                  onChange={(event) =>
                    setAndClearError(
                      (prev) => ({
                        ...prev,
                        reservationSettings: {
                          ...prev.reservationSettings,
                          policyNotes: event.target.value
                        }
                      }),
                      ["reservationMethods"]
                    )
                  }
                  placeholder={copy.placeholders.reservationPolicyNotes}
                  className="min-h-[120px]"
                />
              </FieldShell>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 5) {
      const boolQuestions = [
        { key: "vegetarian", label: copy.fieldLabels.vegetarian },
        { key: "vegan", label: copy.fieldLabels.vegan },
        { key: "glutenFree", label: copy.fieldLabels.glutenFree },
        { key: "takeaway", label: copy.fieldLabels.takeaway },
        { key: "delivery", label: copy.fieldLabels.delivery },
        { key: "outdoorSeating", label: copy.fieldLabels.outdoorSeating },
        { key: "parking", label: copy.fieldLabels.parking },
        { key: "kidsFriendly", label: copy.fieldLabels.kidsFriendly },
        { key: "cardPayments", label: copy.fieldLabels.cardPayments },
        { key: "cashPayments", label: copy.fieldLabels.cashPayments }
      ] as const;

      return (
        <div className="space-y-4">
          <FieldShell
            label={copy.fieldLabels.menuHighlights}
            required
            hint={copy.hints.menuHighlights}
            error={renderError("menuHighlights")}
          >
            <Textarea
              value={data.serviceFeatures.menuHighlights}
              onChange={(event) =>
                setAndClearError(
                  (prev) => ({
                    ...prev,
                    serviceFeatures: {
                      ...prev.serviceFeatures,
                      menuHighlights: event.target.value
                    }
                  }),
                  ["menuHighlights"]
                )
              }
              placeholder={copy.placeholders.menuHighlights}
              className="min-h-[120px]"
            />
          </FieldShell>

          <div className="grid gap-4 md:grid-cols-2">
            {boolQuestions.map((item) => (
              <BooleanChoice
                key={item.key}
                label={item.label}
                value={data.serviceFeatures[item.key]}
                onChange={(next) =>
                  setAndClearError(
                    (prev) => ({
                      ...prev,
                      serviceFeatures: {
                        ...prev.serviceFeatures,
                        [item.key]: next
                      }
                    }),
                    [item.key]
                  )
                }
                yesLabel={copy.yes}
                noLabel={copy.no}
                error={renderError(item.key)}
              />
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FieldShell label={copy.fieldLabels.specialOfferings}>
              <Textarea
                value={data.serviceFeatures.specialOfferings}
                onChange={(event) =>
                  setAndClearError(
                    (prev) => ({
                      ...prev,
                      serviceFeatures: {
                        ...prev.serviceFeatures,
                        specialOfferings: event.target.value
                      }
                    }),
                    ["menuHighlights"]
                  )
                }
                placeholder={copy.placeholders.specialOfferings}
                className="min-h-[110px]"
              />
            </FieldShell>
            <FieldShell label={copy.fieldLabels.popularDishes}>
              <Textarea
                value={data.serviceFeatures.popularDishes}
                onChange={(event) =>
                  setAndClearError(
                    (prev) => ({
                      ...prev,
                      serviceFeatures: {
                        ...prev.serviceFeatures,
                        popularDishes: event.target.value
                      }
                    }),
                    ["menuHighlights"]
                  )
                }
                placeholder={copy.placeholders.popularDishes}
                className="min-h-[110px]"
              />
            </FieldShell>
          </div>

          <FieldShell label={copy.fieldLabels.serviceNotes}>
            <Textarea
              value={data.serviceFeatures.serviceNotes}
              onChange={(event) =>
                setAndClearError(
                  (prev) => ({
                    ...prev,
                    serviceFeatures: {
                      ...prev.serviceFeatures,
                      serviceNotes: event.target.value
                    }
                  }),
                  ["menuHighlights"]
                )
              }
              placeholder={copy.placeholders.serviceNotes}
              className="min-h-[120px]"
            />
          </FieldShell>
        </div>
      );
    }

    if (currentStep === 6) {
      return (
        <div className="space-y-4">
          <FieldShell label={copy.fieldLabels.atmosphereDescription}>
            <Textarea
              value={data.atmosphere.description}
              onChange={(event) =>
                setAndClearError(
                  (prev) => ({
                    ...prev,
                    atmosphere: {
                      ...prev.atmosphere,
                      description: event.target.value
                    }
                  }),
                  ["atmosphereDescription"]
                )
              }
              placeholder={copy.placeholders.atmosphereDescription}
              className="min-h-[120px]"
            />
          </FieldShell>

          <FieldShell label={copy.fieldLabels.atmosphereBestFor}>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {ATMOSPHERE_BEST_FOR.map((item) => {
                const active = data.atmosphere.bestFor.includes(item);
                return (
                  <ChoiceButton
                    key={item}
                    active={active}
                    onClick={() =>
                      setAndClearError(
                        (prev) => ({
                          ...prev,
                          atmosphere: {
                            ...prev.atmosphere,
                            bestFor: active
                              ? prev.atmosphere.bestFor.filter((entry) => entry !== item)
                              : [...prev.atmosphere.bestFor, item]
                          }
                        }),
                        ["atmosphereBestFor"]
                      )
                    }
                  >
                    {getAtmosphereBestForLabel(item, data.language)}
                  </ChoiceButton>
                );
              })}
            </div>
          </FieldShell>

          <FieldShell label={copy.fieldLabels.atmosphereNotes}>
            <Textarea
              value={data.atmosphere.notes}
              onChange={(event) =>
                setAndClearError(
                  (prev) => ({
                    ...prev,
                    atmosphere: {
                      ...prev.atmosphere,
                      notes: event.target.value
                    }
                  }),
                  ["atmosphereNotes"]
                )
              }
              placeholder={copy.placeholders.atmosphereNotes}
              className="min-h-[120px]"
            />
          </FieldShell>
        </div>
      );
    }

    if (currentStep === 7) {
      return (
        <FieldShell
          label={copy.fieldLabels.additionalInfoRaw}
          hint={copy.hints.additionalInfoRaw}
        >
          <Textarea
            value={data.additionalInfoRaw}
            onChange={(event) => setAndClearError((prev) => ({ ...prev, additionalInfoRaw: event.target.value }), ["additionalInfoRaw"])}
            className="min-h-[240px]"
            placeholder={copy.hints.additionalInfoRaw}
          />
        </FieldShell>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { key: "basics", title: copy.reviewSections.basics, lines: reviewLines.basics, step: 2 },
            { key: "hours", title: copy.reviewSections.hours, lines: reviewLines.hours, step: 3 },
            { key: "reservations", title: copy.reviewSections.reservations, lines: reviewLines.reservations, step: 4 },
            { key: "service", title: copy.reviewSections.service, lines: reviewLines.service, step: 5 },
            { key: "atmosphere", title: copy.reviewSections.atmosphere, lines: reviewLines.atmosphere, step: 6 },
            { key: "additionalInfo", title: copy.reviewSections.additionalInfo, lines: reviewLines.additionalInfo, step: 7 }
          ].map((section) => (
            <div key={section.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-white">{section.title}</p>
                <button
                  type="button"
                  onClick={() => setCurrentStep(section.step)}
                  className="text-xs font-semibold text-[#72c5ff] hover:text-white"
                >
                  {copy.editStep}
                </button>
              </div>
              <div className="mt-3 space-y-2 text-sm text-white/72">
                {section.lines.map((line, index) => (
                  <p key={`${section.key}-${index}`}>{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
          <p className="text-sm font-semibold text-white">{copy.knowledgePreviewTitle}</p>
          <p className="mt-1 text-xs text-white/60">{copy.knowledgePreviewDescription}</p>
          <Textarea value={knowledgePreview} readOnly className="mt-4 min-h-[360px] resize-none bg-neutral-950/80" />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
          {copy.documentsNote}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Onboarding</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{copy.pageTitle}</h2>
        </div>
        <Card className="flex min-h-[420px] items-center justify-center">
          <div className="flex items-center gap-3 text-white/70">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading onboarding…</span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Onboarding</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{copy.pageTitle}</h2>
          <p className="mt-2 max-w-3xl text-sm text-white/60">{copy.pageDescription}</p>
        </div>
        <div className="min-w-[220px] rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
            {copy.selectLanguageLabel}
          </label>
          <Select
            className="mt-3"
            value={data.language}
            onChange={(event) =>
              setAndClearError((prev) => ({ ...prev, language: event.target.value as OnboardingLanguage }), ["language"])
            }
          >
            <option value="en">{copy.languageOptions.en}</option>
            <option value="sq">{copy.languageOptions.sq}</option>
          </Select>
          {lastSavedAt ? (
            <p className="mt-3 text-xs text-white/45">
              {copy.draftSaved}: {new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          ) : null}
        </div>
      </div>

      {completedAt ? (
        <Card className="border-emerald-400/20 bg-emerald-400/10">
          <p className="text-sm font-semibold text-white">{copy.completedTitle}</p>
          <p className="mt-2 text-sm text-white/70">{copy.completedDescription}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center rounded-xl bg-white px-5 text-sm font-semibold text-neutral-950 hover:bg-white/90"
            >
              {data.language === "sq" ? "Pulti" : "Dashboard"}
            </Link>
            <Link
              href="/dashboard/bot-settings"
              className="inline-flex h-11 items-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-white hover:bg-white/5"
            >
              {data.language === "sq" ? "Cilësimet e Botit" : "Bot Settings"}
            </Link>
            <Link
              href="/dashboard/documents"
              className="inline-flex h-11 items-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-white hover:bg-white/5"
            >
              {data.language === "sq" ? "Dokumentet" : "Documents"}
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                {copy.stepLabel} {currentStep + 1}/{RESTAURANT_ONBOARDING_STEP_COUNT}
              </p>
              <p className="mt-1 text-sm text-white/60">{copy.stepLabels[currentStep]}</p>
            </div>
          </div>
          <div className="space-y-2">
            {stepIndices.map((index) => (
              <StepCard
                key={index}
                index={index}
                label={copy.stepLabels[index]}
                active={index === currentStep}
                completed={index < currentStep || Boolean(completedAt && index === currentStep)}
              />
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">
              {copy.stepLabel} {currentStep + 1}
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              {
                [
                  copy.industryStepTitle,
                  copy.languageStepTitle,
                  copy.basicsStepTitle,
                  copy.hoursStepTitle,
                  copy.reservationsStepTitle,
                  copy.serviceStepTitle,
                  copy.atmosphereStepTitle,
                  copy.additionalInfoStepTitle,
                  copy.reviewStepTitle
                ][currentStep]
              }
            </h3>
            <p className="mt-2 text-sm text-white/60">
              {
                [
                  copy.industryStepDescription,
                  copy.languageStepDescription,
                  copy.basicsStepDescription,
                  copy.hoursStepDescription,
                  copy.reservationsStepDescription,
                  copy.serviceStepDescription,
                  copy.atmosphereStepDescription,
                  copy.additionalInfoStepDescription,
                  copy.reviewStepDescription
                ][currentStep]
              }
            </p>
          </div>

          {renderStepContent()}

          <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-white/45">
              {currentStep === RESTAURANT_ONBOARDING_STEP_COUNT - 1 ? copy.documentsNote : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={handleBack} disabled={saving || currentStep === 0}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                {copy.back}
              </Button>
              {currentStep === RESTAURANT_ONBOARDING_STEP_COUNT - 1 ? (
                <Button onClick={() => void handleFinish()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {completedAt ? copy.saveUpdates : copy.finish}
                </Button>
              ) : (
                <Button onClick={() => void handleContinue()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                  {copy.saveAndContinue}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
