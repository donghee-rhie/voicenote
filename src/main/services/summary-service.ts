import Groq from 'groq-sdk';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getApiKeyWithFallback } from './api-key-service';
import { stripThinkingTags } from './llm-utils';
import { openaiGenerate } from './openai-api';
import type { LLMProvider } from '../../common/types/ipc';

let groqClient: Groq | null = null;
let fireworksClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

/**
 * Get or create Groq client
 */
function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = getApiKeyWithFallback('groq');
    if (!apiKey) {
      throw new Error('Groq API key is not set.');
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

/**
 * Get or create Fireworks client (OpenAI-compatible)
 */
function getFireworksClient(): OpenAI {
  if (!fireworksClient) {
    const apiKey = getApiKeyWithFallback('fireworks');
    if (!apiKey) {
      throw new Error('Fireworks API key is not set.');
    }
    fireworksClient = new OpenAI({
      apiKey,
      baseURL: 'https://api.fireworks.ai/inference/v1',
    });
  }
  return fireworksClient;
}

/**
 * Get or create Anthropic client
 */
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = getApiKeyWithFallback('anthropic');
    if (!apiKey) {
      throw new Error('Anthropic API key is not set.');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Reset client (when API key changes)
 */
export function resetSummaryClient(): void {
  groqClient = null;
  fireworksClient = null;
  anthropicClient = null;
}

/**
 * Generate a summary from merged refined text.
 * Used for long recordings where the text has already been chunked and refined.
 */
export async function generateSummary(
  text: string,
  options: {
    language?: string;
    model?: string;
    maxTokens?: number;
    llmProvider?: LLMProvider;
  } = {}
): Promise<string> {
  const provider = options.llmProvider || 'groq';
  const defaultModels: Record<LLMProvider, string> = {
    groq: 'openai/gpt-oss-120b',
    fireworks: 'accounts/fireworks/models/gpt-oss-120b',
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-6',
  };
  const model = options.model || defaultModels[provider];
  const language = options.language || 'ko';

  const langInstruction = language === 'ko' || language === 'ko-KR'
    ? '한국어로 응답해주세요.'
    : '';

  // For very long text, we summarize a truncated version
  // (LLM context limits: ~8000 tokens input)
  const maxInputChars = 12000;
  const inputText = text.length > maxInputChars
    ? text.substring(0, maxInputChars) + '\n\n[이하 생략...]'
    : text;

  const systemPrompt = `당신은 텍스트 요약 전문가입니다.
주어진 텍스트의 핵심 내용을 2-3문장으로 간결하게 요약해주세요.
마크다운 기호(*, -, #, ** 등)를 사용하지 마세요.
${langInstruction}`;

  const maxTokens = options.maxTokens || 500;

  if (provider === 'anthropic') {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: inputText },
      ],
    });
    const resultText = response.content[0]?.type === 'text' ? response.content[0].text : '';
    return stripThinkingTags(resultText);
  }

  const chatMessages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: inputText },
  ];

  if (provider === 'fireworks') {
    const client = getFireworksClient();
    const response = await client.chat.completions.create({ model, messages: chatMessages, temperature: 0.7, max_tokens: maxTokens });
    return stripThinkingTags(response.choices[0]?.message?.content || '');
  } else if (provider === 'openai') {
    const response = await openaiGenerate({
      model,
      system: systemPrompt,
      input: inputText,
      max_new_tokens: maxTokens,
    });
    return response.text;
  } else {
    const client = getGroqClient();
    const response = await client.chat.completions.create({ model, messages: chatMessages, temperature: 0.7, max_tokens: maxTokens });
    return stripThinkingTags(response.choices[0]?.message?.content || '');
  }
}
