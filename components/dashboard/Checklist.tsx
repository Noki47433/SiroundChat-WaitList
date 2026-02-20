interface ChecklistItem {
  label: string;
  description: string;
  completed: boolean;
}

export function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <div className="rounded-3xl border border-white/5 bg-white/5 p-5">
      <p className="text-sm font-semibold text-white">Get ready in 5 minutes</p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.label} className="flex items-start gap-3">
            <span
              className={`mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                item.completed ? "border-emerald-400 bg-emerald-400/30 text-white" : "border-white/20 text-white/50"
              }`}
            >
              {item.completed ? "✓" : ""}
            </span>
            <div>
              <p className="text-sm text-white">{item.label}</p>
              <p className="text-xs text-white/60">{item.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
