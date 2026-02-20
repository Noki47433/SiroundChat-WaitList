"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Trash2, Upload } from "lucide-react";
import type { NormalizedImage } from "@/lib/website-builder/images/pexels";
import type { SiteImage } from "@/lib/website-builder/types";
import { useEditorActions, useEditorState } from "@/lib/website-builder/editor/EditorProvider";
import { selectSelectedElement, selectSelectedSection } from "@/lib/website-builder/editor/selectors";

const supportsImages = (type: string) => ["hero", "about", "gallery", "cta"].includes(type);

const getSlotForType = (type: string, index: number) => {
  if (type === "gallery") return `gallery-${index + 1}`;
  return type;
};

export function MediaPanel() {
  const state = useEditorState();
  const { updateDocument } = useEditorActions();
  const selectedSection = selectSelectedSection(state);
  const selectedElement = selectSelectedElement(state);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<NormalizedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [replaceSlot, setReplaceSlot] = useState<string | null>(null);

  const mediaLibrary = state.document?.mediaLibrary ?? [];

  const storeMediaAsset = (image: SiteImage) => {
    updateDocument((doc) => {
      const library = doc.mediaLibrary ?? [];
      if (library.some((item) => item.src === image.src)) {
        return doc;
      }
      return { ...doc, mediaLibrary: [...library, image] };
    });
  };

  const applyImageToSelection = (image: SiteImage) => {
    if (selectedElement?.type === "image" && selectedSection) {
      updateDocument((doc) => ({
        ...doc,
        pages: doc.pages.map((page) => ({
          ...page,
          sections: page.sections.map((section) => {
            if (section.id !== selectedSection.id) return section;
            return {
              ...section,
              elements: (section.elements ?? []).map((element) =>
                element.id === selectedElement.id && element.type === "image"
                  ? { ...element, src: image.src, alt: image.alt ?? element.alt }
                  : element
              )
            };
          })
        }))
      }));
      setReplaceSlot(null);
      return;
    }

    if (selectedSection && supportsImages(selectedSection.type)) {
      updateDocument((doc) => ({
        ...doc,
        pages: doc.pages.map((page) => ({
          ...page,
          sections: page.sections.map((section) => {
            if (section.id !== selectedSection.id) return section;
            const nextImages = section.images ? [...section.images] : [];
            const targetSlot =
              replaceSlot ?? (section.type === "gallery" ? null : section.type);
            if (targetSlot) {
              const index = nextImages.findIndex((item) => item.slot === targetSlot);
              const payload = { ...image, slot: targetSlot };
              if (index === -1) {
                nextImages.push(payload);
              } else {
                nextImages[index] = payload;
              }
              return { ...section, images: nextImages };
            }
            const slot = getSlotForType(section.type, nextImages.length);
            nextImages.push({ ...image, slot });
            return { ...section, images: nextImages };
          })
        }))
      }));
      setReplaceSlot(null);
    }
  };

  useEffect(() => {
    setReplaceSlot(null);
  }, [selectedSection?.id]);

  const galleryImages =
    selectedSection?.type === "gallery" ? selectedSection.images ?? [] : [];

  const normalizeGallerySlots = (images: SiteImage[]) =>
    images.map((asset, index) => ({ ...asset, slot: `gallery-${index + 1}` }));

  const moveGalleryImage = (fromIndex: number, toIndex: number) => {
    if (!selectedSection || selectedSection.type !== "gallery") return;
    if (toIndex < 0 || toIndex >= galleryImages.length) return;
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => ({
        ...page,
        sections: page.sections.map((section) => {
          if (section.id !== selectedSection.id) return section;
          const images = [...(section.images ?? [])];
          const [moved] = images.splice(fromIndex, 1);
          images.splice(toIndex, 0, moved);
          return { ...section, images: normalizeGallerySlots(images) };
        })
      }))
    }));
  };

  const removeGalleryImage = (slot: string) => {
    if (!selectedSection || selectedSection.type !== "gallery") return;
    updateDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => ({
        ...page,
        sections: page.sections.map((section) => {
          if (section.id !== selectedSection.id) return section;
          const filtered = (section.images ?? []).filter((image) => image.slot !== slot);
          return { ...section, images: normalizeGallerySlots(filtered) };
        })
      }))
    }));
    if (replaceSlot === slot) {
      setReplaceSlot(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/images/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (!response.ok) throw new Error("Search failed");
      const data = (await response.json()) as NormalizedImage[];
      setResults(data);
    } catch (error) {
      console.error("[EDITOR_IMAGE_SEARCH]", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!state.document) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("siteId", state.siteId);
    formData.append(
      "kind",
      selectedSection?.type === "hero"
        ? "hero"
        : selectedSection?.type === "gallery"
          ? "gallery"
          : "other"
    );
    try {
      const response = await fetch("/api/builder/upload-image", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      if (!data?.url) return;
      const asset: SiteImage = { slot: "library", src: data.url, alt: "Uploaded image" };
      storeMediaAsset(asset);
      applyImageToSelection(asset);
    } catch (error) {
      console.error("[EDITOR_MEDIA_UPLOAD]", error);
    }
  };

  return (
    <div className="space-y-4">
      {replaceSlot ? (
        <div className="rounded-xl border border-sc-border bg-sc-surface-2 px-3 py-2 text-xs text-sc-muted">
          Replacing image slot <span className="font-semibold text-sc-text">{replaceSlot}</span>. Select an image below.
        </div>
      ) : null}
      <div>
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Search</label>
        <div className="mt-2 flex gap-2">
          <input
            className="h-9 flex-1 rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text placeholder:text-sc-muted"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search stock photos"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="rounded-xl border border-sc-border px-3 text-xs font-semibold text-sc-text"
          >
            Search
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-sc-border bg-sc-surface p-3">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Upload</label>
        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-sc-border bg-sc-surface-2 px-3 py-4 text-xs font-semibold text-sc-text">
          <Upload className="h-4 w-4" />
          Upload image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </label>
      </div>

      {selectedSection?.type === "gallery" ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Gallery images</p>
          {galleryImages.length ? (
            <div className="space-y-2">
              {galleryImages.map((asset, index) => (
                <div
                  key={`${asset.src}-${asset.slot}`}
                  className="flex items-center gap-2 rounded-xl border border-sc-border bg-sc-surface px-2 py-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.src} alt={asset.alt ?? "Gallery image"} className="h-12 w-12 rounded-lg object-cover" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-sc-text">{asset.slot}</p>
                    <p className="text-[11px] text-sc-muted">Click replace to swap this image.</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setReplaceSlot(asset.slot)}
                      className="rounded-lg border border-sc-border px-2 py-1 text-[11px] font-semibold text-sc-text"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => moveGalleryImage(index, index - 1)}
                      disabled={index === 0}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-sc-border text-sc-text disabled:opacity-40"
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveGalleryImage(index, index + 1)}
                      disabled={index === galleryImages.length - 1}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-sc-border text-sc-text disabled:opacity-40"
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(asset.slot)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-sc-border text-sc-danger"
                      aria-label="Remove image"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-sc-muted">No gallery images yet.</p>
          )}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Media library</p>
        {mediaLibrary.length ? (
          <div className="grid grid-cols-3 gap-2">
            {mediaLibrary.map((asset) => (
              <button
                key={`${asset.src}-${asset.slot}`}
                type="button"
                onClick={() => applyImageToSelection(asset)}
                className="overflow-hidden rounded-lg border border-sc-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.src} alt={asset.alt ?? "Media"} className="h-20 w-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-sc-muted">Upload images to build your library.</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Search results</p>
        {loading ? <p className="text-xs text-sc-muted">Searching...</p> : null}
        {!loading && results.length ? (
          <div className="grid grid-cols-3 gap-2">
            {results.map((image) => (
              <button
                key={image.url}
                type="button"
                onClick={() => {
                  const asset: SiteImage = {
                    slot: "library",
                    src: image.url,
                    alt: image.alt,
                    credit: {
                      provider: "pexels",
                      photographer: image.photographer,
                      sourceUrl: image.sourceUrl
                    },
                    query: searchQuery.trim()
                  };
                  applyImageToSelection(asset);
                  storeMediaAsset(asset);
                }}
                className="overflow-hidden rounded-lg border border-sc-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.alt} className="h-20 w-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-sc-muted">Search for media to add to your site.</p>
        )}
      </div>
    </div>
  );
}
