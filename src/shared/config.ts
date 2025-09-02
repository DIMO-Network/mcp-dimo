// Helper function to get environment variables
export function getEnvConfig() {
  const env = process.env;
  
  // Check for required environment variables
  if (!env.DIMO_CLIENT_ID) {
    throw new Error('DIMO_CLIENT_ID environment variable is required');
  }
  
  return {
    clientId: env.DIMO_CLIENT_ID,
    loginBaseUrl: env.DIMO_LOGIN_BASE_URL || 'https://login.dimo.org',
    entryState: env.DIMO_ENTRY_STATE || 'LOGIN',
    domain: env.DIMO_DOMAIN,
    privateKey: env.DIMO_PRIVATE_KEY,
    FLEET_MODE: env.FLEET_MODE === 'true'
  };
}