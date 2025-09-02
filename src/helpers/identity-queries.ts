/**
 * Identity API queries for vehicle access and sharing status
 */

export interface VehicleAccessResult {
  totalVehiclesWithAccess: number;
  vehicles?: any[];
  error?: string;
}

export interface VehicleOwnershipResult {
  tokenId: number;
  owner?: string;
  isOwner: boolean;
  error?: string;
}

/**
 * Query to get all vehicles that have shared data with a specific developer license
 * @param clientId - The developer license client ID
 * @returns Promise with vehicle count and any errors
 */
export async function vehiclesSharedWithAgent(clientId: string): Promise<VehicleAccessResult> {
  try {
    const vehicleCountQuery = `
      query GetVehicleCount($clientId: Address!) {
        vehicles(filterBy: {privileged: $clientId} first: 10) {
          totalCount
        }
      }
    `;
    
    const response = await fetch("https://identity-api.dimo.zone/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: vehicleCountQuery,
        variables: { clientId }
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.error("data", data);
      if (data.data?.vehicles) {
        return {
          totalVehiclesWithAccess: data.data.vehicles.totalCount || 0
        };
      } else {
        return {
          totalVehiclesWithAccess: 0,
          error: "No vehicle data returned"
        };
      }
    } else {
      return {
        totalVehiclesWithAccess: 0,
        error: "Failed to query vehicles"
      };
    }
  } catch (error) {
    return {
      totalVehiclesWithAccess: 0,
      error: "Could not query vehicle access"
    };
  }
}

/**
 * Query to get vehicles owned by a specific user that have shared data with a developer license
 * @param clientId - The developer license client ID
 * @param userAddress - The user's wallet address
 * @returns Promise with vehicle count and any errors
 */
export async function currentUserVehiclesSharedWithAgent(clientId: string, userAddress: string): Promise<VehicleAccessResult> {
  try {
    const vehicleCountQuery = `
      query GetVehicleCount($clientId: Address!, $owner: Address!) {
        vehicles(filterBy: {privileged: $clientId, owner: $owner} first: 100) {
          totalCount
          nodes {
            tokenId
            name
            tokenDID
            owner
            mintedAt
            manufacturer {
              name
              tokenId
            }
            definition {
              make
              model
              year
            }
            imageURI
            aftermarketDevice {
              tokenId
              serial
              manufacturer {
                name
              }
            }
            syntheticDevice {
              tokenId
              name
              connection {
                name
              }
            }
          }
        }
      }
    `;
    
    const response = await fetch("https://identity-api.dimo.zone/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: vehicleCountQuery,
        variables: { 
          clientId, 
          owner: userAddress 
        }
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.data?.vehicles) {
        return {
          totalVehiclesWithAccess: data.data.vehicles.totalCount || 0,
          vehicles: data.data.vehicles.nodes
        };
      } else {
        return {
          totalVehiclesWithAccess: 0,
          error: "No vehicle data returned"
        };
      }
    } else {
      return {
        totalVehiclesWithAccess: 0,
        error: "Failed to query vehicles"
      };
    }
  } catch (error) {
    return {
      totalVehiclesWithAccess: 0,
      error: "Could not query vehicle access"
    };
  }
}

/**
 * Query to check if a specific address owns a vehicle
 * @param address - The address to check ownership for
 * @param tokenId - The vehicle token ID to check
 * @returns Promise with ownership verification result
 */
export async function checkVehicleOwnership(address: string, tokenId: number): Promise<VehicleOwnershipResult> {
  try {
    const ownershipQuery = `
      query CheckVehicleOwnership($tokenId: Int!) {
        vehicle(tokenId: $tokenId) {
          owner
        }
      }
    `;
    
    const response = await fetch("https://identity-api.dimo.zone/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: ownershipQuery,
        variables: { tokenId }
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.data?.vehicle) {
        const owner = data.data.vehicle.owner;
        return {
          tokenId,
          owner,
          isOwner: owner?.toLowerCase() === address.toLowerCase()
        };
      } else {
        return {
          tokenId,
          isOwner: false,
          error: "Vehicle not found or no data returned"
        };
      }
    } else {
      return {
        tokenId,
        isOwner: false,
        error: "Failed to query vehicle ownership"
      };
    }
  } catch (error) {
    return {
      tokenId,
      isOwner: false,
      error: "Could not query vehicle ownership"
    };
  }
}