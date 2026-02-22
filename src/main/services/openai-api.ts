import { getOpenAILLMClient } from './openai-llm-service';
import { stripThinkingTags } from './llm-utils';

export interface InternalRequest {
  model: string;
  system?: string;
  input: string;
  max_new_tokens?: number;
  temperature?: number;
  top_p?: number;
}

export interface InternalResponse {
  text: string;
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
  response_id?: string;
  api_used: 'responses' | 'chat';
}

/**
 * Unified OpenAI API call.
 * Tries Responses API first, falls back to Chat Completions on 400/404.
 * Strips thinking tags from output automatically.
 */
export async function openaiGenerate(req: InternalRequest): Promise<InternalResponse> {
  const client = getOpenAILLMClient();
  const maxTokens = req.max_new_tokens ?? 4000;

  // --- Attempt 1: Responses API ---
  try {
    return await callResponsesApi(client, req, maxTokens, true);
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status;
    const msg: string = err?.message ?? '';

    // 401/429: throw immediately, no fallback
    if (status === 401 || status === 429) {
      throw err;
    }

    // Temperature-related error: retry without temperature
    if (isTemperatureError(msg, status)) {
      console.log('[openaiGenerate] Temperature rejected, retrying Responses API without temperature');
      try {
        return await callResponsesApi(client, req, maxTokens, false);
      } catch (retryErr: any) {
        const retryStatus = retryErr?.status ?? retryErr?.response?.status;
        if (retryStatus === 401 || retryStatus === 429) throw retryErr;
        if (retryStatus === 400 || retryStatus === 404) {
          console.log('[openaiGenerate] Responses API failed, falling back to Chat Completions');
          return await callChatApi(client, req, maxTokens);
        }
        throw retryErr;
      }
    }

    // 400/404: fall back to Chat Completions
    if (status === 400 || status === 404) {
      console.log('[openaiGenerate] Responses API unavailable, falling back to Chat Completions');
      return await callChatApi(client, req, maxTokens);
    }

    throw err;
  }
}

// --- Internal helpers ---

async function callResponsesApi(
  client: any,
  req: InternalRequest,
  maxTokens: number,
  includeTemperature: boolean
): Promise<InternalResponse> {
  const params: any = {
    model: req.model,
    input: req.input,
    max_output_tokens: maxTokens,
    store: false,
  };
  if (req.system) params.instructions = req.system;
  if (includeTemperature && req.temperature !== undefined) params.temperature = req.temperature;
  if (req.top_p !== undefined) params.top_p = req.top_p;

  const response = await client.responses.create(params);

  const text = stripThinkingTags(response.output_text ?? '');
  const usage = response.usage
    ? {
        input_tokens: response.usage.input_tokens ?? 0,
        output_tokens: response.usage.output_tokens ?? 0,
        total_tokens: (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0),
      }
    : undefined;

  return { text, usage, response_id: response.id, api_used: 'responses' };
}

async function callChatApi(
  client: any,
  req: InternalRequest,
  maxTokens: number
): Promise<InternalResponse> {
  const messages: Array<{ role: string; content: string }> = [];
  if (req.system) messages.push({ role: 'system', content: req.system });
  messages.push({ role: 'user', content: req.input });

  const params: any = {
    model: req.model,
    messages,
    max_completion_tokens: maxTokens,
  };
  if (req.temperature !== undefined) params.temperature = req.temperature;
  if (req.top_p !== undefined) params.top_p = req.top_p;

  const response = await client.chat.completions.create(params);

  const text = stripThinkingTags(response.choices[0]?.message?.content ?? '');
  const usage = response.usage
    ? {
        input_tokens: response.usage.prompt_tokens ?? 0,
        output_tokens: response.usage.completion_tokens ?? 0,
        total_tokens: response.usage.total_tokens ?? 0,
      }
    : undefined;

  return { text, usage, response_id: response.id, api_used: 'chat' };
}

function isTemperatureError(message: string, status?: number): boolean {
  if (status !== 400) return false;
  const lower = message.toLowerCase();
  return lower.includes('temperature') || lower.includes('unsupported parameter');
}
