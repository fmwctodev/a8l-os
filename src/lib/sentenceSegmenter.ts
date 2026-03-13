type SentenceCallback = (sentence: string) => void;

const SENTENCE_ENDINGS = /[.!?]\s*$/;
const CLAUSE_BREAK = /[;,]\s*$/;
const MAX_BUFFER_WORDS = 40;

export class SentenceSegmenter {
  private buffer = '';
  private callback: SentenceCallback;

  constructor(callback: SentenceCallback) {
    this.callback = callback;
  }

  push(token: string): void {
    this.buffer += token;

    while (true) {
      const idx = this.findBreakpoint();
      if (idx === -1) break;

      const sentence = this.buffer.slice(0, idx + 1).trim();
      this.buffer = this.buffer.slice(idx + 1);

      if (sentence.length > 0) {
        this.callback(sentence);
      }
    }

    const wordCount = this.buffer.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount >= MAX_BUFFER_WORDS && CLAUSE_BREAK.test(this.buffer)) {
      const sentence = this.buffer.trim();
      this.buffer = '';
      if (sentence.length > 0) {
        this.callback(sentence);
      }
    }
  }

  flush(): void {
    const remaining = this.buffer.trim();
    this.buffer = '';
    if (remaining.length > 0) {
      this.callback(remaining);
    }
  }

  private findBreakpoint(): number {
    for (let i = 0; i < this.buffer.length; i++) {
      const ch = this.buffer[i];
      if (ch === '.' || ch === '!' || ch === '?') {
        if (ch === '.' && i > 0) {
          const before = this.buffer.slice(Math.max(0, i - 3), i);
          if (/^(Mr|Ms|Dr|vs|St|Jr|Sr|No|etc)$/i.test(before.trim())) continue;
          if (/\d$/.test(before) && i + 1 < this.buffer.length && /\d/.test(this.buffer[i + 1])) continue;
        }

        const next = this.buffer[i + 1];
        if (!next || next === ' ' || next === '\n' || next === '\r') {
          return i;
        }
      }
    }
    return -1;
  }
}
