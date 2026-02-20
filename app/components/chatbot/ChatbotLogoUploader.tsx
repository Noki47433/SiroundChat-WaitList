// Summary: Secondary control for uploading a logo and extracting colors for the chatbot theme.
'use client';

import { ChangeEvent } from "react";
import { motion } from "framer-motion";

import { ThemeConfig } from "./chatbotTypes";

type ChatbotLogoUploaderProps = {
  logoUrl?: string | null;
  onLogoChange: (logoUrl: string | null) => void;
  onColorExtract?: (theme: Partial<ThemeConfig>) => void;
  businessId?: string | null;
  siteId?: string | null;
};

function averageColorFromImage(img: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  const step = Math.max(4, Math.floor(data.length / 5000));
  for (let i = 0; i < data.length; i += 4 * step) {
    const alpha = data[i + 3];
    if (alpha < 80) continue;
    const vr = data[i];
    const vg = data[i + 1];
    const vb = data[i + 2];
    const brightness = (vr * 299 + vg * 587 + vb * 114) / 1000;
    if (brightness < 25 || brightness > 245) continue;
    r += vr;
    g += vg;
    b += vb;
    count += 1;
  }
  if (!count) return null;
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  const avgR = Math.round(r / count);
  const avgG = Math.round(g / count);
  const avgB = Math.round(b / count);
  return `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;
}

export function ChatbotLogoUploader({ logoUrl, onLogoChange, onColorExtract, businessId, siteId }: ChatbotLogoUploaderProps) {
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader(); // Read a data URL solely for color extraction.
    reader.onload = () => { // Run after the file is fully read
      const dataUrl = typeof reader.result === "string" ? reader.result : null; // Ensure we have a string data URL
      if (!dataUrl) return; // Bail out if reading failed
      if (onColorExtract) { // Extract theme colors when enabled
        const img = new Image(); // Create an image to sample colors from
        img.src = dataUrl; // Use the data URL as the image source
        img.onload = () => { // Wait for image load before sampling pixels
          const color = averageColorFromImage(img); // Compute a representative brand color
          if (color) { // Only update theme if a color was detected
            onColorExtract({
              primaryColor: color, // Set the primary color from the logo
              accentColor: color, // Match the accent to the primary for consistency
              backgroundColor: "#F8FAFC", // Keep a light neutral background
              textColor: "#0F172A" // Use dark text for legibility
            }); // Apply extracted colors to the theme
          }
        };
      }
    };
    reader.readAsDataURL(file); // Start reading the file as a base64 data URL

    const formData = new FormData();
    formData.append("file", file);
    if (businessId) {
      formData.append("businessId", businessId);
    }
    if (siteId) {
      formData.append("siteId", siteId);
    }

    try {
      const res = await fetch("/api/logos/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data as { error?: string } | null)?.error ?? "Failed to upload logo");
      }
      if (data && typeof (data as { logoUrl?: string }).logoUrl === "string") {
        // Use the hosted URL so embeds never depend on blob: previews.
        onLogoChange((data as { logoUrl: string }).logoUrl);
      }
    } catch (error) {
      console.error("Logo upload failed", error);
    } finally {
      input.value = "";
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-900/90 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-100">Logo upload</p>
        {logoUrl ? (
          <button
            type="button"
            onClick={() => onLogoChange(null)}
            className="rounded-md px-2 py-1 text-xs font-semibold text-slate-100 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            Remove
          </button>
        ) : null}
      </div>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-bg-slate-900/90 px-5 py-6 text-center text-sm text-slate-600 transition hover:border-sky-500 hover:bg-slate-800">
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} aria-label="Upload logo" />
        <span className="text-base font-semibold text-slate-100">Drag &amp; drop logo or click to upload</span>
        <span className="mt-1 text-xs text-slate-500">PNG, JPG, SVG up to 5MB</span>
        <span className="mt-1 text-xs text-red-400 ">Kindly include only the icon of your logo to enhance its visibility on the chatbot icon.</span>
        {logoUrl ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Uploaded logo preview" className="h-full w-full object-cover" />
          </motion.div>
        ) : null}
      </label>
    </div>
  );
}
