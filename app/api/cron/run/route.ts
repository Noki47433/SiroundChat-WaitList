import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { runCronTasks } from "@/lib/automations/scheduler";
import { log } from "@/lib/utils/log";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const taskParam = searchParams.get("task") ?? "all";
  const task =
    taskParam === "outbox" || taskParam === "abandoned" || taskParam === "offers" || taskParam === "followups"
      ? taskParam
      : "all";

  try {
    const admin = getSupabaseAdminClient() as any;
    const result = await runCronTasks(admin, task);
    return NextResponse.json({ ok: true, task, result });
  } catch (error) {
    log("error", "Cron runner failed", { error, task });
    return NextResponse.json({ error: "Cron task failed" }, { status: 500 });
  }
}
