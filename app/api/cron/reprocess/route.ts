import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishToQStash, isLocalDev } from "@/lib/qstash/client";
import { processMessage } from "@/lib/whatsapp/process-message";

/**
 * Cron job to reprocess messages stuck in 'pending' or 'processing'.
 *
 * Protected by the `Authorization: Bearer <CRON_SECRET>` header.
 * For each stale message, re-publishes a QStash job to /api/process-message
 * (or processes it inline when running locally).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: messages, error } = await supabase
      .from("messages")
      .select("id")
      .in("status", ["pending", "processing"])
      .lt("created_at", cutoff)
      .limit(50);

    if (error) {
      console.error("Cron: failed to fetch stale messages", error);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    const destinationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/process-message`;
    let reprocessed = 0;

    for (const message of messages ?? []) {
      // Reset the message so processMessage can pick it up again.
      await supabase
        .from("messages")
        .update({ status: "pending" })
        .eq("id", message.id);

      const published = !isLocalDev()
        ? await publishToQStash(destinationUrl, { messageId: message.id })
        : false;

      if (!published) {
        // Local fallback: process inline.
        await processMessage(message.id);
      }
      reprocessed += 1;
    }

    return NextResponse.json({ status: "ok", reprocessed }, { status: 200 });
  } catch (error) {
    console.error("Cron reprocess error:", error);
    return NextResponse.json(
      { error: "Reprocessing failed" },
      { status: 500 }
    );
  }
}