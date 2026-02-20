// Summary: Secondary picker that lists available chatbot avatar icons.
'use client';

import { motion } from "framer-motion";
import {
  Utensils,
  Hotel,
  Coffee,
  Scissors,
  Building2,
  Stethoscope,
  Dumbbell,
  Car,
  ShoppingBag,
  Sparkles
} from "lucide-react";

export type IconEntry = { id: string; label: string; Icon: typeof Utensils };

export const ICON_LIBRARY: IconEntry[] = [
  { id: "restaurant-1", label: "Restaurant", Icon: Utensils },
  { id: "hotel-1", label: "Hotel", Icon: Hotel },
  { id: "cafe-1", label: "Cafe", Icon: Coffee },
  { id: "barber-1", label: "Barber", Icon: Scissors },
  { id: "realestate-1", label: "Real estate", Icon: Building2 },
  { id: "clinic-1", label: "Clinic", Icon: Stethoscope },
  { id: "gym-1", label: "Gym", Icon: Dumbbell },
  { id: "taxi-1", label: "Taxi", Icon: Car },
  { id: "ecommerce-1", label: "E-commerce", Icon: ShoppingBag },
  { id: "custom-1", label: "Spark", Icon: Sparkles }
];

type ChatbotIconLibraryProps = {
  selectedIconId?: string | null;
  onSelectIcon: (iconId: string) => void;
};

export function ChatbotIconLibrary({ selectedIconId, onSelectIcon }: ChatbotIconLibraryProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/90 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-100">Icon library</p>
        <span className="text-xs text-slate-400">Pick if you have no logo</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {ICON_LIBRARY.map((entry) => {
          const isActive = entry.id === selectedIconId;
          return (
            <motion.button
              key={entry.id}
              type="button"
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectIcon(entry.id)}
              className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold transition ${
                isActive
                  ? "border-sky-400 bg-sky-500/10 text-sky-100 shadow-[0_10px_30px_rgba(14,165,233,0.25)]"
                  : "border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-400/70 hover:bg-slate-800/80"
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  isActive ? "bg-sky-500/15 text-sky-100" : "bg-slate-700/60 text-slate-100"
                }`}
              >
                <entry.Icon className="h-5 w-5" />
              </div>
              <span className="text-[11px] text-center leading-tight">{entry.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
