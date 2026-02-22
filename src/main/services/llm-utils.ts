/**
 * Strip reasoning/thinking tags from LLM output.
 * Models like DeepSeek R1 wrap chain-of-thought in <think>...</think> tags.
 * This removes those blocks and returns only the final answer.
 */
export function stripThinkingTags(text: string): string {
  // Remove <think>...</think> blocks (including multiline)
  let result = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // Also handle unclosed <think> tag (model started thinking but output was cut)
  result = result.replace(/<think>[\s\S]*/gi, '');
  return result.trim();
}
