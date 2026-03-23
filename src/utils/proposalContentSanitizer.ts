export function sanitizeProposalContent(content: string): string {
  if (!content || typeof content !== 'string') return '';

  let text = content.trim();

  if (!looksLikeJson(text)) return text;

  text = stripMarkdownCodeFences(text);

  if (!looksLikeJson(text)) return text;

  const extracted = tryExtractHtmlFromJson(text);
  if (extracted) return extracted;

  return text;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.startsWith('```') ||
    trimmed.startsWith('[{') ||
    trimmed.startsWith('[') ||
    trimmed.startsWith('{"section_type"') ||
    trimmed.startsWith('{"title"')
  );
}

function stripMarkdownCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

function tryExtractHtmlFromJson(text: string): string | null {
  try {
    const parsed = JSON.parse(text);
    const sections = Array.isArray(parsed) ? parsed : parsed?.sections;

    if (Array.isArray(sections) && sections.length > 0) {
      return sections
        .map((s: { title?: string; content?: string }) => {
          const title = s.title ? `<h3>${s.title}</h3>` : '';
          const body = typeof s.content === 'string' ? s.content : '';
          return `${title}${body}`;
        })
        .join('\n');
    }

    if (parsed && typeof parsed === 'object' && typeof parsed.content === 'string') {
      return parsed.content;
    }
  } catch {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const arr = JSON.parse(arrayMatch[0]);
        if (Array.isArray(arr) && arr.length > 0 && arr[0].content) {
          return arr
            .map((s: { title?: string; content?: string }) => {
              const title = s.title ? `<h3>${s.title}</h3>` : '';
              const body = typeof s.content === 'string' ? s.content : '';
              return `${title}${body}`;
            })
            .join('\n');
        }
      } catch {
        // not recoverable
      }
    }
  }

  return null;
}
