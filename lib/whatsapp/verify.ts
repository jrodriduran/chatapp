import crypto from "node:crypto";

/**
 * Verifies the Meta webhook signature (X-Hub-Signature-256).
 *
 * Meta signs the raw request body using HMAC-SHA256 with your App Secret.
 * The header looks like: sha256=<hex digest>
 */
export function verifyMetaSignature(
  signatureHeader: string | null | undefined,
  rawBody: string,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) {
    return false;
  }

  const expectedDigest = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const expectedHeader = `sha256=${expectedDigest}`;

  const expectedBuffer = Buffer.from(expectedHeader);
  const receivedBuffer = Buffer.from(signatureHeader);

  // Constant-time comparison to avoid timing attacks.
  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}