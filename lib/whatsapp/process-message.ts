import { createAdminClient } from "@/lib/supabase/admin";
import { generateReply, getDefaultAIEngineConfig } from "@/lib/ai/engine";
import { sendTextMessage } from "@/lib/whatsapp/client";

/**
 * Shared message-processing pipeline used by:
 *  - /api/process-message (called by QStash)
 *  - the inline fallback when QStash is unavailable (local dev)
 *
 * Steps: load message -> idempotency check -> mark processing ->
 * load bot/organization -> build prompt -> generate AI reply ->
 * send via WhatsApp -> persist outgoing message -> mark processed.
 */
export async function processMessage(messageId: string): Promise<{
  ok: boolean;
  skipped?: boolean;
  error?: string;
}> {
  const supabase = createAdminClient();

  // 1. Load the incoming message.
  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single();

  if (messageError || !message) {
    console.error("Message not found:", messageId, messageError);
    return { ok: false, error: "Message not found" };
  }

  // 2. Idempotency: only process messages still pending.
  if (message.status !== "pending") {
    return { ok: true, skipped: true };
  }

  // 3. Mark as processing so concurrent retries are ignored.
  await supabase
    .from("messages")
    .update({ status: "processing" })
    .eq("id", messageId);

  try {
    // 4. Load conversation, contact, bot and organization.
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", message.conversation_id)
      .single();

    if (conversationError || !conversation) {
      throw new Error("Conversation not found");
    }

    const { data: contact } = await supabase
      .from("contacts")
      .select("phone, language")
      .eq("id", conversation.contact_id)
      .single();

    let botId = conversation.bot_id;
    if (!botId) {
      // MVP: fall back to the first active bot in the organization.
      const { data: firstBot } = await supabase
        .from("bots")
        .select("id")
        .eq("organization_id", conversation.organization_id)
        .eq("status", "active")
        .limit(1)
        .single();
      botId = firstBot?.id ?? null;
    }

    const { data: bot } = botId
      ? await supabase.from("bots").select("*").eq("id", botId).single()
      : { data: null };

    const { data: organization } = await supabase
      .from("organizations")
      .select("name, default_locale")
      .eq("id", conversation.organization_id)
      .single();

    const contactPhone = contact?.phone ?? message.content;

    // 5. Load recent conversation history for context (last 10 messages).
    const { data: history } = await supabase
      .from("messages")
      .select("direction, sender_type, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(10);

    // 6. Build the system prompt from bot config + context + language.
    const language = bot?.language ?? contact?.language ?? "en";
    const tone = bot?.tone ? `Tone: ${bot.tone}.` : "";
    const instructions = bot?.instructions
      ? `Instructions: ${bot.instructions}`
      : "";
    // MVP note: FAQ content from bot_documents is not implemented yet.
    // Add `context` here once a documents table exists.

    const systemPrompt = [
      `You are a helpful WhatsApp assistant for ${organization?.name ?? "our business"}.`,
      instructions,
      tone,
      `Always respond in ${language}.`,
      "Keep responses concise and friendly, suitable for WhatsApp.",
    ]
      .filter(Boolean)
      .join("\n");

    const aiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...(history ?? []).map((m) => ({
        role: (m.sender_type === "bot" ? "assistant" : "user") as
          | "assistant"
          | "user",
        content: m.content,
      })),
    ];

    // 7. Generate the AI reply.
    let reply: string;
    try {
      const temperature = bot?.temperature != null ? Number(bot.temperature) : 0.7;
      reply = await generateReply(getDefaultAIEngineConfig(), aiMessages, {
        temperature,
      });
    } catch (aiError) {
      console.error("AI generation failed:", aiError);
      if (!bot?.fallback_message) {
        throw new Error("AI failed and no fallback message is configured");
      }
      reply = bot.fallback_message;
    }

    // 8. Send the reply via the WhatsApp Cloud API.
    const sent = await sendTextMessage(contactPhone, reply);
    if (!sent) {
      throw new Error("Failed to send WhatsApp reply");
    }

    // 9. Persist the outgoing message and update statuses.
    await supabase.from("messages").insert({
      organization_id: conversation.organization_id,
      conversation_id: conversation.id,
      direction: "outgoing",
      sender_type: "bot",
      content: reply,
      status: "processed",
      metadata: { ai_model: process.env.AI_MODEL ?? null },
    });

    await supabase
      .from("messages")
      .update({ status: "processed" })
      .eq("id", messageId);

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);

    return { ok: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown processing error";
    console.error("processMessage failed:", errorMessage);

    // On error: mark the message as failed and store the error in metadata.
    await supabase
      .from("messages")
      .update({
        status: "failed",
        metadata: { error: errorMessage },
      })
      .eq("id", messageId);

    return { ok: false, error: errorMessage };
  }
}