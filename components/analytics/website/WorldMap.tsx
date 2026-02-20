"use client";

import { useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import world from "world-atlas/countries-110m.json";
import { Badge } from "@/components/ui/badge";

type CountryDatum = { countryCode: string | null; value: number };

type WorldMapProps = {
  data: CountryDatum[];
  mode: "visitors" | "leads";
};

type CountryInfo = { code: string; name: string; value: number };
type RsmGeo = {
  rsmKey: string;
  id?: string | number;
  properties?: Record<string, unknown>;
};

const baseColor = "#1f2937";
const colorScale = ["#334155", "#1e3a8a", "#1d4ed8", "#2563eb", "#60a5fa"];

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

const normalizeName = (value: string) => {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const aliases: Record<string, string> = {
    "united states of america": "united states",
    "russian federation": "russia",
    "viet nam": "vietnam",
    "czechia": "czech republic"
  };
  return aliases[cleaned] ?? cleaned;
};

const brighten = (hex: string, amount: number) => {
  const normalized = hex.replace("#", "");
  const num = Number.parseInt(normalized, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
};

const getStepIndex = (value: number, max: number) => {
  if (!value || max <= 0) return -1;
  const ratio = value / max;
  if (ratio <= 0.2) return 0;
  if (ratio <= 0.4) return 1;
  if (ratio <= 0.6) return 2;
  if (ratio <= 0.8) return 3;
  return 4;
};

const getFill = (value: number, max: number) => {
  const step = getStepIndex(value, max);
  if (step < 0) return baseColor;
  return colorScale[step] ?? colorScale[colorScale.length - 1];
};

export function WorldMap({ data, mode }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<CountryInfo | null>(null);
  const [selected, setSelected] = useState<CountryInfo | null>(null);
  const [tooltip, setTooltip] = useState({ x: 0, y: 0, visible: false });
  const displayNames = useMemo(() => new Intl.DisplayNames(["en"], { type: "region" }), []);

  const { valueMap, valueMapByName, maxValue, unknownCount } = useMemo(() => {
    const map = new Map<string, number>();
    const mapByName = new Map<string, number>();
    let max = 0;
    let unknown = 0;
    data.forEach((entry) => {
      if (!entry.countryCode) {
        unknown += entry.value;
        return;
      }
      const code = entry.countryCode.toUpperCase();
      map.set(code, entry.value);
      const displayName = displayNames.of(code) ?? code;
      const normalized = normalizeName(displayName);
      if (normalized) mapByName.set(normalized, entry.value);
      max = Math.max(max, entry.value);
    });
    return { valueMap: map, valueMapByName: mapByName, maxValue: max, unknownCount: unknown };
  }, [data, displayNames]);

  const topCountries = useMemo(() => {
    return data
      .filter((entry) => entry.countryCode)
      .map((entry) => {
        const code = entry.countryCode!.toUpperCase();
        return {
          code,
          name: displayNames.of(code) ?? code,
          value: entry.value
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [data, displayNames]);

  const metricLabel = mode === "leads" ? "Leads" : "Visitors";

  const updateTooltip = (event: ReactMouseEvent<SVGPathElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      visible: true
    });
  };

  const clearTooltip = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative h-[280px] w-full overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] md:h-[440px]"
        onClick={() => {
          setSelected(null);
          setHovered(null);
          clearTooltip();
        }}
        onMouseLeave={() => {
          setHovered(null);
          clearTooltip();
        }}
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.18),transparent_65%)]" />

        <div className="absolute right-4 top-4 z-20 rounded-full border border-white/10 bg-black/70 px-3 py-2 text-xs text-white/80 shadow-lg">
          {selected ? (
            <span className="text-white">
              {selected.name} • {formatNumber(selected.value)} {metricLabel.toLowerCase()}
            </span>
          ) : (
            <span className="text-white/70">Hover or click a country</span>
          )}
        </div>

        {hovered && tooltip.visible ? (
          <div
            className="pointer-events-none absolute z-30 rounded-xl border border-white/10 bg-black/80 px-3 py-2 text-xs text-white/80 shadow-lg"
            style={{
              left: Math.min(
                Math.max(tooltip.x + 12, 12),
                Math.max((containerRef.current?.clientWidth ?? 600) - 180, 12)
              ),
              top: Math.min(
                Math.max(tooltip.y + 12, 12),
                Math.max((containerRef.current?.clientHeight ?? 360) - 80, 12)
              )
            }}
          >
            <p className="text-sm font-semibold text-white">{hovered.name}</p>
            <p>
              {metricLabel}: {formatNumber(hovered.value)}
            </p>
          </div>
        ) : null}

        <ComposableMap
          projectionConfig={{ scale: 190 }}
          className="h-full w-full"
          style={{ width: "100%", height: "100%" }}
        >
          <Geographies geography={world as unknown as Record<string, unknown>}>
            {({ geographies }: { geographies: RsmGeo[] }) => {
              if (!geographies.length) {
                return (
                  <g>
                    <rect x="0" y="0" width="100%" height="100%" fill="rgba(15,23,42,0.4)" />
                    <text x="50%" y="50%" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="12">
                      Loading map...
                    </text>
                  </g>
                );
              }

              const invalidGeoDataset =
                process.env.NODE_ENV !== "production" && geographies.length < 50;

              if (invalidGeoDataset) {
                console.error("Invalid geography dataset:", {
                  count: geographies.length,
                  keys: Object.keys(world as Record<string, unknown>)
                });
              }

              return (
                <>
                  {invalidGeoDataset ? (
                    <g>
                      <rect x="0" y="0" width="100%" height="100%" fill="rgba(15,23,42,0.6)" />
                      <text x="50%" y="50%" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="12">
                        {`Invalid geography dataset: expected countries but got ${geographies.length} geographies`}
                      </text>
                    </g>
                  ) : null}
                  {geographies.map((geo: RsmGeo) => {
                    const nameFromGeo =
                      (geo.properties?.name as string | undefined) ??
                      (geo.properties?.NAME as string | undefined) ??
                      (geo.properties?.NAME_LONG as string | undefined) ??
                      "";
                    const rawCode =
                      (geo.properties?.ISO_A2 as string | undefined) ??
                      (geo.properties?.iso_a2 as string | undefined) ??
                      (typeof geo.id === "string" ? geo.id : "");
                    const iso2 = rawCode && rawCode !== "-99" && rawCode.length === 2 ? rawCode.toUpperCase() : "";
                    const normalizedName = normalizeName(nameFromGeo);
                    const value = iso2
                      ? valueMap.get(iso2) ?? 0
                      : normalizedName
                        ? valueMapByName.get(normalizedName) ?? 0
                        : 0;
                    const resolvedName = nameFromGeo || (iso2 ? displayNames.of(iso2) ?? iso2 : "Unknown");
                    const keyCode = iso2 || normalizedName || resolvedName;

                    const isSelected = selected?.code === keyCode;
                    const isHovered = hovered?.code === keyCode;
                    const baseFill = getFill(value, maxValue);
                    const fill = isSelected
                      ? brighten(baseFill, 0.22)
                      : isHovered
                        ? brighten(baseFill, 0.12)
                        : baseFill;
                    const stroke = isSelected
                      ? "rgba(125,211,252,0.85)"
                      : isHovered
                        ? "rgba(248,250,252,0.6)"
                        : "rgba(148,163,184,0.25)";
                    const strokeWidth = isSelected ? 1.1 : isHovered ? 0.8 : 0.5;

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        className="cursor-pointer transition-colors duration-200"
                        style={{ outline: "none" }}
                        onMouseEnter={(event: ReactMouseEvent<SVGPathElement>) => {
                          setHovered({ name: resolvedName, code: keyCode, value });
                          updateTooltip(event);
                        }}
                        onMouseMove={(event: ReactMouseEvent<SVGPathElement>) => {
                          if (!hovered || hovered.code !== keyCode) {
                            setHovered({ name: resolvedName, code: keyCode, value });
                          }
                          updateTooltip(event);
                        }}
                        onMouseLeave={() => {
                          setHovered(null);
                          clearTooltip();
                        }}
                        onClick={(event: ReactMouseEvent<SVGPathElement>) => {
                          event.stopPropagation();
                          setSelected((current) =>
                            current?.code === keyCode ? null : { name: resolvedName, code: keyCode, value }
                          );
                        }}
                      />
                    );
                  })}
                </>
              );
            }}
          </Geographies>
        </ComposableMap>

        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-2 text-xs text-white/60">
          <span>Low</span>
          <div className="flex h-2 w-24 overflow-hidden rounded-full bg-white/10">
            {colorScale.map((color) => (
              <span key={color} className="h-full flex-1" style={{ background: color }} />
            ))}
          </div>
          <span>High</span>
        </div>

        {unknownCount > 0 ? (
          <Badge className="absolute bottom-4 right-4 z-20 border-white/10 bg-white/10 text-white/70">
            Unknown: {formatNumber(unknownCount)}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
        <span className="uppercase tracking-[0.2em] text-white/40">Top countries</span>
        {topCountries.length ? (
          topCountries.map((country) => (
            <button
              key={country.code}
              type="button"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={() => setSelected({ name: country.name, code: country.code, value: country.value })}
            >
              {country.name} · {formatNumber(country.value)}
            </button>
          ))
        ) : (
          <span className="text-white/40">No country data yet</span>
        )}
      </div>
    </div>
  );
}
