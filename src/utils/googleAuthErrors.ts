const AUTH_ERROR_PATTERNS = [
  'unauthorized',
  'session expired',
  'no active session',
  'invalid jwt',
  'jwt expired',
  '401',
  'token expired',
  'auth_required',
  'authentication required',
];

export function isGoogleAuthError(errorMsg: string): boolean {
  const lower = errorMsg.toLowerCase();
  return AUTH_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function getGoogleErrorMessage(
  errorMsg: string,
  module: 'gmail' | 'calendar' | 'drive' | 'chat' | 'general' = 'general'
): { title: string; description: string } {
  if (isGoogleAuthError(errorMsg)) {
    const moduleLabels: Record<string, string> = {
      gmail: 'Gmail',
      calendar: 'Google Calendar',
      drive: 'Google Drive',
      chat: 'Google Chat',
      general: 'Google',
    };
    const label = moduleLabels[module];
    return {
      title: `${label} connection error`,
      description: 'Please reconnect your Google Workspace account in Settings > My Profile > Connected Accounts.',
    };
  }

  const fallbackLabels: Record<string, string> = {
    gmail: 'Email send failed',
    calendar: 'Calendar sync failed',
    drive: 'Drive operation failed',
    chat: 'Chat message failed',
    general: 'Operation failed',
  };

  return {
    title: fallbackLabels[module],
    description: 'Please check your connection and try again.',
  };
}
