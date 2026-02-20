"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export type FeedbackReportView = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  category: string;
  importance: string;
  title: string;
  description: string;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  url: string | null;
  browser_info: string | null;
  contact_email: string | null;
  admin_notes: string | null;
  resolved_at: string | null;
  resolution_summary: string | null;
  triage_status: string;
  priority: string;
  tags: string[];
};

type FormState = {
  category: string;
  importance: string;
  title: string;
  description: string;
  steps_to_reproduce: string;
  expected_behavior: string;
  actual_behavior: string;
  url: string;
  contact_email: string;
  browser_info: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const initialForm = (contactEmail?: string | null): FormState => ({
  category: "",
  importance: "",
  title: "",
  description: "",
  steps_to_reproduce: "",
  expected_behavior: "",
  actual_behavior: "",
  url: "",
  contact_email: contactEmail ?? "",
  browser_info: ""
});

const validateForm = (form: FormState): FormErrors => {
  const errors: FormErrors = {};

  if (!form.category) errors.category = "Category is required.";
  if (!form.importance) errors.importance = "Importance is required.";

  const title = form.title.trim();
  if (!title) errors.title = "Title is required.";
  if (title && title.length < 5) errors.title = "Title must be at least 5 characters.";
  if (title.length > 80) errors.title = "Title must be 80 characters or less.";

  const description = form.description.trim();
  if (!description) errors.description = "Description is required.";
  if (description && description.length < 20) errors.description = "Description must be at least 20 characters.";
  if (description.length > 2000) errors.description = "Description must be 2000 characters or less.";

  if (form.steps_to_reproduce.length > 2000) errors.steps_to_reproduce = "Steps must be 2000 characters or less.";
  if (form.expected_behavior.length > 2000) errors.expected_behavior = "Expected behavior must be 2000 characters or less.";
  if (form.actual_behavior.length > 2000) errors.actual_behavior = "Actual behavior must be 2000 characters or less.";
  if (form.url.length > 1200) errors.url = "URL must be 1200 characters or less.";

  if (form.contact_email.trim()) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(form.contact_email.trim())) {
      errors.contact_email = "Contact email must be valid.";
    }
  }

  return errors;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

