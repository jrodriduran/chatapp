import { NextRequest, NextResponse } from "next/server";
import { processMessage } from "@/lib/whatsapp/process-message";

/**
 * Message processor endpoint.
 *
 * Called by QStash (or inline as fallback) after the webhook acknowledges
 * receipt. Generates the AI reply and sends it back via the WhatsApp API.
 */
export async function POST(request: NextRequest) {
  try {
    const { messageId } = await request.json();

    if (!messageId || typeof messageId !== "string") {
      return NextResponse.json(
        { error: "messageId is required" },
        { status: 400 }
      );
    }

    const result = await processMessage(messageId);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Processing failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("process-message error:", error);
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  }
}