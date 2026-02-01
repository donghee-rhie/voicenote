import OpenAI from 'openai';
import type { RefinementResult } from '../../common/types/ipc';

let openaiClient: OpenAI | null = null;

/**
 * Initialize OpenAI client with API key
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export interface RefinementOptions {
  language?: string;
  format?: string;
  model?: string;
  generateSummary?: boolean;
}

/**
 * Get system prompt based on format type
 */
function getSystemPrompt(format?: string): string {
  const basePrompt = "You are a text refinement assistant. Clean up the following speech-to-text output, fixing grammar, removing filler words, and improving readability while preserving the original meaning.";

  switch (format) {
    case 'FORMATTED':
      return `${basePrompt} Format the text with proper paragraphs and structure.`;
    case 'SCRIPT':
      return `${basePrompt} Format as a script with clear dialogue structure.`;
    case 'AUTO':
      return `${basePrompt} Automatically detect and apply the most appropriate format.`;
    default:
      return basePrompt;
  }
}

/**
 * Refine text using OpenAI ChatCompletion API
 */
export async function refineText(
  text: string,
  options: RefinementOptions = {}
): Promise<RefinementResult> {
  try {
    const client = getOpenAIClient();

    if (!text || text.trim().length === 0) {
      throw new Error('Text is empty');
    }

    const systemPrompt = getSystemPrompt(options.format);
    const model = options.model || 'gpt-4o-mini';

    // Refine the text
    const refinementResponse = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const refinedText = refinementResponse.choices[0]?.message?.content || text;

    const result: RefinementResult = {
      text: refinedText,
    };

    // Generate summary if requested
    if (options.generateSummary) {
      const summaryResponse = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a summarization assistant. Create a brief, concise summary of the following text in 2-3 sentences.',
          },
          { role: 'user', content: refinedText },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      result.summary = summaryResponse.choices[0]?.message?.content || undefined;
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Refinement failed: ${error.message}`);
    }
    throw new Error('Refinement failed: Unknown error');
  }
}

/**
 * Set API key at runtime (useful for settings updates)
 */
export function setOpenAIApiKey(apiKey: string): void {
  openaiClient = new OpenAI({ apiKey });
}
