// QStash client for async processing.
// Publishes jobs directly to the QStash HTTP API so heavy work
// (AI generation, DB writes) runs outside the webhook execution window.

const QSTASH_PUBLISH_URL = "https://qstash.upstash.io/v2/publish/";

/**
 * Publishes a JSON job to a destination URL through QStash.
 * Returns true on success, false on failure.
 */
export async function publishToQStash(
  destinationUrl: string,
  body: unknown
): Promise<boolean> {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    console.error("QSTASH_TOKEN is not set");
    return false;
  }

  try {
    const response = await fetch(
      QSTASH_PUBLISH_URL + encodeURIComponent(destinationUrl),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("QStash publish failed:", response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("QStash publish threw:", error);
    return false;
  }
}

/**
 * True when the app is running locally (dev). Used to decide whether to
 * process messages inline as a fallback instead of relying on QStash,
 * since QStash cannot reach a localhost URL.
 */
export function isLocalDev(): boolean {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return (
    appUrl.includes("localhost") ||
    appUrl.includes("127.0.0.1") ||
    process.env.NODE_ENV === "development"
  );
}