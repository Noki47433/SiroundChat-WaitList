"use client";

/**
 * The enquiry form on a rendered site.
 *
 * It posts to the existing `/api/site/forms/submit` endpoint rather than
 * introducing a second submissions path — which is also why the Site Spec
 * restricts enquiry fields to the four that endpoint accepts. A form that
 * renders but reaches nobody is worse than no form.
 */
import { useState } from "react";

import type { ENQUIRY_FIELD_NAMES } from "@/lib/site-spec/schema";

type FieldName = (typeof ENQUIRY_FIELD_NAMES)[number];

export type EnquiryField = {
  name: FieldName;
  label: string;
  placeholder?: string;
  required: boolean;
};

export type SiteSpecEnquiryFormProps = {
  /** Published slug the submissions endpoint resolves the business from. */
  slug: string | null;
  fields: EnquiryField[];
  submitLabel: string;
  classNames: { fields: string; field: string; button: string; note: string };
};

const INPUT_TYPE: Record<FieldName, string> = {
  name: "text",
  email: "email",
  phone: "tel",
  message: "textarea"
};

type Status = "idle" | "sending" | "sent" | "error";

export function SiteSpecEnquiryForm({
  slug,
  fields,
  submitLabel,
  classNames
}: SiteSpecEnquiryFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [values, setValues] = useState<Record<string, string>>({});

  const update = (name: string, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending" || !slug) return;
    setStatus("sending");
    try {
      const response = await fetch("/api/site/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          form_type: "contact",
          payload: {
            name: values.name ?? "",
            message: values.message ?? "",
            email: values.email || null,
            phone: values.phone || null
          }
        })
      });
      setStatus(response.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div>
        <p className={classNames.note}>Thanks — your message is on its way.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate={false}>
      <div className={classNames.fields}>
        {fields.map((field) =>
          INPUT_TYPE[field.name] === "textarea" ? (
            <textarea
              key={field.name}
              className={classNames.field}
              name={field.name}
              aria-label={field.label}
              placeholder={field.placeholder ?? field.label}
              required={field.required}
              rows={3}
              value={values[field.name] ?? ""}
              onChange={(event) => update(field.name, event.target.value)}
            />
          ) : (
            <input
              key={field.name}
              className={classNames.field}
              type={INPUT_TYPE[field.name]}
              name={field.name}
              aria-label={field.label}
              placeholder={field.placeholder ?? field.label}
              required={field.required}
              value={values[field.name] ?? ""}
              onChange={(event) => update(field.name, event.target.value)}
            />
          )
        )}
        <div style={{ marginTop: 6 }}>
          <button className={classNames.button} type="submit" disabled={status === "sending" || !slug}>
            {status === "sending" ? "Sending…" : submitLabel}
          </button>
        </div>
        {status === "error" ? (
          <p className={classNames.note} role="alert">
            That did not send. Please try again, or call us instead.
          </p>
        ) : null}
      </div>
    </form>
  );
}

export default SiteSpecEnquiryForm;
