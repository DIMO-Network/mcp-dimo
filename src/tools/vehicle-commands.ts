import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import type { AuthState } from '../shared/types.js';
import { DEVICES_API_URL } from '../shared/types.js';
import { validateVehicleOperation, getVehicleJwtWithValidation } from '../shared/command-helpers.js';

// Schemas
const VehicleCommandSchema = z.object({
  tokenId: z.number(),
});

// Helper function for vehicle command execution
async function executeVehicleCommand(
  authState: AuthState, 
  tokenId: number, 
  endpoint: string, 
  body: any = {}
) {
  try {
    // Validate vehicle operation (auth + ownership)
    const validationError = await validateVehicleOperation(authState, tokenId);
    if (validationError) {
      return validationError;
    }

    // Get vehicle JWT
    const jwtResult = await getVehicleJwtWithValidation(authState, tokenId, "Request failed due to a missing Authorization header.");
    if (jwtResult.error) {
      return jwtResult.error;
    }

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `${jwtResult.jwt.headers?.Authorization}`,
    };

    const response = await fetch(`${DEVICES_API_URL}/v1/vehicle/${tokenId}/commands/${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseText = await response.text();
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `Request failed: ${response.statusText}\n${responseText}`,
          },
        ],
      };
    }

    const data = await response.json();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (error) {
    throw new Error(`Failed to execute command: ${error}`);
  }
}

export function registerVehicleCommandTools(server: McpServer, authState: AuthState) {

  // Lock doors command
  server.tool(
    "lock_doors",
    "Lock the doors of a vehicle. **Prerequisites:** Vehicle must be shared with this developer license and user must be authenticated. Call check_vehicle_access_status first to see available vehicles.",
    VehicleCommandSchema.shape,
    async (args: z.infer<typeof VehicleCommandSchema>) => {
      return executeVehicleCommand(authState, args.tokenId, "doors/lock");
    }
  );

  // Unlock doors command
  server.tool(
    "unlock_doors",
    "Unlock the doors of a vehicle. **Prerequisites:** Vehicle must be shared with this developer license and user must be authenticated. Call check_vehicle_access_status first to see available vehicles.",
    VehicleCommandSchema.shape,
    async (args: z.infer<typeof VehicleCommandSchema>) => {
      return executeVehicleCommand(authState, args.tokenId, "doors/unlock");
    }
  );

  // Start charging command
  server.tool(
    "start_charge",
    "Start the vehicle charging. **Prerequisites:** Vehicle must be shared with this developer license, user must be authenticated, and vehicle must be electric/hybrid with charging capability. Call check_vehicle_access_status first to see available vehicles.",
    VehicleCommandSchema.shape,
    async (args: z.infer<typeof VehicleCommandSchema>) => {
      return executeVehicleCommand(authState, args.tokenId, "charge/start");
    }
  );

  // Stop charging command
  server.tool(
    "stop_charge",
    "Stop the vehicle charging. **Prerequisites:** Vehicle must be shared with this developer license, user must be authenticated, and vehicle must be electric/hybrid with charging capability. Call check_vehicle_access_status first to see available vehicles.",
    VehicleCommandSchema.shape,
    async (args: z.infer<typeof VehicleCommandSchema>) => {
      return executeVehicleCommand(authState, args.tokenId, "charge/stop");
    }
  );
}