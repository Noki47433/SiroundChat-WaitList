"use client";

type TextEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function TextEditor({ label, value, onChange }: TextEditorProps) {
  return (
    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
      {label}
      <textarea
        className="mt-2 min-h-[90px] w-full rounded-xl border border-sc-border bg-sc-surface px-3 py-2 text-sm text-sc-text placeholder:text-sc-muted"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
