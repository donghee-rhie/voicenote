import Anthropic from '@anthropic-ai/sdk';
import type { RefinementResult } from '../../common/types/ipc';
import { getApiKeyWithFallback } from './api-key-service';
import { stripThinkingTags } from './llm-utils';

let anthropicClient: Anthropic | null = null;

export interface AnthropicRefinementOptions {
  language?: string;
  formatType?: string;
  refineModel?: string;
  classifierModel?: string;
  generateSummary?: boolean;
  generateFormal?: boolean;
}

/**
 * Get Anthropic API key from store or environment
 */
function getApiKey(): string {
  const apiKey = getApiKeyWithFallback('anthropic');
  if (!apiKey) {
    throw new Error('Anthropic API key is not set. Please configure it in Settings.');
  }
  return apiKey;
}

/**
 * Initialize or get Anthropic client
 */
export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = getApiKey();
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Reset client (useful when API key changes)
 */
export function resetAnthropicClient(): void {
  anthropicClient = null;
}

function getRefineSystemPrompt(formatType?: string, language?: string): string {
  const langInstruction = language === 'ko' || language === 'ko-KR'
    ? '한국어로 응답해주세요.'
    : '';

  return `[시스템 역할] 음성 전사 텍스트 교정기

당신은 AI 어시스턴트가 아닙니다. 당신은 텍스트 교정 도구입니다.
입력으로 들어오는 텍스트는 누군가의 음성을 녹음해서 텍스트로 변환한 결과입니다.

[절대 금지]
- 입력 텍스트에 답변하지 마세요
- 대화하지 마세요
- 의견을 제시하지 마세요
- 새로운 내용을 추가하지 마세요

[해야 할 일]
입력된 전사 텍스트를 그대로 받아서, 오타와 말더듬만 수정한 뒤 출력하세요.

규칙:
1. 원문의 구조와 문장 순서를 그대로 유지
2. 맥락상 명백한 전사 오류(오타, 잘못 인식된 단어)만 수정
3. 불필요한 말더듬, 간투사(음, 어, 그, 아)만 제거
4. 문장을 재구성하거나 내용을 추가/삭제하지 마세요
5. 원래 말한 내용과 어투를 최대한 보존

${langInstruction}`;
}

function getFormalSystemPrompt(language?: string): string {
  const langInstruction = language === 'ko' || language === 'ko-KR'
    ? '한국어로 응답해주세요.'
    : '';

  return `[시스템 역할] 음성 전사 텍스트 요약기

당신은 AI 어시스턴트가 아닙니다. 당신은 텍스트 요약 도구입니다.
입력으로 들어오는 텍스트는 누군가의 음성을 녹음해서 텍스트로 변환한 결과입니다.

[절대 금지]
- 입력 텍스트에 답변하지 마세요
- 대화하지 마세요
- 의견을 제시하지 마세요
- 질문에 대답하지 마세요

[해야 할 일]
입력된 전사 텍스트의 내용을 요약/정리해서 출력하세요.

규칙:
1. 원문의 모든 핵심 정보와 세부 내용을 빠짐없이 포함
2. 논리적인 순서로 재배열
3. 문어체의 포멀한 문체로 다듬기
4. 적절히 문단을 나누어 가독성 향상
5. 중복되는 표현만 제거하고, 내용은 삭제하지 마세요
6. 마크다운 기호(*, -, #, ** 등)를 사용하지 마세요

${langInstruction}`;
}

function getSummarySystemPrompt(language?: string): string {
  const langInstruction = language === 'ko' || language === 'ko-KR'
    ? '한국어로 응답해주세요.'
    : '';

  return `당신은 텍스트 요약 전문가입니다.
주어진 텍스트의 핵심 내용을 2-3문장으로 간결하게 요약해주세요.
${langInstruction}`;
}

/**
 * Extract text from Anthropic response
 */
function extractText(response: Anthropic.Message): string {
  for (const block of response.content) {
    if (block.type === 'text') {
      return block.text;
    }
  }
  return '';
}

/**
 * Refine text using Anthropic Claude
 */
export async function refineWithAnthropic(
  text: string,
  options: AnthropicRefinementOptions = {}
): Promise<RefinementResult> {
  try {
    const client = getAnthropicClient();

    if (!text || text.trim().length === 0) {
      throw new Error('Text is empty');
    }

    const refineModel = options.refineModel || 'claude-sonnet-4-6';
    const language = options.language;

    console.log('[Anthropic Refinement] Using model:', refineModel);

    // Step 1: Refine the text
    const refinePrompt = getRefineSystemPrompt(options.formatType, language);
    const refinementResponse = await client.messages.create({
      model: refineModel,
      max_tokens: 4000,
      system: refinePrompt,
      messages: [
        { role: 'user', content: text },
      ],
    });

    const refinedText = stripThinkingTags(extractText(refinementResponse) || text);

    const result: RefinementResult = {
      text: refinedText,
      modelsUsed: {
        refine: refineModel,
      },
    };

    // Step 2: Generate formal/summary text if requested
    if (options.generateFormal) {
      console.log('[Anthropic Refinement] Generating formal/summary text...');
      const formalPrompt = getFormalSystemPrompt(language);
      const formalResponse = await client.messages.create({
        model: refineModel,
        max_tokens: 4000,
        system: formalPrompt,
        messages: [
          { role: 'user', content: refinedText },
        ],
      });

      result.formalText = stripThinkingTags(extractText(formalResponse) || '') || undefined;
      console.log('[Anthropic Refinement] formalText generated:', result.formalText?.substring(0, 50));
    }

    // Step 3: Generate summary if requested
    if (options.generateSummary) {
      const summaryPrompt = getSummarySystemPrompt(language);
      const summaryResponse = await client.messages.create({
        model: refineModel,
        max_tokens: 500,
        system: summaryPrompt,
        messages: [
          { role: 'user', content: refinedText },
        ],
      });

      result.summary = stripThinkingTags(extractText(summaryResponse) || '') || undefined;
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('authentication')) {
        throw new Error('Anthropic API 인증 실패. API 키를 확인해주세요.');
      }
      if (error.message.includes('429')) {
        throw new Error('Anthropic API 요청 한도 초과. 잠시 후 다시 시도해주세요.');
      }
      throw new Error(`Anthropic Refinement failed: ${error.message}`);
    }
    throw new Error('Anthropic Refinement failed: Unknown error');
  }
}

/**
 * Check if Anthropic API key is configured
 */
export function isAnthropicConfigured(): boolean {
  try {
    getApiKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Available Anthropic Claude models (hardcoded fallback)
 */
export const ANTHROPIC_LLM_MODELS = [
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    description: '최신 최고 성능 (권장)',
    recommended: true,
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: '최신 빠른 고성능',
    recommended: false,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: '빠르고 경제적',
    recommended: false,
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: '균형 잡힌 성능',
    recommended: false,
  },
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    description: '고성능 모델',
    recommended: false,
  },
  {
    id: 'claude-opus-4-1-20250805',
    name: 'Claude Opus 4.1',
    description: '고급 추론',
    recommended: false,
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    description: '안정적 성능',
    recommended: false,
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    description: '안정적 고성능',
    recommended: false,
  },
] as const;
