import { clipboard } from 'electron';

export type PasteFormat = 'DEFAULT' | 'FORMATTED' | 'SCRIPT' | 'AUTO';

export class ClipboardManager {
  copyToClipboard(text: string): void {
    clipboard.writeText(text);
  }

  copyFormattedText(text: string, format: PasteFormat, markdownOutput: boolean): void {
    let content = text;

    if (markdownOutput) {
      content = this.formatAsMarkdown(text);
    }

    clipboard.writeText(content);
  }

  readFromClipboard(): string {
    return clipboard.readText();
  }

  private formatAsMarkdown(text: string): string {
    return text
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        // Convert numbered lists to markdown
        if (/^\d+[.)]\s/.test(trimmed)) {
          return trimmed.replace(/^\d+[.)]\s/, '- ');
        }
        return line;
      })
      .join('\n');
  }
}

export const clipboardManager = new ClipboardManager();
