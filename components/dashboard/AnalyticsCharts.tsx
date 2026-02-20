interface DataPoint {
  label: string;
  value: number;
}

interface AnalyticsChartsProps {
  visits: DataPoint[];
  chats: DataPoint[];
  leads: DataPoint[];
}

export function AnalyticsCharts({ visits, chats, leads }: AnalyticsChartsProps) {
  const barMax = Math.max(...visits.map((point) => point.value), 1);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {[{ title: "Visits", series: visits }, { title: "Chats", series: chats }, { title: "Leads", series: leads }].map(
        (chart) => (
          <div key={chart.title} className="rounded-3xl border border-white/5 bg-white/5 p-4">
            <p className="text-sm text-white/60">{chart.title}</p>
            <div className="mt-4 flex items-end gap-2">
              {chart.series.map((point) => (
                <div key={point.label} className="flex flex-1 flex-col items-center gap-2 text-white/50">
                  <span className="text-xs">{point.value}</span>
                  <span className="w-full rounded-full bg-[#00A3FF]"
                    style={{ height: `${(point.value / barMax) * 100 || 0}%`, minHeight: "6px" }}
                  />
                  <span className="text-[10px] uppercase">{point.label}</span>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
