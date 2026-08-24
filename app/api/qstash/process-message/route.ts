import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateReply, getDefaultAIEngineConfig } from "@/lib/ai/engine";
import { sendTextMessage } from "@/lib/whatsapp/client";

// QStash callback - processes the message asynchronously
// This runs outside the webhook's 3-second execution window
export async function POST(request: NextRequest) {
  try {
    // Verify QStash signature (optional but recommended)
    // const signature = request.headers.get("upstash-signature");
    // TODO: verify signature with QStash

    const payload = await request.json();
    const { botId, organizationId, contactPhone, messageBody, messageId } =
      payload;

    // Create Supabase admin client (server-side only)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Find the bot by phone number id
    const { data: integration, error: integrationError } = await supabase
      .from("whatsapp_integrations")
      .select("*, bots(*)")
      .eq("phone_number_id", botId)
      .single();

    if (integrationError || !integration) {
      console.error("Integration not found:", integrationError);
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const bot = integration.bots;
    const organizationIdFromDb = integration.organization_id;

    // Find or create contact
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("*")
      .eq("organization_id", organizationIdFromDb)
      .eq("phone", contactPhone)
      .single();

    let contactId = existingContact?.id;

    if (!contactId) {
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          organization_id: organizationIdFromDb,
          phone: contactPhone,
          language: bot.language,
        })
        .select()
        .single();

      if (contactError) {
        console.error("Contact creation failed:", contactError);
        return NextResponse.json({ error: "Contact creation failed" }, { status: 500 });
      }
      contactId = newContact.id;
    }

    // Find or create conversation
    const { data: existingConversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("organization_id", organizationIdFromDb)
      .eq("bot_id", bot.id)
      .eq("contact_id", contactId)
      .eq("status", "open")
      .single();

    let conversationId = existingConversation?.id;

    if (!conversationId) {
      const { data: newConversation, error: conversationError } = await supabase
        .from("conversations")
        .insert({
          organization_id: organizationIdFromDb,
          bot_id: bot.id,
          contact_id: contactId,
          status: "open",
        })
        .select()
        .single();

      if (conversationError) {
        console.error("Conversation creation failed:", conversationError);
        return NextResponse.json({ error: "Conversation creation failed" }, { status: 500 });
      }
      conversationId = newConversation.id;
    }

    // Save customer message
    await supabase.from("messages").insert({
      organization_id: organizationIdFromDb,
      conversation_id: conversationId,
      sender: "customer",
      content: messageBody,
    });

    // Get AI provider config for this bot
    const { data: aiConfig } = await supabase
      .from("ai_provider_configs")
      .select("*")
      .eq("bot_id", bot.id)
      .single();

    // Build AI config (per-bot config or default from env)
    const aiEngineConfig = aiConfig
      ? {
          apiBaseUrl: aiConfig.api_base_url,
          apiKey: aiConfig.api_key,
          model: aiConfig.model,
        }
      : getDefaultAIEngineConfig();

    // Build conversation history for context
    const { data: history } = await supabase
      .from("messages")
      .select("sender, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const messages = [
      {
        role: "system" as const,
        content: bot.system_prompt || `You are a helpful assistant. Respond in ${bot.language}.`,
      },
      ...(history || []).map((m) => ({
        role: (m.sender === "bot" ? "assistant" : "user") as "assistant" | "user",
        content: m.content,
      })),
    ];

    // Generate AI reply
    let reply: string;
    try {
      reply = await generateReply(aiEngineConfig, messages);
    } catch (aiError) {
      console.error("AI generation failed:", aiError);
      reply = bot.fallback_message || "Sorry, I'm having trouble right now. Please try again later.";
    }

    // Save bot message
    await supabase.from("messages").insert({
      organization_id: organizationIdFromDb,
      conversation_id: conversationId,
      sender: "bot",
      content: reply,
    });

    // Update conversation last_message_at
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    // Send reply via WhatsApp
    const sent = await sendTextMessage(contactPhone, reply);

    if (!sent) {
      console.error("Failed to send WhatsApp message");
      return NextResponse.json({ error: "Send failed" }, { status: 500 });
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("QStash processing error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}