/**
 * Service for interacting with a locally running Ollama instance.
 *
 * The Ollama HTTP API is exposed on `http://localhost:11434` by default.
 * You can override the base URL with the `OLLAMA_URL` environment variable.
 *
 * This module exports a single helper `queryOllama` that sends a prompt to
 * Ollama and returns the generated response text.
 */

export interface OllamaRequestBody {
  model: string;
  prompt: string;
  stream?: boolean;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  // In case of error, Ollama might return an `error` field.
  error?: string;
}

/**
 * Sends a prompt to the local Ollama instance and returns the generated text.
 *
 * @param prompt - The text prompt to send to the model.
 * @param model  - Optional model name. Defaults to `"llama3"` if omitted.
 * @returns The generated response string.
 *
 * @throws {Error} If the request fails or the response contains an error.
 */
export async function queryOllama(
  prompt: string,
  model: string = 'svitlo-bot_gemma3:270m',
): Promise<string> {
  const url = `http://localhost:${process.env.OLLAMA_PORT}/api/generate`;

  const body: OllamaRequestBody = {
    model,
    prompt,
    stream: false,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Ollama request failed with status ${response.status}: ${text}`,
    );
  }

  const data: OllamaResponse = await response.json();

  if (data.error) {
    throw new Error(`Ollama error: ${data.error}`);
  }

  return data.response;
}
