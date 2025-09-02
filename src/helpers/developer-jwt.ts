import { DIMO } from '@dimo-network/data-sdk';

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
