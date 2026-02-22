import OpenAI from 'openai';
import type { RefinementResult } from '../../common/types/ipc';
import { getApiKeyWithFallback } from './api-key-service';
import { stripThinkingTags } from './llm-utils';
import { openaiGenerate } from './openai-api';

let openaiClient: OpenAI | null = null;

export interface OpenAIRefinementOptions {
  language?: string;
  formatType?: string;
  refineModel?: string;
  classifierModel?: string;
  generateSummary?: boolean;
  generateFormal?: boolean;
}

/**
 * Get OpenAI API key from store or environment
 */
function getApiKey(): string {
  const apiKey = getApiKeyWithFallback('openai');
  if (!apiKey) {
    throw new Error('OpenAI API key is not set. Please configure it in Settings.');
  }
  return apiKey;
}

/**
 * Initialize or get OpenAI client
 */
export function getOpenAILLMClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = getApiKey();
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Reset client (useful when API key changes)
 */
export function resetOpenAILLMClient(): void {
  openaiClient = null;
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
 * Refine text using OpenAI LLM
 */
export async function refineWithOpenAI(
  text: string,
  options: OpenAIRefinementOptions = {}
): Promise<RefinementResult> {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is empty');
    }

    const refineModel = options.refineModel || 'gpt-4o-mini';
    const language = options.language;

    console.log('[OpenAI Refinement] Using model:', refineModel);

    // Step 1: Refine the text
    const refinePrompt = getRefineSystemPrompt(options.formatType, language);
    const refinementResponse = await openaiGenerate({
      model: refineModel,
      system: refinePrompt,
      input: text,
      max_new_tokens: 4000,
    });

    const refinedText = refinementResponse.text || text;
    console.log(`[OpenAI Refinement] Step 1 used ${refinementResponse.api_used} API`);

    const result: RefinementResult = {
      text: refinedText,
      modelsUsed: {
        refine: refineModel,
      },
    };

    // Step 2: Generate formal/summary text if requested
    if (options.generateFormal) {
      console.log('[OpenAI Refinement] Generating formal/summary text...');
      const formalPrompt = getFormalSystemPrompt(language);
      const formalResponse = await openaiGenerate({
        model: refineModel,
        system: formalPrompt,
        input: refinedText,
        temperature: 0.7,
        max_new_tokens: 4000,
      });

      result.formalText = formalResponse.text || undefined;
      console.log('[OpenAI Refinement] formalText generated:', result.formalText?.substring(0, 50));
    }

    // Step 3: Generate summary if requested
    if (options.generateSummary) {
      const summaryPrompt = getSummarySystemPrompt(language);
      const summaryResponse = await openaiGenerate({
        model: refineModel,
        system: summaryPrompt,
        input: refinedText,
        temperature: 0.7,
        max_new_tokens: 500,
      });

      result.summary = summaryResponse.text || undefined;
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        throw new Error('OpenAI API 인증 실패. API 키를 확인해주세요.');
      }
      if (error.message.includes('429')) {
        throw new Error('OpenAI API 요청 한도 초과. 잠시 후 다시 시도해주세요.');
      }
      throw new Error(`OpenAI Refinement failed: ${error.message}`);
    }
    throw new Error('OpenAI Refinement failed: Unknown error');
  }
}

/**
 * Check if OpenAI API key is configured
 */
export function isOpenAILLMConfigured(): boolean {
  try {
    getApiKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Available OpenAI LLM models (hardcoded fallback)
 */
export const OPENAI_LLM_MODELS = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: '멀티모달 모델 (권장)',
    recommended: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: '경량, 빠른 응답',
    recommended: false,
  },
  {
    id: 'gpt-5',
    name: 'GPT-5',
    description: '최신 플래그십 모델',
    recommended: false,
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    description: '최신 경량 고성능',
    recommended: false,
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    description: '최신 초경량',
    recommended: false,
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    description: '코딩/지시 특화',
    recommended: false,
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    description: '경량 고성능',
    recommended: false,
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    description: '초경량, 최저 비용',
    recommended: false,
  },
  {
    id: 'o3',
    name: 'o3',
    description: '추론 모델',
    recommended: false,
  },
  {
    id: 'o3-mini',
    name: 'o3 Mini',
    description: '경량 추론 모델',
    recommended: false,
  },
  {
    id: 'o4-mini',
    name: 'o4 Mini',
    description: '최신 경량 추론',
    recommended: false,
  },
] as const;
