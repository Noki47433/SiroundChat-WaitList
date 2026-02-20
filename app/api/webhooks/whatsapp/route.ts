import { handleInboundWebhook } from "@/lib/channels/webhook-handler";

export async function POST(request: Request) {
  return handleInboundWebhook("whatsapp", request);
}
