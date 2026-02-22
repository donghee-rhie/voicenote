import type { LLMProvider, LLMModelInfo } from '../../common/types/ipc';
import { getApiKeyWithFallback } from './api-key-service';
import { GROQ_LLM_MODELS } from './groq-refinement-service';
import { FIREWORKS_LLM_MODELS } from './fireworks-llm-service';
import { OPENAI_LLM_MODELS } from './openai-llm-service';
import { ANTHROPIC_LLM_MODELS } from './anthropic-llm-service';

interface CacheEntry {
  models: LLMModelInfo[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const modelCache = new Map<LLMProvider, CacheEntry>();

/**
 * Get hardcoded fallback models for a provider
 */
function getFallbackModels(provider: LLMProvider): LLMModelInfo[] {
  switch (provider) {
    case 'groq':
      return GROQ_LLM_MODELS.map(m => ({ ...m }));
    case 'fireworks':
      return FIREWORKS_LLM_MODELS.map(m => ({ ...m }));
    case 'openai':
      return OPENAI_LLM_MODELS.map(m => ({ ...m }));
    case 'anthropic':
      return ANTHROPIC_LLM_MODELS.map(m => ({ ...m }));
    default:
      return [];
  }
}

/**
 * Fetch models from Groq API
 */
async function fetchGroqModels(): Promise<LLMModelInfo[]> {
  const Groq = (await import('groq-sdk')).default;
  const apiKey = getApiKeyWithFallback('groq');
  if (!apiKey) throw new Error('Groq API key not configured');

  const client = new Groq({ apiKey });
  const response = await client.models.list();
  const models = response.data || [];

  // Filter for chat/completion models
  return models
    .filter((m: any) => m.id && !m.id.includes('whisper') && !m.id.includes('guard'))
    .map((m: any) => ({
      id: m.id,
      name: m.id,
      description: `Groq - ${m.owned_by || 'unknown'}`,
      recommended: m.id === 'openai/gpt-oss-120b',
    }));
}

/**
 * Fetch models from OpenAI API
 */
async function fetchOpenAIModels(): Promise<LLMModelInfo[]> {
  const OpenAI = (await import('openai')).default;
  const apiKey = getApiKeyWithFallback('openai');
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const client = new OpenAI({ apiKey });
  const response = await client.models.list();
  const models: any[] = [];
  for await (const model of response) {
    models.push(model);
  }

  // Filter for GPT and o-series models
  return models
    .filter((m: any) => {
      const id = m.id.toLowerCase();
      return (id.startsWith('gpt-') || /^o[1-9]/.test(id)) &&
        !id.includes('instruct') && !id.includes('realtime') && !id.includes('audio');
    })
    .map((m: any) => ({
      id: m.id,
      name: m.id,
      description: `OpenAI - ${m.owned_by || 'openai'}`,
      recommended: m.id === 'gpt-4o',
    }))
    .sort((a: LLMModelInfo, b: LLMModelInfo) => {
      // Put recommended first, then sort alphabetically
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      return a.id.localeCompare(b.id);
    });
}

/**
 * Fetch models for a given provider.
 * Uses cache with 5-minute TTL. Falls back to hardcoded list on failure.
 */
export async function fetchModels(provider: LLMProvider): Promise<{ models: LLMModelInfo[]; fromCache: boolean }> {
  // Check cache
  const cached = modelCache.get(provider);
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
    return { models: cached.models, fromCache: true };
  }

  try {
    let models: LLMModelInfo[];

    switch (provider) {
      case 'groq':
        models = await fetchGroqModels();
        break;
      case 'openai':
        models = await fetchOpenAIModels();
        break;
      case 'fireworks':
        // Fireworks has no public models endpoint
        models = getFallbackModels('fireworks');
        break;
      case 'anthropic':
        // Anthropic models API is beta, use hardcoded
        models = getFallbackModels('anthropic');
        break;
      default:
        models = [];
    }

    // Only cache if we got results
    if (models.length > 0) {
      modelCache.set(provider, { models, fetchedAt: Date.now() });
    }

    return { models, fromCache: false };
  } catch (error) {
    console.error(`[ModelFetching] Failed to fetch models for ${provider}:`, error);
    // Return fallback on error
    const fallback = getFallbackModels(provider);
    return { models: fallback, fromCache: false };
  }
}

/**
 * Clear model cache for a specific provider or all providers
 */
export function clearModelCache(provider?: LLMProvider): void {
  if (provider) {
    modelCache.delete(provider);
  } else {
    modelCache.clear();
  }
}
