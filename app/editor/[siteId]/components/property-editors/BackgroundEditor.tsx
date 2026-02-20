"use client";

import type { SectionStyle, SiteImage } from "@/lib/website-builder/types";

type BackgroundEditorProps = {
  value: SectionStyle["background"];
  onChange: (value: SectionStyle["background"]) => void;
  mediaLibrary?: SiteImage[];
};

const defaultGradientStops = [
  { color: "#111827", position: 0 },
  { color: "#F3F4F6", position: 100 }
];

const buildGradientPreview = (angle: number, stops: { color: string; position: number }[]) =>
  `linear-gradient(${angle}deg, ${stops
    .map((stop) => `${stop.color} ${stop.position}%`)
    .join(", ")})`;

export function BackgroundEditor({ value, onChange, mediaLibrary = [] }: BackgroundEditorProps) {
  const gradientStops = value.type === "gradient" ? value.stops ?? defaultGradientStops : defaultGradientStops;
  const angle = value.type === "gradient" ? value.angle ?? 135 : 135;

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        Background
        <select
          className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
          value={value.type}
          onChange={(event) => {
            const nextType = event.target.value as SectionStyle["background"]["type"];
            if (nextType === "plain") {
              onChange({ type: "plain" });
              return;
            }
            if (nextType === "gradient") {
              onChange({ type: "gradient", angle, stops: gradientStops });
              return;
            }
            if (nextType === "image") {
              onChange({ type: "image", overlay: 0.45, size: "cover", position: "center", repeat: "no-repeat" });
            }
          }}
        >
          <option value="plain">Plain</option>
          <option value="gradient">Gradient</option>
          <option value="image">Image</option>
        </select>
      </label>
      {value.type === "gradient" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Gradient stops</span>
            <button
              type="button"
              onClick={() =>
                onChange({
                  type: "gradient",
                  angle,
                  stops: [...gradientStops, { color: "#FFFFFF", position: 100 }]
                })
              }
              className="text-xs font-semibold text-sc-muted"
            >
              Add stop
            </button>
          </div>
          {gradientStops.map((stop, index) => (
            <div key={`${stop.color}-${index}`} className="flex items-center gap-2">
              <input
                type="color"
                className="h-9 w-11 rounded-lg border border-sc-border bg-sc-surface"
                value={stop.color}
                onChange={(event) => {
                  const next = gradientStops.map((item, idx) =>
                    idx === index ? { ...item, color: event.target.value } : item
                  );
                  onChange({ type: "gradient", angle, stops: next });
                }}
              />
              <input
                type="number"
                min={0}
                max={100}
                className="h-9 w-20 rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
                value={stop.position}
                onChange={(event) => {
                  const next = gradientStops.map((item, idx) =>
                    idx === index ? { ...item, position: Number(event.target.value) } : item
                  );
                  onChange({ type: "gradient", angle, stops: next });
                }}
              />
              <span className="text-xs text-sc-muted">%</span>
            </div>
          ))}
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
            Angle
            <input
              type="range"
              min={0}
              max={360}
              className="mt-2 w-full"
              value={angle}
              onChange={(event) => onChange({ type: "gradient", angle: Number(event.target.value), stops: gradientStops })}
            />
          </label>
          <div
            className="h-12 rounded-xl border border-sc-border"
            style={{ backgroundImage: buildGradientPreview(angle, gradientStops) }}
          />
        </div>
      ) : null}

      {value.type === "image" ? (
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
            Overlay
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              className="mt-2 w-full"
              value={value.overlay ?? 0.45}
              onChange={(event) => onChange({ ...value, overlay: Number(event.target.value) })}
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
            Size
            <select
              className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
              value={value.size ?? "cover"}
              onChange={(event) => onChange({ ...value, size: event.target.value as "cover" | "contain" })}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
            Position
            <select
              className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
              value={value.position ?? "center"}
              onChange={(event) => onChange({ ...value, position: event.target.value })}
            >
              <option value="center">Center</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
            Image
            <input
              className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-2 text-sm text-sc-text"
              value={value.value ?? ""}
              onChange={(event) => onChange({ ...value, value: event.target.value })}
              placeholder="Paste image URL or pick from library"
            />
          </label>
          {mediaLibrary.length ? (
            <div className="grid grid-cols-3 gap-2">
              {mediaLibrary.slice(0, 9).map((asset) => (
                <button
                  key={asset.src}
                  type="button"
                  onClick={() => onChange({ ...value, value: asset.src })}
                  className="overflow-hidden rounded-lg border border-sc-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.src} alt={asset.alt ?? "Media"} className="h-16 w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
