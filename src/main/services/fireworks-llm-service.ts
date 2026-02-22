import OpenAI from 'openai';
import type { RefinementResult } from '../../common/types/ipc';
import { getApiKeyWithFallback } from './api-key-service';
import { stripThinkingTags } from './llm-utils';

let fireworksClient: OpenAI | null = null;

export type FireworksLLMModel = string; // Accept any model ID

export interface FireworksRefinementOptions {
  language?: string;
  formatType?: string;
  refineModel?: FireworksLLMModel;
  classifierModel?: FireworksLLMModel;
  generateSummary?: boolean;
  generateFormal?: boolean;
}

/**
 * Get Fireworks API key from store or environment
 */
function getApiKey(): string {
  const apiKey = getApiKeyWithFallback('fireworks');
  if (!apiKey) {
    throw new Error('Fireworks API key is not set. Please configure it in Settings.');
  }
  return apiKey;
}

/**
 * Initialize or get Fireworks client
 */
export function getFireworksClient(): OpenAI {
  if (!fireworksClient) {
    const apiKey = getApiKey();
    fireworksClient = new OpenAI({
      apiKey,
      baseURL: 'https://api.fireworks.ai/inference/v1'
    });
  }
  return fireworksClient;
}

/**
 * Reset client (useful when API key changes)
 */
export function resetFireworksClient(): void {
  fireworksClient = null;
}

/**
 * Get system prompt for text refinement (minimal correction)
 * 정제: 구조를 크게 바꾸지 않으며, 전사 오류만 간단히 수정
 */
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

/**
 * Get system prompt for formal summary
 * 요약: 내용 유지하되 일목요연하고 포멀하게 정리
 */
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

/**
 * Get system prompt for summarization
 */
function getSummarySystemPrompt(language?: string): string {
  const langInstruction = language === 'ko' || language === 'ko-KR'
    ? '한국어로 응답해주세요.'
    : '';

  return `당신은 텍스트 요약 전문가입니다.
주어진 텍스트의 핵심 내용을 2-3문장으로 간결하게 요약해주세요.
${langInstruction}`;
}

/**
 * Refine text using Fireworks LLM
 */
export async function refineWithFireworks(
  text: string,
  options: FireworksRefinementOptions = {}
): Promise<RefinementResult> {
  try {
    const client = getFireworksClient();

    if (!text || text.trim().length === 0) {
      throw new Error('Text is empty');
    }

    const refineModel = options.refineModel || 'accounts/fireworks/models/gpt-oss-120b';
    const language = options.language;

    console.log('[Fireworks Refinement] Using model:', refineModel);

    // Step 1: Refine the text
    const refinePrompt = getRefineSystemPrompt(options.formatType, language);
    const refinementResponse = await client.chat.completions.create({
      model: refineModel,
      messages: [
        { role: 'system', content: refinePrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const refinedText = stripThinkingTags(refinementResponse.choices[0]?.message?.content || text);

    const result: RefinementResult = {
      text: refinedText,
      modelsUsed: {
        refine: refineModel,
      },
    };

    // Step 2: Generate formal/summary text if requested
    // 항상 생성 (classifier 무시 - 요약은 항상 유용함)
    if (options.generateFormal) {
      console.log('[Fireworks Refinement] Generating formal/summary text...');
      const formalPrompt = getFormalSystemPrompt(language);
      const formalResponse = await client.chat.completions.create({
        model: refineModel,
        messages: [
          { role: 'system', content: formalPrompt },
          { role: 'user', content: refinedText },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });

      result.formalText = stripThinkingTags(formalResponse.choices[0]?.message?.content || '') || undefined;
      console.log('[Fireworks Refinement] formalText generated:', result.formalText?.substring(0, 50));
    }

    // Step 3: Generate summary if requested
    if (options.generateSummary) {
      const summaryPrompt = getSummarySystemPrompt(language);
      const summaryResponse = await client.chat.completions.create({
        model: refineModel,
        messages: [
          { role: 'system', content: summaryPrompt },
          { role: 'user', content: refinedText },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      result.summary = stripThinkingTags(summaryResponse.choices[0]?.message?.content || '') || undefined;
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('401')) {
        throw new Error('Fireworks API 인증 실패. API 키를 확인해주세요.');
      }
      if (error.message.includes('429')) {
        throw new Error('Fireworks API 요청 한도 초과. 잠시 후 다시 시도해주세요.');
      }
      throw new Error(`Fireworks Refinement failed: ${error.message}`);
    }
    throw new Error('Fireworks Refinement failed: Unknown error');
  }
}

/**
 * Check if Fireworks API key is configured
 */
export function isFireworksLLMConfigured(): boolean {
  try {
    getApiKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Available Fireworks LLM models for refinement
 */
export const FIREWORKS_LLM_MODELS = [
  {
    id: 'accounts/fireworks/models/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    description: '128k 컨텍스트, 고성능 (권장)',
    recommended: true,
  },
  {
    id: 'accounts/fireworks/models/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    description: '128k 컨텍스트, 경량 (빠름)',
    recommended: false,
  },
  {
    id: 'accounts/fireworks/models/deepseek-v3p2',
    name: 'DeepSeek V3.2',
    description: '최신 추론 모델',
    recommended: false,
  },
  {
    id: 'accounts/fireworks/models/glm-4p7',
    name: 'GLM-4.7',
    description: '고성능 대규모 모델',
    recommended: false,
  },
  {
    id: 'accounts/fireworks/models/kimi-k2p5',
    name: 'Kimi K2.5',
    description: '멀티모달, 고성능',
    recommended: false,
  },
  {
    id: 'accounts/fireworks/models/qwen2p5-72b-instruct',
    name: 'Qwen 2.5 72B',
    description: '범용 Instruct',
    recommended: false,
  },
  {
    id: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    name: 'Llama 3.3 70B',
    description: '강력한 범용 모델',
    recommended: false,
  },
  {
    id: 'accounts/fireworks/models/qwen3-8b',
    name: 'Qwen3 8B',
    description: '경량 고성능',
    recommended: false,
  },
  {
    id: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    name: 'Llama 3.1 8B',
    description: '경량 (초고속)',
    recommended: false,
  },
] as const;
