import { notFound } from "next/navigation";
import { ChatThread } from "@/components/dashboard/ChatThread";
import { ChatList } from "@/components/dashboard/ChatList";
import { LeadTable } from "@/components/dashboard/LeadTable";

export default function DemoPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const mockLeads = [
    { id: "1", businessId: "demo", name: "Besa", email: "besa@example.com", phone: "+383 44 123 456", source: "chat", createdAt: new Date().toISOString() }
  ];
  return (
    <div className="min-h-screen bg-neutral-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="text-sm uppercase text-white/50">SiroundChat Demo</p>
          <h1 className="text-4xl font-semibold">Try the dashboard without signing up</h1>
          <p className="mt-3 text-white/70">
            This is a safe sandbox. Nothing you do here is stored. We built this to help business owners see the results
            first and then decide.
          </p>
        </div>
        <div className="flex min-h-[420px] overflow-hidden rounded-3xl border border-white/5">
          <ChatList
            conversations={[{ id: "demo", name: "Visitor from Prishtina", preview: "Can you build my site?", created_at: new Date().toISOString() }]}
            activeId="demo"
            onSelect={() => {}}
          />
          <ChatThread
            messages={[
              { id: "1", conversationId: "demo", sender: "user", text: "Do you also run ads?", createdAt: new Date().toISOString() },
              { id: "2", conversationId: "demo", sender: "ai", text: "Po, ne ju ndihmojmë edhe me reklamat.", createdAt: new Date().toISOString() }
            ]}
            onSend={async () => {}}
          />
        </div>
        <LeadTable leads={mockLeads} />
      </div>
    </div>
  );
}
