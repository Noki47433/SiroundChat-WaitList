"use client";

interface ConversationSummary {
  id: string;
  name?: string;
  preview?: string;
  created_at: string;
}

interface ChatListProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function ChatList({ conversations, activeId, onSelect }: ChatListProps) {
  return (
    <div className="w-full max-w-sm border-r border-white/5">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-xs uppercase text-white/50">Conversations</p>
          <p className="text-sm text-white/80">{conversations.length} active</p>
        </div>
      </div>
      <ul className="divide-y divide-white/5">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <button
              onClick={() => onSelect(conversation.id)}
              className={`w-full px-4 py-3 text-left text-sm ${
                conversation.id === activeId ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
              }`}
            >
              <p className="font-semibold">{conversation.name ?? "Website visitor"}</p>
              <p className="text-xs text-white/60">{conversation.preview ?? "New conversation"}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
