// Summary: Secondary inputs for business name and greeting text shown by the chatbot; light understanding is enough.
'use client';

type ChatbotGreetingInputProps = {
  businessName: string;
  greeting: string;
  onBusinessNameChange: (name: string) => void;
  onGreetingChange: (greeting: string) => void;
};

export function ChatbotGreetingInput({
  businessName,
  greeting,
  onBusinessNameChange,
  onGreetingChange
}: ChatbotGreetingInputProps) {
  return (
    <div className="space-y-3 rounded-2xl bg-slate-900/90 p-4">
      <p className="text-sm font-semibold text-slate-100">Brand &amp; basics</p>
      <div className="space-y-2">
        <label className="text-xs text-slate-100">
          Business name
          <input
            value={businessName}
            onChange={(event) => onBusinessNameChange(event.target.value)}
            placeholder="Your business"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-black px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          />
        </label>
      </div>
      <div className="space-y-2">
        <label className="text-xs text-slate-100">
          Greeting message
          <textarea
            value={greeting}
            onChange={(event) => onGreetingChange(event.target.value)}
            placeholder="Hi! I'm your virtual assistant. How can I help you today?"
            rows={3}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-black px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          />
        </label>
      </div>
    </div>
  );
}
