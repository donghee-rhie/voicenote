import { ipcMain, BrowserWindow } from 'electron';
import { getGroqClient } from '../services/groq-refinement-service';
import { getFireworksClient } from '../services/fireworks-llm-service';
import { getAnthropicClient } from '../services/anthropic-llm-service';
import { stripThinkingTags } from '../services/llm-utils';
import { openaiGenerate } from '../services/openai-api';
import type { LLMProvider } from '../../common/types/ipc';
import { TextChunker } from '../services/text-chunker';
import { withRetry } from '../services/retry-handler';
import { IPC_CHANNELS } from '../../common/types/ipc';
import type { MinutesRequest, MinutesResult, ProcessingProgress } from '../../common/types/ipc';

const textChunker = new TextChunker();

function sendMinutesProgress(mainWindow: BrowserWindow, progress: ProcessingProgress) {
  mainWindow.webContents.send(IPC_CHANNELS.MINUTES.PROGRESS, progress);
}

function getMinutesSystemPrompt(language?: string): string {
  const langInstruction = language === 'ko' || language === 'ko-KR'
    ? '한국어로 작성해주세요.'
    : language === 'en' ? 'Write in English.'
    : '';

  return `[시스템 역할] 음성 전사 텍스트 구조화 도구

당신은 AI 어시스턴트가 아닙니다. 당신은 텍스트 구조화 도구입니다.
입력으로 들어오는 텍스트는 누군가의 음성을 녹음해서 텍스트로 변환한 결과입니다.

[해야 할 일]
입력된 전사 텍스트의 내용을 파악하고, 내용의 성격에 맞게 구조화하여 정리하세요.

내용 유형별 정리 방식:
- 나열/목록 (예: 살 물건, 준비물 등) → 맥락 설명 후 번호 매긴 리스트
- 순서/절차 (예: 요리법, 작업 순서 등) → 맥락 설명 후 단계별 정리 (1단계, 2단계...)
- 핵심 포인트가 있는 설명 → 맥락 설명 후 요점별 정리
- 회의/논의 내용 → 안건, 결정사항, 할 일로 구분
- 일반적 내용 → 문단 나누어 가독성 있게 정리

규칙:
1. 전사 오류(오타, 잘못 인식된 단어) 교정
2. 말더듬, 간투사(음, 어, 그, 아) 제거
3. 원문의 핵심 내용을 빠짐없이 포함
4. 내용의 성격에 맞는 구조를 자동으로 판단하여 적용
5. 반드시 내용의 맥락/배경을 먼저 설명한 뒤 리스트나 항목을 나열할 것
   예시 (O): "마트에서 구매할 물건: 1. 우유 한 팩 2. 달걀 한 판"
   예시 (X): "1. 우유 2. 달걀" (맥락 없이 항목만 나열 금지)
6. AI가 추가한 의견이나 평가는 금지 — 원문에 있는 내용만 정리

${langInstruction}`;
}

function getMinutesChunkPrompt(language?: string): string {
  const langInstruction = language === 'ko' || language === 'ko-KR'
    ? '한국어로 작성해주세요.'
    : '';

  return `[시스템 역할] 텍스트 구조화 요약기

입력된 전사 텍스트의 일부분을 구조화하여 정리하세요.
- 내용의 성격(목록, 절차, 논의 등)을 파악하여 적절한 형태로 정리
- 전사 오류 교정, 간투사 제거
- 원문의 핵심 내용 보존
- 항목을 나열할 때는 반드시 맥락/배경 설명을 먼저 작성한 뒤 리스트를 나열할 것
- AI의 의견이나 평가는 금지 — 원문 내용만 정리

${langInstruction}`;
}

