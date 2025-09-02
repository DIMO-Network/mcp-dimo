import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import { parse } from "graphql/language";
import { introspectEndpoint } from "../helpers/introspection.js";
import type { AuthState } from '../shared/types.js';
import { IDENTITY_URL, TELEMETRY_URL } from '../shared/types.js';
import { ensureVehicleJwt } from '../shared/auth-helpers.js';
import { getEnvConfig } from "../shared/config.js";
import { checkVehicleOwnership } from "../helpers/identity-queries.js";

// Schemas
const IdentityQuerySchema = z.object({
  query: z.string(),
  variables: z.record(z.string(), z.any())
});

const TelemetryQuerySchema = z.object({
  query: z.string(),
  variables: z.record(z.string(), z.any())
});

export function registerVehicleDataTools(server: McpServer, authState: AuthState) {

  // Identity API query tool
  server.tool(
    "identity_query",
    "Query the DIMO Identity GraphQL API. Introspect the schema with identity_introspect before. Use this tool to fetch public identity data (such as user, developer license, aftermarketdevice, manufacturer, or vehicle info). Provide a GraphQL query string and variables as an object. No authentication required.",
    IdentityQuerySchema.shape,
    async (args: z.infer<typeof IdentityQuerySchema>) => {
      try {
        const parsedQuery = parse(args.query!);
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Invalid GraphQL query: ${error}`,
            },
          ],
        };
      }
      try {
        const response = await fetch(IDENTITY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.HEADERS ? JSON.parse(process.env.HEADERS) : {}),
          },
          body: JSON.stringify({
            query: args.query,
            variables: args.variables,
          }),
        });
        if (!response.ok) {
          const responseText = await response.text();
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `GraphQL request failed: ${response.statusText}\n${responseText}`,
              },
            ],
          };
        }
        const data = await response.json();
        if (data.errors && data.errors.length > 0) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `The GraphQL response has errors, please fix the query: ${JSON.stringify(data, null, 2)}`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to execute GraphQL query: ${error}`);
      }
    }
  );

  // Telemetry API query tool
  server.tool(
    "telemetry_query",
    "Query the DIMO Telemetry GraphQL API for real-time or historical vehicle data. Check the schema before using telemetry_introspect. Use this tool to fetch telemetry (status, location, movement, VIN, attestations) for a specific vehicle. Requires vehicle to be shared with the developer license. Provide a GraphQL query string and variables as an object. Always provide tokenId in variables to query.",
    TelemetryQuerySchema.shape,
    async (args: z.infer<typeof TelemetryQuerySchema>) => {
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
      const ownership = await checkVehicleOwnership(authState.userOAuthToken?.address, args.variables.tokenId);
      console.error("ownership", ownership);
      console.error("FLEET_MODE", config.FLEET_MODE, "condition result:", (!config.FLEET_MODE && !ownership.isOwner));
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
      
      
      try {
        const parsedQuery = parse(args.query!);
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Invalid GraphQL query: ${error}`,
            },
          ],
        };
      }
      try {
        if (!args.variables.tokenId) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "tokenId is required in variables for telemetry queries",
              },
            ],
          };
        }
        const telemetryJwt = await ensureVehicleJwt(authState, Number(args.variables.tokenId));
        if (!telemetryJwt.headers || !telemetryJwt.headers.Authorization) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `GraphQL request failed due to a missing Authorization header. Ensure the vehicle is shared with the developer license and has the required privileges.`,
              },
            ],
          };
        }
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `${telemetryJwt.headers.Authorization}`,
        };
        const response = await fetch(TELEMETRY_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({
            query: args.query,
            variables: args.variables,
          }),
        });
        if (!response.ok) {
          const responseText = await response.text();
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `GraphQL request failed: ${response.statusText}\n${responseText}`,
              },
            ],
          };
        }
        const data = await response.json();
        if (data.errors && data.errors.length > 0) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `The GraphQL response has errors, please fix the query: ${JSON.stringify(data, null, 2)}`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to execute GraphQL query: ${error}`);
      }
    }
  );

  // Identity API schema introspection
  server.tool(
    "identity_introspect",
    "Introspect the DIMO Identity GraphQL endpoint and return the schema SDL. Use this tool to discover the structure of the public identity API.",
    async () => {
      const schema = await introspectEndpoint(IDENTITY_URL);
      return {
        content: [
          {
            type: "text",
            text: schema,
          },
        ],
      };
    }
  );

  // Telemetry API schema introspection
  server.tool(
    "telemetry_introspect",
    "Introspect the DIMO Telemetry GraphQL endpoint and return the schema SDL. Use this tool to discover the structure of the telemetry API.",
    async () => {
      const schema = await introspectEndpoint(TELEMETRY_URL);
      return {
        content: [
          {
            type: "text",
            text: schema,
          },
        ],
      };
    }
  );
}
