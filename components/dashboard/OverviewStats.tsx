interface StatCardProps {
  label: string;
  value: string;
  trend?: string;
}

export function OverviewStats({ stats }: { stats: StatCardProps[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-3xl border border-white/5 bg-white/5 p-5">
          <p className="text-xs uppercase text-white/50">{stat.label}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
          {stat.trend ? <p className="text-xs text-emerald-300">{stat.trend}</p> : null}
        </div>
      ))}
    </div>
  );
}