function getMergeMinutesPrompt(language?: string): string {
  const langInstruction = language === 'ko' || language === 'ko-KR'
    ? '한국어로 작성해주세요.'
    : '';

  return `[시스템 역할] 구조화 텍스트 통합기

여러 부분으로 나뉜 정리 결과를 하나의 구조화된 문서로 통합하세요.

규칙:
1. 내용의 성격에 맞는 구조 유지 (리스트, 단계, 요점 등)
2. 중복 제거하고 논리적으로 통합
3. 원문의 핵심 내용 빠짐없이 포함
4. 각 섹션이나 리스트 앞에 맥락 설명을 유지할 것 (항목만 나열 금지)
5. AI의 의견이나 평가는 금지 — 원문 내용만 통합

${langInstruction}`;
}

async function generateMinutesWithLLM(
  text: string,
  systemPrompt: string,
  model: string,
  llmProvider: LLMProvider
): Promise<string> {
  console.log(`[Minutes] API call: provider=${llmProvider}, model=${model}`);
  try {
    if (llmProvider === 'fireworks') {
      const client = getFireworksClient();
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.5,
        max_tokens: 4000,
      });
      return stripThinkingTags(response.choices[0]?.message?.content || text);
    } else if (llmProvider === 'openai') {
      const response = await openaiGenerate({
        model,
        system: systemPrompt,
        input: text,
        max_new_tokens: 4000,
      });
      return response.text || text;
    } else if (llmProvider === 'anthropic') {
      const client = getAnthropicClient();
      const response = await client.messages.create({
        model,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: text },
        ],
      });
      const resultText = response.content[0]?.type === 'text' ? response.content[0].text : text;
      return stripThinkingTags(resultText);
    } else {
      const client = getGroqClient();
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.5,
        max_tokens: 4000,
      });
      return stripThinkingTags(response.choices[0]?.message?.content || text);
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`[provider=${llmProvider}, model=${model}] ${errMsg}`);
  }
}

