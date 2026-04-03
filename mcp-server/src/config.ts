export const config = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  accessToken: process.env.ACCESS_TOKEN || '',
  port: parseInt(process.env.MCP_PORT || '3100', 10),
};

export function validateConfig(): void {
  if (!config.supabaseUrl) {
    throw new Error('SUPABASE_URL is required');
  }
  if (!config.supabaseAnonKey) {
    throw new Error('SUPABASE_ANON_KEY is required');
  }
  if (!config.accessToken) {
    throw new Error('ACCESS_TOKEN is required (user JWT bearer token)');
  }
}
