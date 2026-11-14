import {
  getSessionForRequest,
  commitSessionAfterResponse,
  cleanupExpiredSessions,
} from './sessions.js';

/**
 * Service for interacting with a locally running Ollama instance.
 *
 * The Ollama HTTP API is exposed on `http://localhost:11434` by default.
 * You can override the base URL with the `OLLAMA_URL` environment variable.
 *
 * This module exports a single helper `queryOllama` that sends a prompt to
 * Ollama and returns the generated response text.
 */
type ChatMessage = { role: 'user' | 'assistant'; content: string };

type QueryOllamaParams = {
  query: string;
  userId: string;
  context?: string;
  model?: string;
};

export interface OllamaRequestBody {
  model: string;
  prompt?: string;
  stream?: boolean;
  messages?: ChatMessage[];
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  message: ChatMessage;
  done: boolean;
  // In case of error, Ollama might return an `error` field.
  error?: string;
}

const RESPONSE_TIMEOUT_MS = 15000;

function buildMessages(userPrompt: string, context?: string): ChatMessage[] {
  if (!context) {
    return [{ role: 'user', content: userPrompt }];
  }

  return [
    {
      role: 'user',
      content: [
        // 'Важливо: нижче наведені службові дані. Не згадуй їхні заголовки та не цитуй дослівно.',
        // 'Якщо питання про світло — використай ці дані. Інакше відповідай звичайно.',
        // '',
        'Службові дані нижче.',
        'Якщо питання про світло — використай їх.  Інакше відповідай звичайно.',
        // 'У відповіді вкажи лише стан і час зміни стану.',
        '',
        context!.trim(),
      ].join('\n'),
    },
    {
      role: 'user',
      content: userPrompt,
    },
  ];
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
export async function queryOllama({
  query,
  userId,
  context,
  model = 'svitlo-bot_gemma3:1b', // svitlo-bot_gemma3:270m-1
}: QueryOllamaParams): Promise<string> {
  const url = `http://localhost:${process.env.OLLAMA_PORT}/api/chat`;
  const now = Date.now();

  cleanupExpiredSessions(now);

  const session = userId ? getSessionForRequest(userId, now) : undefined;

  const messages: ChatMessage[] = session
    ? [...session.messages, ...buildMessages(query, context)]
    : buildMessages(query, context);

  // debug: inspect full payload sent to ollama
  console.log(`=== SESSION DEBUG (${userId}) ===`);
  console.dir(messages, { depth: null });
  console.log('===============================\n');

  const body: OllamaRequestBody = {
    model,
    stream: false,
    messages,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESPONSE_TIMEOUT_MS);

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

  const answer = data.message.content as string;

  if (userId && session) {
    commitSessionAfterResponse(userId, session, query, answer, now);
  }

  return answer;
}
