import type { AuthState } from './types.js';
import { getVehicleJWT } from '../helpers/developer-jwt.js';
// Note: queryVehicles imported locally to avoid circular dependency"

// Helper function to ensure vehicle JWT exists
export async function ensureVehicleJwt(authState: AuthState, tokenId: number): Promise<any> {
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
