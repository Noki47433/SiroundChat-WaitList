"use client";

type SpacingEditorProps = {
  value: "compact" | "normal" | "airy";
  onChange: (value: "compact" | "normal" | "airy") => void;
};

export function SpacingEditor({ value, onChange }: SpacingEditorProps) {
  return (
    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
      Spacing
      <select
        className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
        value={value}
        onChange={(event) => onChange(event.target.value as "compact" | "normal" | "airy")}
      >
        <option value="compact">Compact</option>
        <option value="normal">Normal</option>
        <option value="airy">Airy</option>
      </select>
    </label>
  );
}
