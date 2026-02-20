"use client";

import { useCallback, useState } from "react";

const inlineStyles = (source: Element, target: HTMLElement) => {
  const computed = window.getComputedStyle(source);
  for (const property of computed) {
    target.style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
  }
};

const cloneWithInlineStyles = (node: HTMLElement) => {
  const clone = node.cloneNode(true) as HTMLElement;

  const walk = (source: Element, target: HTMLElement) => {
    inlineStyles(source, target);
    const sourceChildren = Array.from(source.children);
    const targetChildren = Array.from(target.children) as HTMLElement[];
    sourceChildren.forEach((child, index) => {
      const targetChild = targetChildren[index];
      if (targetChild) {
        walk(child, targetChild);
      }
    });
  };

  walk(node, clone);
  return clone;
};

const createSvgDataUrl = (node: HTMLElement, width: number, height: number, scale: number) => {
  const cloned = cloneWithInlineStyles(node);
  cloned.style.width = `${width}px`;
  cloned.style.height = `${height}px`;
  const serialized = new XMLSerializer().serializeToString(cloned);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}">
      <foreignObject x="0" y="0" width="100%" height="100%" transform="scale(${scale})">
        <div xmlns="http://www.w3.org/1999/xhtml">${serialized}</div>
      </foreignObject>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const renderNodeToBlob = async (node: HTMLElement, scale: number) => {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const rect = node.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  const svgUrl = createSvgDataUrl(node, width, height, scale);
  const image = new Image();
  image.crossOrigin = "anonymous";

  const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load export image"));
    image.src = svgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(loaded, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to export image"));
      } else {
        resolve(blob);
      }
    }, "image/png");
  });
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const useShareExport = ({ scale = 2 }: { scale?: number } = {}) => {
  const [exporting, setExporting] = useState(false);

  const exportToPng = useCallback(
    async (node: HTMLElement | null, filename = "siroundchat-wrapped.png") => {
      if (!node) return false;
      setExporting(true);
      try {
        const blob = await renderNodeToBlob(node, scale);
        downloadBlob(blob, filename);
        return true;
      } catch {
        return false;
      } finally {
        setExporting(false);
      }
    },
    [scale]
  );

  const copyToClipboard = useCallback(
    async (node: HTMLElement | null) => {
      if (!node || !navigator.clipboard || typeof ClipboardItem === "undefined") return false;
      setExporting(true);
      try {
        const blob = await renderNodeToBlob(node, scale);
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        return true;
      } catch {
        return false;
      } finally {
        setExporting(false);
      }
    },
    [scale]
  );

  return { exporting, exportToPng, copyToClipboard };
};
