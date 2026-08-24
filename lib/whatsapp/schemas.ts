import { z } from "zod";

// Zod schemas for the WhatsApp Cloud API webhook payload.

const WhatsAppTextSchema = z.object({
  body: z.string(),
});

const WhatsAppMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string().optional(),
  type: z.string().optional(),
  text: WhatsAppTextSchema.optional(),
});

const WhatsAppContactSchema = z.object({
  wa_id: z.string().optional(),
  profile: z
    .object({
      name: z.string().optional(),
    })
    .optional(),
});

const WhatsAppMetadataSchema = z.object({
  display_phone_number: z.string().optional(),
  phone_number_id: z.string().optional(),
});

const WhatsAppValueSchema = z.object({
  messaging_product: z.string().optional(),
  metadata: WhatsAppMetadataSchema.optional(),
  contacts: z.array(WhatsAppContactSchema).optional(),
  messages: z.array(WhatsAppMessageSchema).optional(),
  statuses: z.array(z.unknown()).optional(),
});

const WhatsAppChangeSchema = z.object({
  value: WhatsAppValueSchema,
});

const WhatsAppEntrySchema = z.object({
  id: z.string(),
  changes: z.array(WhatsAppChangeSchema),
});

export const WhatsAppWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(WhatsAppEntrySchema),
});

export type WhatsAppWebhookPayload = z.infer<typeof WhatsAppWebhookSchema>;
export type WhatsAppIncomingMessage = z.infer<typeof WhatsAppMessageSchema>;