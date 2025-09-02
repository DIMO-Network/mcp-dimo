import { DIMO } from '@dimo-network/data-sdk';
import type { AuthState } from '../shared/types.js';

export interface DeveloperJWTConfig {
  clientId: string;
  domain: string;
  privateKey: string;
}

export interface DeveloperJWT {
  headers?: {
    Authorization?: string;
  };
  [key: string]: any;
}

/**
 * Authenticate with DIMO using developer JWT credentials
 * @param dimo DIMO SDK instance
 * @param config Developer JWT configuration
 * @returns Developer JWT token
 */
export async function getDeveloperJWT(dimo: DIMO, config: DeveloperJWTConfig): Promise<DeveloperJWT> {
  return await dimo.auth.getDeveloperJwt({
    client_id: config.clientId,
    domain: config.domain,
    private_key: config.privateKey
  });
}
/**
 * Get vehicle-specific JWT for API calls
 * @param dimo DIMO SDK instance
 * @param developerJWT Base developer JWT
 * @param tokenId Vehicle token ID
 * @returns Vehicle-specific JWT
 */
export async function getVehicleJWT(dimo: DIMO, developerJWT: DeveloperJWT, tokenId: number): Promise<DeveloperJWT> {
  return await dimo.tokenexchange.getVehicleJwt({
    ...developerJWT,
    tokenId: tokenId
  });
}

/**
 * Ensure vehicle JWT exists with proper validation
 * @param authState The authentication state
 * @param tokenId Vehicle token ID
 * @returns Vehicle-specific JWT
 */
export async function ensureVehicleJwt(authState: AuthState, tokenId: number): Promise<DeveloperJWT> {
  if (!authState.dimo) {
    throw new Error("DIMO not initialized.");
  }
  
  // Use developer JWT for API calls
  if (!authState.developerJwt) {
    throw new Error("Developer JWT not configured. Please provide developer JWT credentials.");
  }

  // Check if user has granted OAuth access (if we have user token)
  if (!authState.userOAuthToken) {
    throw new Error("User not authenticated, please login and share a vehicle with me.");
  }

  // Get new JWT with required privileges using developer credentials
  return await getVehicleJWT(authState.dimo, authState.developerJwt, tokenId);
}
