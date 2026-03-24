"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type { DocumentItem } from "@/lib/types";
import { deleteDocument, getDocuments, retrainDocument, updateDocumentStatus, uploadDocuments } from "@/lib/api";
import { markChecklistTaskComplete } from "@/app/(dashboard)/dashboard/_components/onboarding/state";

const formatBytes = (bytes: number) => {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const formatDocType = (file: File) => {
  const mimeType = file.type?.toLowerCase() ?? "";
  const name = file.name?.toLowerCase() ?? "";
  if (mimeType.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (mimeType.includes("word") || mimeType.includes("doc") || name.endsWith(".docx")) return "DOCX";
  if (mimeType.includes("text") || name.endsWith(".txt")) return "TXT";
  if (name.includes(".")) {
    const ext = name.split(".").pop();
    if (ext) return ext.toUpperCase();
  }
  return "FILE";
};

const formatDate = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function DocumentsPanel({ initialDocuments }: { initialDocuments: DocumentItem[] }) {
  const { push } = useToast();
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    getDocuments().then((stored) => {
      if (active) setDocuments(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleFiles = async (files: FileList | File[]) => {
    setUploading(true);
    const list = Array.from(files);
    const optimistic = list.map((file, index) => ({
      id: `temp-${Date.now()}-${index}`,
      filename: file.name,
      type: formatDocType(file),
      size: formatBytes(file.size),
      uploadedAt: formatDate(new Date()),
      status: "processing" as const
    }));
    setDocuments((prev) => [...optimistic, ...prev]);
    const newDocs = await uploadDocuments(list);
    setDocuments((prev) => {
      const withoutTemp = prev.filter((doc) => !doc.id.startsWith("temp-"));
      return newDocs.length ? [...newDocs, ...withoutTemp] : withoutTemp;
    });
    if (newDocs.length) {
      const refreshed = await getDocuments();
      if (refreshed.length) setDocuments(refreshed);
    }
    setUploading(false);
    if (newDocs.length) {
      push({ title: "Files queued", message: "Your files are now processing.", variant: "info" });
    } else {
      push({ title: "Upload failed", message: "We could not upload the files. Please try again.", variant: "error" });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteDocument(id);
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    push({ title: "Document deleted", message: "The file was removed from your knowledge base.", variant: "success" });
  };

  const handleRetrain = async (id: string) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, status: "processing" } : doc))
    );
    push({ title: "Retraining started", message: "We are rebuilding embeddings now.", variant: "info" });
    const update = await retrainDocument(id);
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, status: update.status } : doc))
    );
    updateDocumentStatus(id, update.status);
    if (update.status === "ready") {
      markChecklistTaskComplete("train_documents", true);
      push({ title: "Retraining complete", message: "Document is ready.", variant: "success" });
    }
  };

  return (
    <div className="space-y-6">
      <div
        className="rounded-3xl border border-dashed border-white/20 bg-white/5 p-6 text-center"
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (event.dataTransfer.files.length) {
            handleFiles(event.dataTransfer.files);
          }
        }}
      >
        <p className="text-sm font-semibold">Drag & drop documents here</p>
        <p className="mt-2 text-xs text-white/60">PDF, DOCX, or TXT up to 25MB</p>
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            data-tutorial-target="documents-select-files"
          >
            {uploading ? "Uploading..." : "Select files"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) {
                handleFiles(event.target.files);
              }
            }}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Uploaded files</p>
            <p className="text-xs text-white/60">{documents.length} total</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-950/50 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-sm font-semibold">{doc.filename}</p>
                <p className="text-xs text-white/50">
                  {doc.type} / {doc.size} / {doc.uploadedAt}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={doc.status === "ready" ? "success" : "warning"}>{doc.status}</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRetrain(doc.id)}
                  data-tutorial-target="documents-retrain"
                >
                  Re-train
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(doc.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {documents.length === 0 ? (
            <p className="text-sm text-white/60">No documents yet. Upload your first file above.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
        Files are private and used only for your bot. We never share documents outside your workspace.
      </div>
    </div>
  );
}