export function registerMinutesHandlers(mainWindow: BrowserWindow) {
  ipcMain.handle(IPC_CHANNELS.MINUTES.START, async (_event, request: MinutesRequest) => {
    try {
      const { text, language, model, llmProvider } = request;

      console.log('[Minutes] Starting structured notes generation, text length:', text?.length, 'provider:', llmProvider);

      if (!text || text.trim().length === 0) {
        return { success: false, error: 'Text is required' };
      }

      const selectedProvider: LLMProvider = llmProvider || 'groq';
      const defaultModels: Record<LLMProvider, string> = {
        groq: 'openai/gpt-oss-120b',
        fireworks: 'accounts/fireworks/models/gpt-oss-120b',
        openai: 'gpt-4o',
        anthropic: 'claude-sonnet-4-6',
      };
      let selectedModel = model || defaultModels[selectedProvider];

      // Safety: validate model matches provider
      if (selectedProvider === 'fireworks' && !selectedModel.startsWith('accounts/fireworks/')) {
        console.warn(`[Minutes] Model-provider mismatch! provider=fireworks, model=${selectedModel}. Fixing to default.`);
        selectedModel = defaultModels.fireworks;
      }
      if (selectedProvider !== 'fireworks' && selectedModel.startsWith('accounts/fireworks/')) {
        console.warn(`[Minutes] Model-provider mismatch! provider=${selectedProvider}, model=${selectedModel}. Fixing to default.`);
        selectedModel = defaultModels[selectedProvider];
      }

      console.log('[Minutes] Using provider:', selectedProvider, 'model:', selectedModel);

      if (textChunker.needsChunking(text)) {
        console.log('[Minutes] Long text detected, using chunked structured notes generation');
        const result = await handleChunkedMinutes(
          mainWindow, text, language, selectedModel, selectedProvider
        );
        mainWindow.webContents.send(IPC_CHANNELS.MINUTES.COMPLETE, result);
        return { success: true, data: result };
      }

      // Short text - direct minutes generation
      sendMinutesProgress(mainWindow, {
        stage: 'refining',
        stageLabel: '내용 구조화 중...',
        currentChunk: 1,
        totalChunks: 1,
        overallProgress: 30,
      });

      const systemPrompt = getMinutesSystemPrompt(language);
      const retryResult = await withRetry(() =>
        generateMinutesWithLLM(text, systemPrompt, selectedModel, selectedProvider)
      );

      if (!retryResult.success || !retryResult.data) {
        throw retryResult.error || new Error('Structured notes generation failed after retries');
      }

      sendMinutesProgress(mainWindow, {
        stage: 'refining',
        stageLabel: '구조화 정리 완료',
        currentChunk: 1,
        totalChunks: 1,
        overallProgress: 100,
      });

      const result: MinutesResult = {
        text: retryResult.data,
        modelsUsed: selectedModel,
      };

      mainWindow.webContents.send(IPC_CHANNELS.MINUTES.COMPLETE, result);
      return { success: true, data: result };
    } catch (error) {
      console.error('[Minutes] Generation error:', error);
      const rawError = error instanceof Error ? error.message : 'Structured notes generation failed';
      const errorMessage = `구조화 정리 오류: ${rawError}`;
      console.error('[Minutes] Full error detail:', { rawError, requestModel: request.model, requestProvider: request.llmProvider });
      mainWindow.webContents.send(IPC_CHANNELS.MINUTES.ERROR, { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });
}

async function handleChunkedMinutes(
  mainWindow: BrowserWindow,
  text: string,
  language: string | undefined,
  model: string,
  llmProvider: LLMProvider
): Promise<MinutesResult> {
  const chunks = textChunker.chunkText(text);
  const totalChunks = chunks.length;

  console.log(`[Minutes] Split into ${totalChunks} text chunks`);

  const summarizedChunks: string[] = [];
  let chunkErrors = 0;
  const startTime = Date.now();
  const chunkPrompt = getMinutesChunkPrompt(language);

  // Phase 1: Summarize each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const elapsed = Date.now() - startTime;
    const avgTime = i > 0 ? elapsed / i : 0;
    const estimatedRemaining = avgTime * (totalChunks - i + 1);

    sendMinutesProgress(mainWindow, {
      stage: 'refining',
      stageLabel: `내용 분석 중... (${i + 1}/${totalChunks})`,
      currentChunk: i + 1,
      totalChunks: totalChunks + 1, // +1 for merge step
      overallProgress: Math.round((i / (totalChunks + 1)) * 90 + 5),
      estimatedRemainingMs: Math.round(estimatedRemaining),
      chunkResults: summarizedChunks.length,
      chunkErrors,
    });

    const retryResult = await withRetry(() =>
      generateMinutesWithLLM(chunk.text, chunkPrompt, model, llmProvider)
    );

    if (retryResult.success && retryResult.data) {
      summarizedChunks.push(retryResult.data);
    } else {
      chunkErrors++;
      console.error(`[Minutes] Chunk ${i + 1} failed:`, retryResult.error?.message);
      summarizedChunks.push(chunk.text);
    }
  }

  // Phase 2: Merge summarized chunks into final minutes
  sendMinutesProgress(mainWindow, {
    stage: 'summarizing',
    stageLabel: '내용 통합 정리 중...',
    currentChunk: totalChunks + 1,
    totalChunks: totalChunks + 1,
    overallProgress: 92,
    chunkResults: summarizedChunks.length,
    chunkErrors,
  });

  const mergedInput = summarizedChunks.map((s, i) => `--- Part ${i + 1} ---\n${s}`).join('\n\n');
  const mergePrompt = getMergeMinutesPrompt(language);

  const mergeResult = await withRetry(() =>
    generateMinutesWithLLM(mergedInput, mergePrompt, model, llmProvider)
  );

  const finalText = mergeResult.success && mergeResult.data
    ? mergeResult.data
    : mergedInput;

  sendMinutesProgress(mainWindow, {
    stage: 'summarizing',
    stageLabel: '구조화 정리 완료',
    currentChunk: totalChunks + 1,
    totalChunks: totalChunks + 1,
    overallProgress: 100,
    chunkResults: summarizedChunks.length,
    chunkErrors,
  });

  return {
    text: finalText,
    modelsUsed: model,
  };
}
