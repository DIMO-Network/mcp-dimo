import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import type { AuthState } from '../shared/types.js';
import { DEVICES_API_URL } from '../shared/types.js';
import { ensureVehicleJwt } from '../shared/auth-helpers.js';
import { getEnvConfig } from "../shared/config.js";
import { checkVehicleOwnership } from "../helpers/identity-queries.js";

// Schemas
const VehicleCommandSchema = z.object({
  tokenId: z.number(),
});

export function registerVehicleCommandTools(server: McpServer, authState: AuthState) {

  // Lock doors command
  server.tool(
    "lock_doors",
    "Lock the doors of a vehicle.",
    VehicleCommandSchema.shape,
    async (args: z.infer<typeof VehicleCommandSchema>) => {
      try {
        const config = getEnvConfig();
        if (!authState.userOAuthToken) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "You are not logged in, please login.",
              },
            ],
          };
        }
        const ownership = await checkVehicleOwnership(authState.userOAuthToken?.address, args.tokenId);
        if (!config.FLEET_MODE && !ownership.isOwner) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "You are not the owner of this vehicle, sorry.",
              },
            ],
          };
        }
        const commandJwt = await ensureVehicleJwt(authState, args.tokenId);
        if (!commandJwt.headers || !commandJwt.headers.Authorization) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Request failed due to a missing Authorization header.`,
              },
            ],
          };
        }
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `${commandJwt.headers.Authorization}`,
        };
        const response = await fetch(`${DEVICES_API_URL}/v1/vehicle/${args.tokenId}/commands/doors/lock`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          const responseText = await response.text();
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Request failed: ${response.statusText}\n${responseText}`,
              },
            ],
          };
        }

        const data = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to execute command: ${error}`);
      }
    }
  );

  // Unlock doors command
  server.tool(
    "unlock_doors",
    "Unlock the doors of a vehicle.",
    VehicleCommandSchema.shape,
    async (args: z.infer<typeof VehicleCommandSchema>) => {
      try {
        const config = getEnvConfig();
        if (!authState.userOAuthToken) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "You are not logged in, please login.",
              },
            ],
          };
        }
        const ownership = await checkVehicleOwnership(authState.userOAuthToken?.address, args.tokenId);
        if (!config.FLEET_MODE && !ownership.isOwner) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "You are not the owner of this vehicle, sorry.",
              },
            ],
          };
        }
        const commandJwt = await ensureVehicleJwt(authState, args.tokenId);
        if (!commandJwt.headers || !commandJwt.headers.Authorization) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Request failed due to a missing Authorization header.`,
              },
            ],
          };
        }
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `${commandJwt.headers.Authorization}`,
        };
        const response = await fetch(`${DEVICES_API_URL}/v1/vehicle/${args.tokenId}/commands/doors/unlock`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          const responseText = await response.text();
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Request failed: ${response.statusText}\n${responseText}`,
              },
            ],
          };
        }

        const data = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to execute command: ${error}`);
      }
    }
  );

  // Start charging command
  server.tool(
    "start_charge",
    "Start the vehicle charging.",
    VehicleCommandSchema.shape,
    async (args: z.infer<typeof VehicleCommandSchema>) => {
      try {
        const config = getEnvConfig();
        if (!authState.userOAuthToken) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "You are not logged in, please login.",
              },
            ],
          };
        }
        const ownership = await checkVehicleOwnership(authState.userOAuthToken?.address, args.tokenId);
        if (!config.FLEET_MODE && !ownership.isOwner) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "You are not the owner of this vehicle, sorry.",
              },
            ],
          };
        }
        const commandJwt = await ensureVehicleJwt(authState, args.tokenId);
        if (!commandJwt.headers || !commandJwt.headers.Authorization) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Request failed due to a missing Authorization header.`,
              },
            ],
          };
        }
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `${commandJwt.headers.Authorization}`,
        };
        const response = await fetch(`${DEVICES_API_URL}/v1/vehicle/${args.tokenId}/commands/charge/start`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          const responseText = await response.text();
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Request failed: ${response.statusText}\n${responseText}`,
              },
            ],
          };
        }

        const data = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to execute command: ${error}`);
      }
    }
  );

  // Stop charging command
  server.tool(
    "stop_charge",
    "Stop the vehicle charging.",
    VehicleCommandSchema.shape,
    async (args: z.infer<typeof VehicleCommandSchema>) => {
      try {
        const config = getEnvConfig();
        if (!authState.userOAuthToken) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "You are not logged in, please login.",
              },
            ],
          };
        }
        const ownership = await checkVehicleOwnership(authState.userOAuthToken?.address, args.tokenId);
        if (!config.FLEET_MODE && !ownership.isOwner) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "You are not the owner of this vehicle, sorry.",
              },
            ],
          };
        }
        const commandJwt = await ensureVehicleJwt(authState, args.tokenId);
        if (!commandJwt.headers || !commandJwt.headers.Authorization) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Request failed due to a missing Authorization header.`,
              },
            ],
          };
        }
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `${commandJwt.headers.Authorization}`,
        };
        const response = await fetch(`${DEVICES_API_URL}/v1/vehicle/${args.tokenId}/commands/charge/stop`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          const responseText = await response.text();
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Request failed: ${response.statusText}\n${responseText}`,
              },
            ],
          };
        }

        const data = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to execute command: ${error}`);
      }
    }
  );
}
