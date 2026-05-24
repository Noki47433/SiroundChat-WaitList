"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, Loader2, Save, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast";

type SaveFn = () => Promise<void>;
type SaveState = "idle" | "saving" | "saved" | "error";

type BotSettingsSaveContextValue = {
  registerSave: (key: string, fn: SaveFn) => void;
  unregisterSave: (key: string) => void;
};

const BotSettingsSaveContext = createContext<BotSettingsSaveContextValue>({
  registerSave: () => {},
  unregisterSave: () => {},
});

export function useBotSettingsSave() {
  return useContext(BotSettingsSaveContext);
}

export function BotSettingsLayout({ children }: { children: React.ReactNode }) {
  const { push } = useToast();
  const saveFnsRef = useRef<Map<string, SaveFn>>(new Map());
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const registerSave = useCallback((key: string, fn: SaveFn) => {
    saveFnsRef.current.set(key, fn);
  }, []);

  const unregisterSave = useCallback((key: string) => {
    saveFnsRef.current.delete(key);
  }, []);

  const handleSaveAll = async () => {
    if (saveState === "saving") return;
    setSaveState("saving");

    const fns = Array.from(saveFnsRef.current.values());
    const results = await Promise.allSettled(fns.map((fn) => fn()));

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      setSaveState("error");
      push({ title: "Save failed", message: "Some settings could not be saved. Please try again.", variant: "error" });
      setTimeout(() => setSaveState("idle"), 3500);
    } else {
      setSaveState("saved");
      push({ title: "Settings saved", message: "All bot settings have been updated.", variant: "success" });
      setTimeout(() => setSaveState("idle"), 2500);
    }
  };

  return (
    <BotSettingsSaveContext.Provider value={{ registerSave, unregisterSave }}>
      {children}

      {/* Unified sticky save bar */}
      <div className="sticky bottom-4 z-20 mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => void handleSaveAll()}
          disabled={saveState === "saving"}
          className={cn(
            "flex items-center gap-2.5 rounded-2xl px-6 py-3 text-sm font-semibold shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-all duration-200",
            saveState === "saved"
              ? "bg-emerald-500 text-white"
              : saveState === "error"
                ? "bg-red-500/90 text-white"
                : "bg-sky-500 text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          {saveState === "saving" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : saveState === "saved" ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </>
          ) : saveState === "error" ? (
            <>
              <XCircle className="h-4 w-4" />
              Retry save
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </BotSettingsSaveContext.Provider>
  );
}
