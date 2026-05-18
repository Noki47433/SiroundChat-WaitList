import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "SiroundChat privacy policy for chatbot, WhatsApp, reservation, and dashboard services.",
  alternates: {
    canonical: "/privacy"
  }
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="This page explains the types of information SiroundChat processes to operate its AI chatbot, WhatsApp messaging, reservations, and dashboard services."
    >
      <>
        <h2>What SiroundChat processes</h2>
        <p>
          SiroundChat processes data to provide AI chatbot, WhatsApp messaging, website chat, reservation, and
          business dashboard services for the businesses that use the platform.
        </p>
        <p>
          Depending on how a business uses SiroundChat, that data may include business information, customer messages,
          names, phone numbers, reservation details, chatbot conversations, and technical logs needed to operate and
          support the service.
        </p>

        <h2>WhatsApp and Meta data</h2>
        <p>
          If a business connects WhatsApp, SiroundChat may process WhatsApp messages and events received from Meta in
          order to provide automated replies, reservation handling, conversation history, and inbox functionality for
          that business.
        </p>

        <h2>How data is used</h2>
        <p>SiroundChat does not sell user or customer data.</p>
        <p>
          Data is used only to provide, secure, improve, and support the service, including message delivery,
          reservation handling, business dashboards, troubleshooting, and platform reliability.
        </p>

        <h2>Deletion requests</h2>
        <p>
          Users and businesses can request deletion of their data by emailing{" "}
          <a href="mailto:noarsiround@gmail.com">noarsiround@gmail.com</a>.
        </p>
      </>
    </LegalPageLayout>
  );
}
