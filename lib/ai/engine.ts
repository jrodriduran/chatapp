// AI engine - OpenAI-compatible API client.
// Configurable via environment variables (AI_BASE_URL / AI_API_KEY / AI_MODEL)
// to support DeepSeek, Qwen, and any other OpenAI-compatible provider.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIEngineConfig {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
}

export async function generateReply(
  config: AIEngineConfig,
  messages: ChatMessage[],
  options?: GenerateOptions
): Promise<string> {
  const response = await fetch(`${config.apiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI engine error:", response.status, errorText);
    throw new Error(`AI request failed with status ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI response missing content");
  }

  return content.trim();
}

// Default config from environment variables.
export function getDefaultAIEngineConfig(): AIEngineConfig {
  return {
    apiBaseUrl: process.env.AI_BASE_URL || "https://api.deepseek.com/v1",
    apiKey: process.env.AI_API_KEY || "",
    model: process.env.AI_MODEL || "deepseek-chat",
  };
}