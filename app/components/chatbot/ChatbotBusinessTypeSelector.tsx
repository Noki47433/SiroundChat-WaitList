// Summary: Lets the builder pick a business type so presets load the right FAQs; secondary detail, only need light understanding.
'use client';

import { BusinessType } from "./chatbotTypes";

type ChatbotBusinessTypeSelectorProps = {
  businessType: BusinessType;
  onChange: (businessType: BusinessType) => void;
};

const OPTIONS: { label: string; value: BusinessType }[] = [
  { label: "Restaurant", value: "restaurant" },
  { label: "Hotel", value: "hotel" },
  { label: "Cafe", value: "cafe" },
  { label: "Barber", value: "barber" },
  { label: "Real estate", value: "real_estate" },
  { label: "Clinic", value: "clinic" },
  { label: "Gym", value: "gym" },
  { label: "Taxi", value: "taxi" },
  { label: "E-commerce", value: "ecommerce" },
  { label: "Custom", value: "custom" }
];

export function ChatbotBusinessTypeSelector({ businessType, onChange }: ChatbotBusinessTypeSelectorProps) {
  return (
    <div className="space-y-2 rounded-2xl border border-slate-700 bg-slate-900/90 p-4">
      <p className="text-sm font-semibold text-slate-100">Business type</p>
      <select
        value={businessType}
        onChange={(event) => onChange(event.target.value as BusinessType)}
        className="w-full rounded-xl border border-slate-200 bg-black px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
        aria-label="Business type"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="bg-black text-slate-900">
            {option.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-200">Switching type loads tailored FAQ starters.</p>
    </div>
  );
}
