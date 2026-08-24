import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMetaSignature } from "@/lib/whatsapp/verify";
import { verifyWebhook } from "@/lib/whatsapp/client";
import { WhatsAppWebhookSchema } from "@/lib/whatsapp/schemas";
import { publishToQStash, isLocalDev } from "@/lib/qstash/client";
import { processMessage } from "@/lib/whatsapp/process-message";

/**
 * WhatsApp Cloud API webhook.
 *
 * GET  - Meta verification handshake.
 * POST - Receives incoming messages. Must respond to Meta in under 3 seconds,
 *        so heavy processing is delegated to QStash. If QStash is unavailable
 *        (e.g. local dev), the message is processed inline.
 */

// GET: Meta subscription verification.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!expectedToken) {
    return new NextResponse("Webhook not configured", { status: 500 });
  }

  const result = verifyWebhook(mode, token, challenge, expectedToken);

  if (result) {
    return new NextResponse(result, { status: 200 });
  }

  return new NextResponse("Verification failed", { status: 403 });
}

// POST: Incoming messages webhook.
export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET ?? "";
  const signature = request.headers.get("x-hub-signature-256");

  const rawBody = await request.text();

  // Verify the Meta signature using the App Secret (HMAC-SHA256).
  // In development ONLY, a missing signature is accepted for local testing.
  if (signature) {
    if (!verifyMetaSignature(signature, rawBody, appSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  let payload;
  try {
    payload = WhatsAppWebhookSchema.parse(JSON.parse(rawBody));
  } catch (error) {
    console.error("Invalid webhook payload:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Idempotency: if a message with the same wa_message_id already exists,
  // we already processed this delivery (Meta retries on timeouts).
  const alreadyProcessed = async (waMessageId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("messages")
      .select("id")
      .eq("wa_message_id", waMessageId)
      .maybeSingle();
    return Boolean(data);
  };

  try {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;
        const messages = value.messages ?? [];

        if (messages.length === 0) {
          // Status updates / delivery receipts have no messages.
          continue;
        }

        const phoneNumberId = value.metadata?.phone_number_id;
        const contactWaId = value.contacts?.[0]?.wa_id;

        if (!phoneNumberId) {
          console.error("Missing phone_number_id in webhook payload");
          continue;
        }

        for (const message of messages) {
          // Only text messages are supported in the MVP.
          if (message.type !== "text" || !message.text?.body) {
            continue;
          }

          const contactPhone = contactWaId ?? message.from;
          const waMessageId = message.id;
          const messageBody = message.text.body;

          // Idempotency guard.
          if (await alreadyProcessed(waMessageId)) {
            continue;
          }

          // Look up the organization by the WhatsApp phone number id.
          const { data: account } = await supabase
            .from("whatsapp_accounts")
            .select("id, organization_id")
            .eq("phone_number_id", phoneNumberId)
            .maybeSingle();

          if (!account) {
            console.error(
              "No whatsapp_account found for phone_number_id:",
              phoneNumberId
            );
            continue;
          }

          const organizationId = account.organization_id;

          // Get or create the contact (unique per organization + phone).
          const { data: existingContact } = await supabase
            .from("contacts")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("phone", contactPhone)
            .maybeSingle();

          let contactId = existingContact?.id;

          if (!contactId) {
            const { data: newContact, error: contactError } = await supabase
              .from("contacts")
              .insert({
                organization_id: organizationId,
                phone: contactPhone,
                first_seen_at: new Date().toISOString(),
                last_seen_at: new Date().toISOString(),
              })
              .select("id")
              .single();

            if (contactError || !newContact) {
              console.error("Contact creation failed:", contactError);
              continue;
            }
            contactId = newContact.id;
          } else {
            await supabase
              .from("contacts")
              .update({ last_seen_at: new Date().toISOString() })
              .eq("id", contactId);
          }
// Get or create the conversation for this contact.
          const { data: existingConversation } = await supabase
            .from("conversations")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("contact_id", contactId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          let conversationId = existingConversation?.id;

          if (!conversationId) {
            // Assign the first active bot of the organization.
            const { data: firstBot } = await supabase
              .from("bots")
              .select("id")
              .eq("organization_id", organizationId)
              .eq("status", "active")
              .limit(1)
              .maybeSingle();

            const { data: newConversation, error: conversationError } =
              await supabase
                .from("conversations")
                .insert({
                  organization_id: organizationId,
                  contact_id: contactId,
                  bot_id: firstBot?.id ?? null,
                  status: "open",
                  last_message_at: new Date().toISOString(),
                })
                .select("id")
                .single();

            if (conversationError || !newConversation) {
              console.error("Conversation creation failed:", conversationError);
              continue;
            }
            conversationId = newConversation.id;
          }
// Insert the incoming message with status 'pending'.
          const { data: insertedMessage, error: insertError } = await supabase
            .from("messages")
            .insert({
              organization_id: organizationId,
              conversation_id: conversationId,
              direction: "incoming",
              sender_type: "user",
              content: messageBody,
              wa_message_id: waMessageId,
              status: "pending",
            })
            .select("id")
            .single();

          if (insertError || !insertedMessage) {
            console.error("Message insert failed:", insertError);
            continue;
          }

          // Update the conversation: reopen and touch last_message_at.
          await supabase
            .from("conversations")
            .update({
              status: "open",
              unread_count: 0, // Example: could be reset here.
              last_message_at: new Date().toISOString(),
            })
            .eq("id", conversationId);

          const messageId = insertedMessage.id;

          // Delegate heavy processing to QStash; fallback to inline.
          const destinationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/process-message`;
          const useQStash = !isLocalDev();
          const published = useQStash
            ? await publishToQStash(destinationUrl, { messageId })
            : false;

          if (!published) {
            // Fallback: process here (e.g. local dev where QStash can't reach localhost).
            await processMessage(messageId);
          }
        }
      }
    }

    // Always acknowledge receipt quickly with 200.
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Still return 200 so Meta does not retry an already accepted payload.
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
}
