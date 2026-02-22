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
import type { TranslationRequest, TranslationResult, ProcessingProgress } from '../../common/types/ipc';

const textChunker = new TextChunker();

function sendTranslationProgress(mainWindow: BrowserWindow, progress: ProcessingProgress) {
  mainWindow.webContents.send(IPC_CHANNELS.TRANSLATION.PROGRESS, progress);
}

function getTranslationSystemPrompt(targetLanguage: string): string {
  const languageNames: Record<string, string> = {
    en: 'English',
    ko: '한국어',
    ja: '日本語',
    zh: '中文',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
  };
  const targetName = languageNames[targetLanguage] || targetLanguage;

  return `[시스템 역할] 음성 전사 텍스트 번역기

당신은 AI 어시스턴트가 아닙니다. 당신은 텍스트 번역 도구입니다.
입력으로 들어오는 텍스트는 누군가의 음성을 녹음해서 텍스트로 변환한 결과입니다.

입력된 전사 텍스트를 ${targetName}(으)로 자연스럽게 번역하세요.

규칙:
1. 전사 오류(오타, 잘못 인식된 단어)는 교정하여 번역
2. 말더듬, 간투사(음, 어, 그, 아) 제거
3. 원문의 의미와 뉘앙스를 정확히 전달
4. 번역 외의 설명이나 주석 추가 금지
5. 번역된 텍스트만 출력`;
}

async function translateWithLLM(
  text: string,
  targetLanguage: string,
  model: string,
  llmProvider: LLMProvider
): Promise<string> {
  const systemPrompt = getTranslationSystemPrompt(targetLanguage);
  console.log(`[Translation] API call: provider=${llmProvider}, model=${model}`);

  try {
    if (llmProvider === 'fireworks') {
      const client = getFireworksClient();
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
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
        temperature: 0.3,
        max_tokens: 4000,
      });
      return stripThinkingTags(response.choices[0]?.message?.content || text);
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`[provider=${llmProvider}, model=${model}] ${errMsg}`);
  }
}

export function registerTranslationHandlers(mainWindow: BrowserWindow) {
  ipcMain.handle(IPC_CHANNELS.TRANSLATION.START, async (_event, request: TranslationRequest) => {
    try {
      const { text, targetLanguage, model, llmProvider } = request;

      console.log('[Translation] Starting translation, text length:', text?.length, 'target:', targetLanguage, 'provider:', llmProvider);

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
        console.warn(`[Translation] Model-provider mismatch! provider=fireworks, model=${selectedModel}. Fixing to default.`);
        selectedModel = defaultModels.fireworks;
      }
      if (selectedProvider !== 'fireworks' && selectedModel.startsWith('accounts/fireworks/')) {
        console.warn(`[Translation] Model-provider mismatch! provider=${selectedProvider}, model=${selectedModel}. Fixing to default.`);
        selectedModel = defaultModels[selectedProvider];
      }

      if (textChunker.needsChunking(text)) {
        console.log('[Translation] Long text detected, using chunked translation');
        const result = await handleChunkedTranslation(
          mainWindow, text, targetLanguage, selectedModel, selectedProvider
        );
        mainWindow.webContents.send(IPC_CHANNELS.TRANSLATION.COMPLETE, result);
        return { success: true, data: result };
      }

      // Short text - direct translation
      const retryResult = await withRetry(() =>
        translateWithLLM(text, targetLanguage, selectedModel, selectedProvider)
      );

      if (!retryResult.success || !retryResult.data) {
        throw retryResult.error || new Error('Translation failed after retries');
      }

      const result: TranslationResult = {
        text: retryResult.data,
        targetLanguage,
        modelsUsed: selectedModel,
      };

      mainWindow.webContents.send(IPC_CHANNELS.TRANSLATION.COMPLETE, result);
      return { success: true, data: result };
    } catch (error) {
      console.error('[Translation] Error:', error);
      const rawError = error instanceof Error ? error.message : 'Translation failed';
      const errorMessage = `번역 오류: ${rawError}`;
      console.error('[Translation] Full error detail:', { rawError, requestModel: request.model, requestProvider: request.llmProvider });
      mainWindow.webContents.send(IPC_CHANNELS.TRANSLATION.ERROR, { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });
}

async function handleChunkedTranslation(
  mainWindow: BrowserWindow,
  text: string,
  targetLanguage: string,
  model: string,
  llmProvider: LLMProvider
): Promise<TranslationResult> {
  const chunks = textChunker.chunkText(text);
  const totalChunks = chunks.length;

  console.log(`[Translation] Split into ${totalChunks} text chunks`);

  const translatedChunks: string[] = [];
  let chunkErrors = 0;
  const startTime = Date.now();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const elapsed = Date.now() - startTime;
    const avgTime = i > 0 ? elapsed / i : 0;
    const estimatedRemaining = avgTime * (totalChunks - i);

    sendTranslationProgress(mainWindow, {
      stage: 'refining',
      stageLabel: `번역 중... (${i + 1}/${totalChunks})`,
      currentChunk: i + 1,
      totalChunks,
      overallProgress: Math.round((i / totalChunks) * 90 + 5),
      estimatedRemainingMs: Math.round(estimatedRemaining),
      chunkResults: translatedChunks.length,
      chunkErrors,
    });

    const retryResult = await withRetry(() =>
      translateWithLLM(chunk.text, targetLanguage, model, llmProvider)
    );

    if (retryResult.success && retryResult.data) {
      translatedChunks.push(retryResult.data);
    } else {
      chunkErrors++;
      console.error(`[Translation] Chunk ${i + 1} failed:`, retryResult.error?.message);
      translatedChunks.push(chunk.text);
    }
  }

  const mergedText = textChunker.mergeChunks(translatedChunks);

  sendTranslationProgress(mainWindow, {
    stage: 'refining',
    stageLabel: '번역 완료',
    currentChunk: totalChunks,
    totalChunks,
    overallProgress: 100,
    chunkResults: translatedChunks.length,
    chunkErrors,
  });

  return {
    text: mergedText,
    targetLanguage,
    modelsUsed: model,
  };
}
