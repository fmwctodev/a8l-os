const JSON_EXTRACT_KEYS = [
  'response_to_user',
  'response',
  'summary',
  'message',
  'text',
  'answer',
];

export function extractCleanResponse(raw: string): string {
  if (!raw) return raw;

  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return raw;

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null) return raw;

    for (const key of JSON_EXTRACT_KEYS) {
      if (typeof parsed[key] === 'string' && parsed[key].length > 0) {
        return parsed[key];
      }
    }
  } catch {
    const match = trimmed.match(/"response_to_user"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (match) {
      try {
        return JSON.parse(`"${match[1]}"`);
      } catch {
        return match[1];
      }
    }
  }

  return raw;
}
