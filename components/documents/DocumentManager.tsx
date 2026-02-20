"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";

type DocumentItem = {
  id: string;
  file_name: string;
  size_bytes: number;
  status: "uploaded" | "processing" | "ready" | "error";
  error_message?: string | null;
  updated_at?: string;
};

type Props = {
  businessId: string;
  businessName: string;
};

export default function DocumentManager({ businessId, businessName }: Props) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    const res = await fetch(`/api/documents/list?businessId=${businessId}`);
    const data = await res.json();
    if (res.ok) {
      setDocuments(data.documents ?? []);
    } else {
      setError(data.error || "Failed to load documents");
    }
  }, [businessId]);

  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(() => fetchDocuments(), 5000);
    return () => clearInterval(interval);
  }, [fetchDocuments]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !files.length) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("businessId", businessId);
    Array.from(files).forEach((file) => formData.append("files", file));

    const res = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Upload failed");
    } else {
      await fetchDocuments();
    }
    setUploading(false);
    event.target.value = ""; // reset input
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "-";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const statusColor = (status: DocumentItem["status"]) => {
    switch (status) {
      case "ready":
        return "text-emerald-600 bg-emerald-50";
      case "processing":
      case "uploaded":
        return "text-amber-600 bg-amber-50";
      case "error":
        return "text-rose-600 bg-rose-50";
      default:
        return "text-slate-600 bg-slate-50";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-lg font-medium">Business: {businessName}</p>
          <p className="text-sm text-slate-500">Upload PDFs, DOCX, TXT, or MD. Private bucket; only your account can access.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
          {uploading ? "Uploading..." : "Upload"}
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md"
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Error</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No documents yet.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{doc.file_name}</td>
                  <td className="px-4 py-3 text-slate-600">{formatSize(doc.size_bytes)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColor(doc.status)}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{doc.updated_at ? new Date(doc.updated_at).toLocaleString() : "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{doc.error_message ?? ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
