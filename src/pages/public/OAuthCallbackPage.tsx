import { useEffect } from 'react';

export function OAuthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const email = params.get('email');
    const error = params.get('error');

    if (status === 'success') {
      window.opener?.postMessage({ type: 'google-oauth-success', email }, '*');
    } else {
      window.opener?.postMessage({ type: 'google-oauth-error', error: error || 'Unknown error' }, '*');
    }

    window.close();
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#94a3b8' }}>
      <p>Connected successfully. This window will close automatically.</p>
    </div>
  );
}
