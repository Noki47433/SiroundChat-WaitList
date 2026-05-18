import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "SiroundChat terms for businesses using AI chatbot, WhatsApp messaging, and reservation tools.",
  alternates: {
    canonical: "/terms"
  }
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle="These terms describe the basic responsibilities and expectations for businesses using SiroundChat."
    >
      <>
        <h2>Service scope</h2>
        <p>
          SiroundChat provides AI chatbot, website, WhatsApp messaging, and reservation management tools for
          businesses.
        </p>

        <h2>Business responsibilities</h2>
        <p>
          Businesses are responsible for the accuracy of their business information, menus, opening hours, reservation
          settings, and any other content or rules they provide to the platform.
        </p>

        <h2>AI assistance and reservations</h2>
        <p>AI replies and reservation requests are assistance tools intended to help businesses manage communication.</p>
        <p>
          Reservations created by SiroundChat should be treated as pending unless they are confirmed by the business.
        </p>

        <h2>No guarantees</h2>
        <p>
          SiroundChat does not guarantee table availability, customer attendance, or business results. Final business
          decisions, confirmations, and operational follow-through remain the responsibility of the business.
        </p>

        <h2>Acceptable use</h2>
        <p>Users must not abuse the service or use it for illegal, fraudulent, or harmful activity.</p>

        <h2>Contact</h2>
        <p>
          For service questions related to these terms, contact{" "}
          <a href="mailto:noarsiround@gmail.com">noarsiround@gmail.com</a>.
        </p>
      </>
    </LegalPageLayout>
  );
}
