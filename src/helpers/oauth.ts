import { z } from 'zod';

// Vehicle data sharing URL configuration schema
export const VehicleDataSharingConfigSchema = z.object({
  clientId: z.string(),
  domain: z.string(),
  permissionTemplateId: z.number().optional().default(1),
  entryState: z.string().default('LOGIN'),
  loginBaseUrl: z.string().default('https://login.dimo.org')
});

export type VehicleDataSharingConfig = z.infer<typeof VehicleDataSharingConfigSchema>;

// OAuth token response schema
export const OAuthTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional()
});

export type OAuthToken = z.infer<typeof OAuthTokenSchema>;

// Stored token with expiration
export interface StoredOAuthToken extends OAuthToken {
  address: string; // Ethereum wallet address from DIMO
  email?: string; // User email from DIMO
  expires_at?: number; // Unix timestamp in ms
  created_at: number; // Unix timestamp in ms
}

/**
 * Generate OAuth authorization URL
 * @param config OAuth configuration
 * @returns Authorization URL for popup
 */
export function generateLoginUrl(config: VehicleDataSharingConfig): string {
  const params = new URLSearchParams({
    clientId: config.clientId,
    redirectUri: config.domain,
    entryState: "LOGIN"
  });
  
  return `${config.loginBaseUrl}/?${params.toString()}`;
}

/**
 * Generate vehicle data sharing URL
 * @param config Vehicle data sharing configuration
 * @returns Vehicle data sharing URL
 */
export function generateVehicleDataSharingUrl(config: VehicleDataSharingConfig, templateId?: string): string {
  const params = new URLSearchParams({
    clientId: config.clientId,
    redirectUri: config.domain,
    permissionTemplateId: templateId? templateId : config.permissionTemplateId.toString(),
    entryState: "VEHICLE_MANAGER"
  });
  
  return `${config.loginBaseUrl}/?${params.toString()}`;
}

/**
 * Parse OAuth callback URL for DIMO direct token response
 * @param callbackUrl The full callback URL with query parameters
 * @returns Object containing token, wallet address, email, or error information
 */
export function parseOAuthCallback(callbackUrl: string): {
  token?: string;
  walletAddress?: string;
  email?: string;
  error?: string;
  error_description?: string;
} {
  try {
    const url = new URL(callbackUrl);
    const params = url.searchParams;
    
    return {
      token: params.get('token') || undefined,
      walletAddress: params.get('walletAddress') || undefined,
      email: decodeURIComponent(params.get('email') || '') || undefined,
      error: params.get('error') || undefined,
      error_description: params.get('error_description') || undefined
    };
  } catch (error) {
    return {
      error: 'invalid_url',
      error_description: `Failed to parse callback URL: ${error}`
    };
  }
}

/**
 * Create StoredOAuthToken from DIMO direct token response
 * @param token JWT token from DIMO
 * @param walletAddress Ethereum wallet address
 * @param email User email
 * @returns StoredOAuthToken
 */
export function createDimoToken(token: string, walletAddress?: string, email?: string): StoredOAuthToken {
  const now = Date.now();
  
  // Decode JWT to get expiration if available
  let expires_at: number | undefined;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp) {
      expires_at = payload.exp * 1000; // Convert to milliseconds
    }
  } catch (error) {
    // If JWT parsing fails, set expiration to 1 hour from now as default
    expires_at = now + (60 * 60 * 1000);
  }
  
  return {
    access_token: token,
    token_type: 'Bearer',
    address: walletAddress,
    email: email,
    created_at: now,
    expires_at
  };
}

// OAuth server result interfaces
export interface OAuthServerResult {
  [x: string]: unknown;
  isError?: boolean;
  content: Array<{
    [x: string]: unknown;
    type: "text";
    text: string;
  }>;
}

export interface OAuthServerSuccessCallback {
  (token: StoredOAuthToken): void;
}

/**
 * Initialize OAuth flow with a temporary local HTTP server to automatically handle the callback
 * @param port Port number for the local server
 * @param config OAuth configuration
 * @param onTokenReceived Callback function when token is successfully received
 * @returns Promise that resolves with server status or authentication result
 */
export async function initOAuthServer(
  port: number,
  config: any,
  onTokenReceived: OAuthServerSuccessCallback
): Promise<OAuthServerResult> {
  try {
    const http = await import('http');
    const parsedConfig = VehicleDataSharingConfigSchema.parse(config);
    const oauthUrl = generateLoginUrl(parsedConfig);
    
    return new Promise((resolve) => {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url || '', `http://localhost:${port}`);
        
        if (url.pathname === '/') {
          // Handle OAuth callback
          const callbackUrl = `http://localhost:${port}${req.url}`;
          const callbackData = parseOAuthCallback(callbackUrl);
          
          if (callbackData.error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body>
                  <h1>OAuth Error</h1>
                  <p>Error: ${callbackData.error}</p>
                  ${callbackData.error_description ? `<p>Description: ${callbackData.error_description}</p>` : ''}
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            server.close();
            
            resolve({
              isError: true,
              content: [{
                type: "text",
                text: `OAuth authentication failed: ${callbackData.error}${callbackData.error_description ? ' - ' + callbackData.error_description : ''}`
              }]
            });
            return;
          }
          
          // Check for DIMO direct token response
          if (callbackData.token) {
            // DIMO direct token flow
            const token = createDimoToken(
              callbackData.token, 
              callbackData.walletAddress, 
              callbackData.email
            );
            
            // Call the callback function to store the token
            onTokenReceived(token);
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body>
                  <h1>Authentication Successful!</h1>
                  <p>You have successfully authenticated with DIMO.</p>
                  <p>Wallet Address: ${callbackData.walletAddress || 'N/A'}</p>
                  <p>Email: ${callbackData.email || 'N/A'}</p>
                  <p>You can now close this window and return to your AI assistant.</p>
                  <script>
                    setTimeout(() => window.close(), 3000);
                  </script>
                </body>
              </html>
            `);
            server.close();
            
            console.error(JSON.stringify({
              level: "info",
              event: "user_oauth_success",
              message: "User OAuth authorization completed successfully via local server with DIMO token",
              walletAddress: callbackData.walletAddress,
              email: callbackData.email
            }));
            
            resolve({
              content: [{
                type: "text",
                text: JSON.stringify({
                  status: "authorized",
                  message: "User authorization completed successfully via local server",
                  token_type: token.token_type,
                  walletAddress: callbackData.walletAddress,
                  email: callbackData.email,
                  expires_at: token.expires_at ? new Date(token.expires_at).toISOString() : undefined
                }, null, 2)
              }]
            });
            return;
          }
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });
      
      server.listen(port, () => {
        resolve({
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "server_started",
              message: `Local OAuth server started on port ${port}. Please open the following URL in your browser to authenticate:`,
              oauth_url: oauthUrl,
              local_server: `http://localhost:${port}`,
              instructions: "The authentication will be handled automatically once you complete the OAuth flow in your browser."
            }, null, 2)
          }]
        });
      });
      
      // Set timeout to close server if no response
      setTimeout(() => {
        if (server.listening) {
          server.close();
          
          resolve({
            isError: true,
            content: [{
              type: "text",
              text: "OAuth timeout: Local server closed after 5 minutes of inactivity"
            }]
          });
        }
      }, 5 * 60 * 1000); // 5 minute timeout
    });
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: "text",
        text: `Failed to start local OAuth server: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}