import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import { parse } from "graphql/language";
import { introspectEndpoint } from "../helpers/introspection.js";
import type { AuthState } from '../shared/types.js';
import { IDENTITY_URL, TELEMETRY_URL } from '../shared/types.js';
import { validateVehicleOperation, getVehicleJwtWithValidation } from '../shared/command-helpers.js';

// Schemas
const IdentityQuerySchema = z.object({
  query: z.string(),
  variables: z.record(z.string(), z.any())
});

const TelemetryQuerySchema = z.object({
  query: z.string(),
  variables: z.object({
    tokenId: z.number()
  }).and(z.record(z.string(), z.any()))
});

export function registerVehicleDataTools(server: McpServer, authState: AuthState) {

  // Identity API query tool
  server.tool(
    "identity_query",
    "Query the DIMO Identity GraphQL API for public data. **IMPORTANT: You MUST call identity_introspect first to understand the schema structure before making any identity queries.** Use this tool to fetch public identity data (user, developer license, aftermarket device, manufacturer, or vehicle info). No authentication required. Common queries: vehicle details, manufacturer info, device definitions.",
    IdentityQuerySchema.shape,
    async (args: z.infer<typeof IdentityQuerySchema>) => {
      try {
        const parsedQuery = parse(args.query!);
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
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
                type: "text" as const,
                text: `GraphQL request failed: ${response.statusText}\n${responseText}`,
              },
            ],
          };
        }
        const data = await response.json();
        if (data.errors && data.errors.length > 0) {
          // Check if errors suggest schema issues
          const hasSchemaError = data.errors.some((error: any) => 
            error.message?.includes('Cannot query field') || 
            error.message?.includes('Unknown field') ||
            error.message?.includes('Unknown type') ||
            error.message?.includes('Field') && error.message?.includes('doesn\'t exist')
          );
          
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: hasSchemaError 
                  ? `GraphQL schema error detected. Please call identity_introspect first to understand the schema structure, then fix your query. Error details: ${JSON.stringify(data, null, 2)}`
                  : `The GraphQL response has errors, please fix the query: ${JSON.stringify(data, null, 2)}`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text" as const,
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
    "Query the DIMO Telemetry GraphQL API for real-time or historical vehicle data. **CRITICAL REQUIREMENTS: 1) You MUST call telemetry_introspect first to understand the schema structure, 2) You MUST ALWAYS provide tokenId in the variables object for every telemetry query.** This tool fetches telemetry data (status, location, movement, VIN, attestations) for a specific vehicle. Requires vehicle to be shared with the developer license.",
    TelemetryQuerySchema.shape,
    async (args: z.infer<typeof TelemetryQuerySchema>) => {
      // Validate vehicle operation (auth + ownership)
      // Note: tokenId is now guaranteed by schema validation
      const validationError = await validateVehicleOperation(authState, args.variables.tokenId);
      if (validationError) {
        return validationError;
      }
      try {
        const parsedQuery = parse(args.query!);
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Invalid GraphQL query: ${error}`,
            },
          ],
        };
      }
      try {
        const jwtResult = await getVehicleJwtWithValidation(authState, args.variables.tokenId, `GraphQL request failed due to a missing Authorization header. Ensure the vehicle is shared with the developer license and has the required privileges.`);
        if (jwtResult.error) {
          return jwtResult.error;
        }
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `${jwtResult.jwt.headers?.Authorization}`,
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
                type: "text" as const,
                text: `GraphQL request failed: ${response.statusText}\n${responseText}`,
              },
            ],
          };
        }
        const data = await response.json();
        if (data.errors && data.errors.length > 0) {
          // Check if errors suggest schema issues
          const hasSchemaError = data.errors.some((error: any) => 
            error.message?.includes('Cannot query field') || 
            error.message?.includes('Unknown field') ||
            error.message?.includes('Unknown type') ||
            error.message?.includes('Field') && error.message?.includes('doesn\'t exist')
          );
          
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: hasSchemaError 
                  ? `GraphQL schema error detected. Please call telemetry_introspect first to understand the schema structure, then fix your query. Error details: ${JSON.stringify(data, null, 2)}`
                  : `The GraphQL response has errors, please fix the query: ${JSON.stringify(data, null, 2)}`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text" as const,
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
    "Introspect the DIMO Identity GraphQL endpoint and return the schema SDL. **ALWAYS call this tool first** before using identity_query to understand the available fields, types, and query structure. This discovers the structure of the public identity API including available vehicle, manufacturer, and device fields.",
    async () => {
      const schema = await introspectEndpoint(IDENTITY_URL);
      return {
        content: [
          {
            type: "text" as const,
            text: schema,
          },
        ],
      };
    }
  );

  // Telemetry API schema introspection
  server.tool(
    "telemetry_introspect",
    "Introspect the DIMO Telemetry GraphQL endpoint and return the schema SDL. **ALWAYS call this tool first** before using telemetry_query to understand the available fields, types, and query structure. This discovers the structure of the telemetry API including available vehicle data fields, signal types, and time-series data structures.",
    async () => {
      const schema = await introspectEndpoint(TELEMETRY_URL);
      return {
        content: [
          {
            type: "text" as const,
            text: schema,
          },
        ],
      };
    }
  );
}
