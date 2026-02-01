/**
 * Export Service
 * Handles different export formats for sessions
 */

// Session type compatible with Prisma return types (nullable fields use null)
interface DatabaseSession {
  id: string;
  userId: string;
  title: string | null;
  description: string | null;
  originalText: string | null;
  refinedText: string | null;
  summary: string | null;
  audioPath: string | null;
  duration: number | null;
  language: string;
  provider: string | null;
  model: string | null;
  formatType: string;
  status: string;
  tags: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: unknown; // Allow additional Prisma fields
}

/**
 * Format a date for display in exports
 */
function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format duration in milliseconds to readable string
 */
function formatDuration(milliseconds?: number | null): string {
  if (!milliseconds) return 'N/A';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/**
 * Export session as plain text format
 */
export function exportAsText(session: DatabaseSession): string {
  const lines: string[] = [];

  // Title
  const title = session.title || 'Untitled Session';
  lines.push(title);
  lines.push('='.repeat(title.length));
  lines.push('');

  // Description
  if (session.description) {
    lines.push(session.description);
    lines.push('');
  }

  // Metadata
  lines.push(`Created: ${formatDate(session.createdAt)}`);
  lines.push(`Updated: ${formatDate(session.updatedAt)}`);
  lines.push(`Duration: ${formatDuration(session.duration)}`);
  lines.push(`Language: ${session.language || 'N/A'}`);
  lines.push(`Status: ${session.status}`);
  lines.push(`Format Type: ${session.formatType}`);

  if (session.provider) {
    lines.push(`Provider: ${session.provider}`);
  }
  if (session.model) {
    lines.push(`Model: ${session.model}`);
  }
  if (session.tags) {
    lines.push(`Tags: ${session.tags}`);
  }

  lines.push('');
  lines.push('-'.repeat(80));
  lines.push('');

  // Original Text
  lines.push('ORIGINAL TEXT');
  lines.push('-'.repeat(80));
  lines.push(session.originalText || 'N/A');
  lines.push('');

  // Refined Text
  if (session.refinedText) {
    lines.push('REFINED TEXT');
    lines.push('-'.repeat(80));
    lines.push(session.refinedText);
    lines.push('');
  }

  // Summary
  if (session.summary) {
    lines.push('SUMMARY');
    lines.push('-'.repeat(80));
    lines.push(session.summary);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Export session as markdown format
 */
export function exportAsMarkdown(session: DatabaseSession): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${session.title || 'Untitled Session'}`);
  lines.push('');

  // Description
  if (session.description) {
    lines.push(`> ${session.description}`);
    lines.push('');
  }

  // Metadata section
  lines.push('## Metadata');
  lines.push('');
  lines.push(`- **Created**: ${formatDate(session.createdAt)}`);
  lines.push(`- **Updated**: ${formatDate(session.updatedAt)}`);
  lines.push(`- **Duration**: ${formatDuration(session.duration)}`);
  lines.push(`- **Language**: ${session.language || 'N/A'}`);
  lines.push(`- **Status**: ${session.status}`);
  lines.push(`- **Format Type**: ${session.formatType}`);

  if (session.provider) {
    lines.push(`- **Provider**: ${session.provider}`);
  }
  if (session.model) {
    lines.push(`- **Model**: ${session.model}`);
  }
  if (session.tags) {
    const tags = session.tags.split(',').map(tag => `\`${tag.trim()}\``).join(', ');
    lines.push(`- **Tags**: ${tags}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // Original Text
  lines.push('## Original Text');
  lines.push('');
  lines.push('```');
  lines.push(session.originalText || 'N/A');
  lines.push('```');
  lines.push('');

  // Refined Text
  if (session.refinedText) {
    lines.push('## Refined Text');
    lines.push('');
    lines.push(session.refinedText);
    lines.push('');
  }

  // Summary
  if (session.summary) {
    lines.push('## Summary');
    lines.push('');
    lines.push(session.summary);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Export session as JSON format
 */
export function exportAsJSON(session: DatabaseSession): string {
  // Create a clean copy without internal database IDs
  const exportData = {
    title: session.title,
    description: session.description,
    originalText: session.originalText,
    refinedText: session.refinedText,
    summary: session.summary,
    audioPath: session.audioPath,
    duration: session.duration,
    language: session.language,
    provider: session.provider,
    model: session.model,
    formatType: session.formatType,
    status: session.status,
    tags: session.tags,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };

  return JSON.stringify(exportData, null, 2);
}
