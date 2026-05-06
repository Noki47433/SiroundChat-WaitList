import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Data Deletion Instructions",
  description: "How users and businesses can request deletion of data processed by SiroundChat.",
  alternates: {
    canonical: "/data-deletion"
  }
};

export default function DataDeletionPage() {
  return (
    <LegalPageLayout
      title="Data Deletion Instructions"
      subtitle="SiroundChat accepts deletion requests by email and reviews them based on the information provided and what is legally and technically possible."
    >
      <>
        <h2>How to request deletion</h2>
        <p>
          Users and businesses can request deletion of their data by emailing{" "}
          <a href="mailto:noarsiround@gmail.com">noarsiround@gmail.com</a>.
        </p>

        <h2>What to include</h2>
        <p>Please include the following details in your request so the correct records can be located:</p>
        <ul>
          <li>Your name</li>
          <li>Business name, if applicable</li>
          <li>Email address and phone number connected to the request</li>
          <li>A clear description of what data you want deleted</li>
        </ul>

        <h2>WhatsApp and Meta conversations</h2>
        <p>
          If the data came from WhatsApp or Meta messaging, include the phone number used in the conversation so the
          relevant message history can be located.
        </p>

        <h2>Review and processing</h2>
        <p>
          SiroundChat will review and process deletion requests where legally and technically possible, taking into
          account security, fraud prevention, and any obligations that require limited retention.
        </p>
      </>
    </LegalPageLayout>
  );
}
