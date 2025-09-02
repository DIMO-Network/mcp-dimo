import type { AuthState } from './types.js';
import { getEnvConfig } from './config.js';
import { checkVehicleOwnership } from '../helpers/identity-queries.js';
import { ensureVehicleJwt } from '../helpers/developer-jwt.js';

/**
 * Common validation pattern for vehicle operations
 * Returns error response or null if validation passes
 */
export async function validateVehicleOperation(authState: AuthState, tokenId: number) {
  // Check user authentication
  if (!authState.userOAuthToken) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: "You are not logged in, please login.",
        },
      ],
    };
  }

  // Check vehicle ownership with fleet mode support
  const config = getEnvConfig();
  const ownership = await checkVehicleOwnership(authState.userOAuthToken?.address, tokenId);
  if (!config.FLEET_MODE && !ownership.isOwner) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: "You are not the owner of this vehicle, sorry.",
        },
      ],
    };
  }

  return null; // Validation passed
}

/**
 * Get vehicle JWT with proper error handling
 */
export async function getVehicleJwtWithValidation(authState: AuthState, tokenId: number, customErrorMessage?: string) {
  try {
    // Check developer JWT first
    if (!authState.developerJwt) {
      return {
        error: {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Developer JWT not configured. Please set DIMO_DOMAIN and DIMO_PRIVATE_KEY environment variables. Current configuration is missing required credentials for API access.`,
            },
          ],
        }
      };
    }

    const jwt = await ensureVehicleJwt(authState, tokenId);
    if (!jwt.headers || !jwt.headers.Authorization) {
      return {
        error: {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: customErrorMessage || `Request failed due to a missing Authorization header. Ensure the vehicle is shared with the developer license and has the required privileges.`,
            },
          ],
        }
      };
    }
    return { jwt };
  } catch (error) {
    return {
      error: {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `Failed to get vehicle JWT: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      }
    };
  }
}
