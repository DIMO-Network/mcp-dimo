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
  tokenId: z.number(),
  variables: z.record(z.string(), z.any()).optional().default({})
});

const BatchTelemetryQuerySchema = z.object({
  query: z.string(),
  tokenIds: z.array(z.number()).min(1, "At least one tokenId is required"),
  variables: z.record(z.string(), z.any()).optional().default({})
});

const DataSummarySchema = z.object({
  tokenId: z.number().describe("Vehicle token ID to get data summary for")
});

const BatchDataSummarySchema = z.object({
  tokenIds: z.array(z.number()).min(1, "At least one tokenId is required").describe("Array of vehicle token IDs to get data summaries for")
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
    "Query the DIMO Telemetry GraphQL API for real-time or historical vehicle data. **CRITICAL REQUIREMENTS: 1) You MUST call telemetry_introspect first to understand the schema structure, 2) The tokenId parameter is automatically included in GraphQL variables.** This tool fetches telemetry data (status, location, movement, VIN, attestations) for a specific vehicle. Requires vehicle to be shared with the developer license.",
    TelemetryQuerySchema.shape,
    async (args: z.infer<typeof TelemetryQuerySchema>) => {
      // Validate vehicle operation (auth + ownership)
      const validationError = await validateVehicleOperation(authState, args.tokenId);
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
        const jwtResult = await getVehicleJwtWithValidation(authState, args.tokenId, `GraphQL request failed due to a missing Authorization header. Ensure the vehicle is shared with the developer license and has the required privileges.`);
        if (jwtResult.error) {
          return jwtResult.error;
        }
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `${jwtResult.jwt.headers?.Authorization}`,
        };

        // Merge tokenId into variables
        const variables = { ...args.variables, tokenId: args.tokenId };

        const response = await fetch(TELEMETRY_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({
            query: args.query,
            variables,
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

  // Batch Telemetry API query tool
  server.tool(
    "batch_telemetry_query",
    "Query multiple vehicles in parallel with the same GraphQL query. **CRITICAL REQUIREMENTS: 1) You MUST call telemetry_introspect first to understand the schema structure, 2) All specified vehicles must be shared with the developer license.** This tool executes the same query against multiple tokenIds simultaneously and returns combined results. Useful for fleet operations or comparing data across multiple vehicles.",
    BatchTelemetryQuerySchema.shape,
    async (args: z.infer<typeof BatchTelemetryQuerySchema>) => {
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

      // Validate all vehicles upfront
      const validationPromises = args.tokenIds.map(tokenId => 
        validateVehicleOperation(authState, tokenId)
      );
      const validationResults = await Promise.all(validationPromises);
      
      // Check for validation errors
      const validationErrors: { tokenId: number; error: any }[] = [];
      validationResults.forEach((result, index) => {
        if (result) {
          validationErrors.push({ tokenId: args.tokenIds[index], error: result });
        }
      });

      if (validationErrors.length > 0) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Validation failed for ${validationErrors.length} vehicle(s): ${JSON.stringify(validationErrors, null, 2)}`,
            },
          ],
        };
      }

      try {
        // Get JWTs for all vehicles in parallel
        const jwtPromises = args.tokenIds.map(tokenId =>
          getVehicleJwtWithValidation(authState, tokenId, `GraphQL request failed for tokenId ${tokenId} due to missing Authorization header.`)
        );
        const jwtResults = await Promise.all(jwtPromises);

        // Check for JWT errors
        const jwtErrors: { tokenId: number; error: any }[] = [];
        jwtResults.forEach((result, index) => {
          if (result.error) {
            jwtErrors.push({ tokenId: args.tokenIds[index], error: result.error });
          }
        });

        if (jwtErrors.length > 0) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `JWT retrieval failed for ${jwtErrors.length} vehicle(s): ${JSON.stringify(jwtErrors, null, 2)}`,
              },
            ],
          };
        }

        // Execute queries in parallel
        const queryPromises = args.tokenIds.map(async (tokenId, index) => {
          const jwtResult = jwtResults[index];
          const headers = {
            "Content-Type": "application/json",
            "Authorization": `${jwtResult.jwt!.headers?.Authorization}`,
          };

          // Merge tokenId into variables
          const variables = { ...args.variables, tokenId };

          const response = await fetch(TELEMETRY_URL, {
            method: "POST",
            headers,
            body: JSON.stringify({
              query: args.query,
              variables,
            }),
          });

          if (!response.ok) {
            const responseText = await response.text();
            throw new Error(`Request failed for tokenId ${tokenId}: ${response.statusText}\n${responseText}`);
          }

          const data = await response.json();
          return { tokenId, data, success: true };
        });

        const results = await Promise.allSettled(queryPromises);
        
        // Process results
        const successfulResults: Array<{ tokenId: number; data: any }> = [];
        const failedResults: Array<{ tokenId: number; error: string }> = [];

        results.forEach((result, index) => {
          const tokenId = args.tokenIds[index];
          if (result.status === 'fulfilled') {
            const { data } = result.value;
            if (data.errors && data.errors.length > 0) {
              // Check if errors suggest schema issues
              const hasSchemaError = data.errors.some((error: any) => 
                error.message?.includes('Cannot query field') || 
                error.message?.includes('Unknown field') ||
                error.message?.includes('Unknown type') ||
                error.message?.includes('Field') && error.message?.includes('doesn\'t exist')
              );
              
              failedResults.push({
                tokenId,
                error: hasSchemaError 
                  ? `GraphQL schema error for tokenId ${tokenId}. Please call telemetry_introspect first to understand the schema structure.`
                  : `GraphQL errors for tokenId ${tokenId}: ${JSON.stringify(data.errors, null, 2)}`
              });
            } else {
              successfulResults.push({ tokenId, data });
            }
          } else {
            failedResults.push({ tokenId, error: result.reason?.message || 'Unknown error' });
          }
        });

        const combinedResult = {
          summary: {
            total: args.tokenIds.length,
            successful: successfulResults.length,
            failed: failedResults.length
          },
          results: successfulResults,
          ...(failedResults.length > 0 && { errors: failedResults })
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(combinedResult, null, 2),
            },
          ],
        };

      } catch (error) {
        throw new Error(`Failed to execute batch GraphQL queries: ${error}`);
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

  // Vehicle data summary tool
  server.tool(
    "vehicle_data_summary",
    "Get a comprehensive data summary for a vehicle including signal counts, availability, and time ranges. This provides an overview of what telemetry data is available for a specific vehicle token ID. **Prerequisites:** Vehicle JWT required for access.",
    DataSummarySchema.shape,
    async (args: z.infer<typeof DataSummarySchema>) => {
      // Validate vehicle access
      const validationResult = await validateVehicleOperation(authState, args.tokenId);
      if (validationResult) {
        return validationResult;
      }

      // Get vehicle JWT
      const jwtResult = await getVehicleJwtWithValidation(authState, args.tokenId);
      if (jwtResult.error) {
        return jwtResult.error;
      }

      const query = `
            query GetDataSummary($tokenId: Int!) {
              dataSummary(tokenId: $tokenId) {
                numberOfSignals
                availableSignals
                firstSeen
                lastSeen
                signalDataSummary {
                  name
                  numberOfSignals
                  firstSeen
                  lastSeen
                }
              }
            }`;

      const variables = {
        tokenId: args.tokenId
      };

      try {
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `${jwtResult.jwt!.headers?.Authorization}`,
        };

        const response = await fetch(TELEMETRY_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query,
            variables
          }),
        });

        const data = await response.json();

        if (data.errors && data.errors.length > 0) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `GraphQL errors in data summary query: ${JSON.stringify(data, null, 2)}`,
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
        throw new Error(`Failed to get vehicle data summary: ${error}`);
      }
    }
  );

  // Batch vehicle data summary tool
  server.tool(
    "batch_vehicle_data_summary",
    "Get comprehensive data summaries for multiple vehicles including signal counts, availability, and time ranges. This provides an overview of what telemetry data is available for multiple vehicle token IDs in a single request. **Prerequisites:** Vehicle JWTs required for access to each vehicle.",
    BatchDataSummarySchema.shape,
    async (args: z.infer<typeof BatchDataSummarySchema>) => {
      // Check for validation errors in parallel
      const validationPromises = args.tokenIds.map(tokenId =>
        validateVehicleOperation(authState, tokenId)
      );
      const validationResults = await Promise.all(validationPromises);

      // Check for validation errors
      const validationErrors: { tokenId: number; error: any }[] = [];
      validationResults.forEach((result, index) => {
        if (result) {
          validationErrors.push({ tokenId: args.tokenIds[index], error: result });
        }
      });

      if (validationErrors.length > 0) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Access validation failed for ${validationErrors.length} vehicle(s): ${JSON.stringify(validationErrors, null, 2)}`,
            },
          ],
        };
      }

      try {
        // Get JWTs for all vehicles in parallel
        const jwtPromises = args.tokenIds.map(tokenId =>
          getVehicleJwtWithValidation(authState, tokenId, `Data summary request failed for tokenId ${tokenId} due to missing Authorization header.`)
        );
        const jwtResults = await Promise.all(jwtPromises);

        // Check for JWT errors
        const jwtErrors: { tokenId: number; error: any }[] = [];
        jwtResults.forEach((result, index) => {
          if (result.error) {
            jwtErrors.push({ tokenId: args.tokenIds[index], error: result.error });
          }
        });

        if (jwtErrors.length > 0) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `JWT retrieval failed for ${jwtErrors.length} vehicle(s): ${JSON.stringify(jwtErrors, null, 2)}`,
              },
            ],
          };
        }

        // Execute data summary queries in parallel
        const queryPromises = args.tokenIds.map(async (tokenId, index) => {
          const jwtResult = jwtResults[index];
          const headers = {
            "Content-Type": "application/json",
            "Authorization": `${jwtResult.jwt!.headers?.Authorization}`,
          };

          const query = `
query GetDataSummary($tokenId: Int!) {
  dataSummary(tokenId: $tokenId) {
    numberOfSignals
    availableSignals
    firstSeen
    lastSeen
    signalDataSummary {
      name
      numberOfSignals
      firstSeen
      lastSeen
    }
  }
}`;

          const variables = { tokenId };

          const response = await fetch(TELEMETRY_URL, {
            method: "POST",
            headers,
            body: JSON.stringify({
              query,
              variables,
            }),
          });

          if (!response.ok) {
            const responseText = await response.text();
            throw new Error(`Request failed for tokenId ${tokenId}: ${response.statusText}\n${responseText}`);
          }

          const data = await response.json();
          return { tokenId, data, success: true };
        });

        const results = await Promise.allSettled(queryPromises);
        
        // Process results
        const successfulResults: Array<{ tokenId: number; data: any }> = [];
        const failedResults: Array<{ tokenId: number; error: string }> = [];

        results.forEach((result, index) => {
          const tokenId = args.tokenIds[index];
          if (result.status === 'fulfilled') {
            const { data } = result.value;
            if (data.errors && data.errors.length > 0) {
              // Check if errors suggest schema issues
              const hasSchemaError = data.errors.some((error: any) => 
                error.message?.includes('Cannot query field') || 
                error.message?.includes('Unknown field') ||
                error.message?.includes('Unknown type') ||
                error.message?.includes('Field') && error.message?.includes('doesn\'t exist')
              );
              
              failedResults.push({
                tokenId,
                error: hasSchemaError 
                  ? `GraphQL schema error for tokenId ${tokenId}. Please call telemetry_introspect first to understand the schema structure.`
                  : `GraphQL errors for tokenId ${tokenId}: ${JSON.stringify(data.errors, null, 2)}`
              });
            } else {
              successfulResults.push({ tokenId, data: data.data });
            }
          } else {
            failedResults.push({ tokenId, error: result.reason?.message || 'Unknown error' });
          }
        });

        const combinedResult = {
          summary: {
            total: args.tokenIds.length,
            successful: successfulResults.length,
            failed: failedResults.length
          },
          results: successfulResults,
          ...(failedResults.length > 0 && { errors: failedResults })
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(combinedResult, null, 2),
            },
          ],
        };

      } catch (error) {
        throw new Error(`Failed to execute batch data summary queries: ${error}`);
      }
    }
  );
}
