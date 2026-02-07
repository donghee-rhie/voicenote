import Groq from 'groq-sdk';
import { getApiKeyWithFallback } from './api-key-service';

let groqClient: Groq | null = null;

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
 * Reset client (when API key changes)
 */
export function resetSummaryClient(): void {
  groqClient = null;
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
  } = {}
): Promise<string> {
  const client = getGroqClient();
  const model = options.model || 'openai/gpt-oss-120b';
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

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: inputText },
    ],
    temperature: 0.7,
    max_tokens: options.maxTokens || 500,
  });

  return response.choices[0]?.message?.content || '';
}