export function NewFeedbackReportModal({
  open,
  onClose,
  initialContactEmail,
  onCreated
}: {
  open: boolean;
  onClose: () => void;
  initialContactEmail?: string | null;
  onCreated: (reportId: string) => void;
}) {
  const { push } = useToast();
  const [form, setForm] = useState<FormState>(() => initialForm(initialContactEmail));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({
      ...prev,
      url: window.location.href,
      browser_info: navigator.userAgent,
      contact_email: prev.contact_email || initialContactEmail || ""
    }));
  }, [initialContactEmail, open]);

  const errors = useMemo(() => validateForm(form), [form]);
  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  const setValue = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetAndClose = () => {
    setForm(initialForm(initialContactEmail));
    onClose();
  };

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          importance: form.importance,
          title: form.title,
          description: form.description,
          steps_to_reproduce: form.steps_to_reproduce || null,
          expected_behavior: form.expected_behavior || null,
          actual_behavior: form.actual_behavior || null,
          url: form.url || null,
          contact_email: form.contact_email || null,
          browser_info: form.browser_info || null
        })
      });

      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error ?? "Failed to submit report");
      }

      push({
        title: "Report submitted. We'll look at it.",
        variant: "success"
      });
      onCreated(payload.id);
      resetAndClose();
    } catch (error) {
      push({
        title: "Failed to submit report",
        message: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="New Feedback Report"
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={resetAndClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? "Submitting..." : "Submit report"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-xs text-white/70">
          Category
          <Select value={form.category} onChange={(event) => setValue("category", event.target.value)}>
            <option value="">Select category</option>
            <option value="bug">Bug</option>
            <option value="feature_request">Feature request</option>
            <option value="ux_issue">UX issue</option>
            <option value="billing_issue">Billing issue</option>
            <option value="other">Other</option>
          </Select>
          {errors.category ? <p className="text-xs text-red-300">{errors.category}</p> : null}
        </label>

        <label className="space-y-2 text-xs text-white/70">
          Importance
          <Select value={form.importance} onChange={(event) => setValue("importance", event.target.value)}>
            <option value="">Select importance</option>
            <option value="low">Low (minor annoyance)</option>
            <option value="medium">Medium (blocks some tasks)</option>
            <option value="high">High (blocks core workflow)</option>
            <option value="critical">Critical (system unusable / payment broken)</option>
          </Select>
          {errors.importance ? <p className="text-xs text-red-300">{errors.importance}</p> : null}
        </label>
      </div>

      <label className="space-y-2 text-xs text-white/70">
        Title
        <Input value={form.title} onChange={(event) => setValue("title", event.target.value)} maxLength={80} />
        <div className="flex items-center justify-between">
          {errors.title ? <p className="text-xs text-red-300">{errors.title}</p> : <span />}
          <p className="text-[11px] text-white/45">{form.title.length}/80</p>
        </div>
      </label>

      <label className="space-y-2 text-xs text-white/70">
        Description
        <Textarea
          value={form.description}
          onChange={(event) => setValue("description", event.target.value)}
          rows={5}
          maxLength={2000}
        />
        <div className="flex items-center justify-between">
          {errors.description ? <p className="text-xs text-red-300">{errors.description}</p> : <span />}
          <p className="text-[11px] text-white/45">{form.description.length}/2000</p>
        </div>
      </label>

      <label className="space-y-2 text-xs text-white/70">
        Steps to reproduce (optional)
        <Textarea
          value={form.steps_to_reproduce}
          onChange={(event) => setValue("steps_to_reproduce", event.target.value)}
          rows={4}
          maxLength={2000}
        />
        {errors.steps_to_reproduce ? <p className="text-xs text-red-300">{errors.steps_to_reproduce}</p> : null}
      </label>

      <label className="space-y-2 text-xs text-white/70">
        Expected behavior (optional)
        <Textarea
          value={form.expected_behavior}
          onChange={(event) => setValue("expected_behavior", event.target.value)}
          rows={3}
          maxLength={2000}
        />
        {errors.expected_behavior ? <p className="text-xs text-red-300">{errors.expected_behavior}</p> : null}
      </label>

      <label className="space-y-2 text-xs text-white/70">
        Actual behavior (optional)
        <Textarea
          value={form.actual_behavior}
          onChange={(event) => setValue("actual_behavior", event.target.value)}
          rows={3}
          maxLength={2000}
        />
        {errors.actual_behavior ? <p className="text-xs text-red-300">{errors.actual_behavior}</p> : null}
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-xs text-white/70">
          Page URL
          <Input value={form.url} onChange={(event) => setValue("url", event.target.value)} maxLength={1200} />
          {errors.url ? <p className="text-xs text-red-300">{errors.url}</p> : null}
        </label>

        <label className="space-y-2 text-xs text-white/70">
          Contact email (optional)
          <Input
            type="email"
            value={form.contact_email}
            onChange={(event) => setValue("contact_email", event.target.value)}
            maxLength={320}
          />
          {errors.contact_email ? <p className="text-xs text-red-300">{errors.contact_email}</p> : null}
        </label>
      </div>

      <input type="hidden" value={form.browser_info} readOnly />
    </Modal>
  );
}

export function FeedbackReportDetailModal({
  open,
  onClose,
  report
}: {
  open: boolean;
  onClose: () => void;
  report: FeedbackReportView | null;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={report ? report.title : "Feedback report"}
      size="lg"
      footer={
        <Button type="button" size="sm" variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {!report ? (
        <p className="text-sm text-white/60">Loading...</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{report.category}</Badge>
            <Badge variant="warning">{report.importance}</Badge>
            <Badge variant="default">{report.status}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <p className="text-xs text-white/60">Created: {formatDateTime(report.created_at)}</p>
            <p className="text-xs text-white/60">Updated: {formatDateTime(report.updated_at)}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-white/45">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-white/85">{report.description}</p>
          </div>

          {report.steps_to_reproduce ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-white/45">Steps to reproduce</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{report.steps_to_reproduce}</p>
            </div>
          ) : null}

          {report.expected_behavior ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-white/45">Expected behavior</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{report.expected_behavior}</p>
            </div>
          ) : null}

          {report.actual_behavior ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-white/45">Actual behavior</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{report.actual_behavior}</p>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <p className="text-xs text-white/60">Page URL: {report.url || "-"}</p>
            <p className="text-xs text-white/60">Contact email: {report.contact_email || "-"}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
