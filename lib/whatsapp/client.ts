// WhatsApp Cloud API client (official Meta API).
// Uses fetch directly - no unofficial WhatsApp libraries.

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

export interface WhatsAppMessagePayload {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  text: { body: string };
}

/**
 * Sends a text message through the WhatsApp Cloud API.
 *
 * Uses the global WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN
 * environment variables (server-side only).
 */
export async function sendTextMessage(
  to: string,
  body: string
): Promise<boolean> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.error(
      "WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN is not configured"
    );
    return false;
  }

  const payload: WhatsAppMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  };

  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("WhatsApp send failed:", response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("WhatsApp send threw:", error);
    return false;
  }
}

/**
 * Validates the Meta webhook verification handshake.
 */
export function verifyWebhook(
  mode: string | null,
  verifyToken: string | null,
  challenge: string | null,
  expectedToken: string
): string | null {
  if (mode === "subscribe" && verifyToken === expectedToken && challenge) {
    return challenge;
  }
  return null;
}