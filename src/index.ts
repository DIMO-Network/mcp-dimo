#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { DIMO } from '@dimo-network/data-sdk';
import { z } from 'zod';
import { buildClientSchema, getIntrospectionQuery, printSchema } from "graphql";
import { introspectEndpoint } from "./helpers/introspection";
import { parse } from "graphql/language";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jwt } from "zod/v4";
import { ar } from "zod/v4/locales";

// At the top, define the hardcoded URLs for identity and telemetry
const IDENTITY_URL = "https://identity-api.dimo.zone/query";
const TELEMETRY_URL = "https://telemetry-api.dimo.zone/query";

// Store for managing authentication state
interface AuthState {
  dimo?: DIMO;
  developerJwt?: any;
  vehicleJwts: Map<number, any>;
}

const IdentityQuerySchema = z.object({
  	query: z.string(),
		variables: z.any().optional(),
});

const TelemetryQuerySchema = z.object({
  	query: z.string(),
		variables: z.any().optional(),
    tokenId: z.number()
});

const VinOperationsSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("decode"),
    vin: z.string(),
    countryCode: z.string().default("USA")
  }),
  z.object({
    operation: z.literal("get"),
    tokenId: z.number()
  })
]);

const AttestationCreateSchema = z.object({
  tokenId: z.number(),
  type: z.enum(["pom", "vin"]),
  force: z.boolean().default(false)
});

const SearchVehiclesSchema = z.object({
  query: z.string().optional(),
  makeSlug: z.string().optional(),
  year: z.number().optional(),
  model: z.string().optional()
});

const authState: AuthState = {
  vehicleJwts: new Map()
};

// Initialize MCP Server
const server = new McpServer(
  {
    name: "dimo-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to ensure vehicle JWT exists
async function ensureVehicleJwt(tokenId: number, privileges: number[] = [1]): Promise<any> {
  if (!authState.dimo) {
    throw new Error("DIMO not initialized. Call dimo_init first.");
  }
  if (!authState.developerJwt) {
    throw new Error("Not authenticated. Call dimo_authenticate first.");
  }
  
  // Check if we already have a JWT with the required privileges
  const existingJwt = authState.vehicleJwts.get(tokenId);
  if (existingJwt && privileges.every(p => existingJwt.privileges?.includes(p))) {
    return existingJwt;
  }
  
  // Get new JWT with required privileges
  const vehicleJwt = await authState.dimo.tokenexchange.exchange({
    ...authState.developerJwt,
    tokenId: tokenId,
    privileges: privileges
  });
  
  authState.vehicleJwts.set(tokenId, { ...vehicleJwt, privileges });
  return vehicleJwt;
}



// server.resource("identity-graphql-schema", new URL(IDENTITY_URL).href, async (uri) => {
// 	try {
// 		let schema = await introspectEndpoint(IDENTITY_URL, {});

// 		return {
// 			contents: [
// 				{
// 					uri: uri.href,
// 					text: schema,
// 				},
// 			],
// 		};
// 	} catch (error) {
// 		throw new Error(`Failed to get GraphQL schema: ${error}`);
// 	}
// });

// server.resource("telemetry-graphql-schema", new URL(TELEMETRY_URL).href, async (uri) => {
// 	try {
// 		let schema = await introspectEndpoint(TELEMETRY_URL, {});

// 		return {
// 			contents: [
// 				{
// 					uri: uri.href,
// 					text: schema,
// 				},
// 			],
// 		};
// 	} catch (error) {
// 		throw new Error(`Failed to get GraphQL schema: ${error}`);
// 	}
// });

server.tool(
  "identity_query",
  "Query the DIMO Identity GraphQL API or introspect its schema. Use this tool to fetch public identity data (such as user, device, or vehicle info) or to get the GraphQL schema. Provide a GraphQL query string and optional variables. No authentication required.",
  IdentityQuerySchema.shape,
  async (args: z.infer<typeof IdentityQuerySchema>) => {
    const env = process.env;
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
          ...(env.HEADERS ? JSON.parse(env.HEADERS) : {}),
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

server.tool(
  "telemetry_query",
  "Query the DIMO Telemetry GraphQL API for real-time or historical vehicle data. Use this tool to fetch telemetry (status, location, movement, VIN) for a specific vehicle. Requires a valid tokenId and JWT with appropriate privileges. Provide a GraphQL query string and optional variables.",
  TelemetryQuerySchema.shape,
  async (args: z.infer<typeof TelemetryQuerySchema>) => {
    const env = process.env;
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
      console.error("Executing telemetry query:", args.query, args.variables, args.tokenId);
      const telemetryJwt = await ensureVehicleJwt(args.tokenId, [1,2,3,4,5]);
      const headers = {
        "Content-Type": "application/json",
        ...(env.HEADERS ? JSON.parse(env.HEADERS) : {}),
        ...(telemetryJwt?.accessToken ? { Authorization: `Bearer ${telemetryJwt.accessToken}` } : {}),
      };
      console.error("Headers:", JSON.stringify(headers, null, 2));
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

server.registerTool(
  "vin_operations",
  {
    description: "Decode a VIN or fetch a vehicle's VIN from DIMO. Use this tool to decode a VIN string (get make/model/year/etc) or to retrieve the VIN for a registered vehicle by tokenId. For decoding, provide the VIN and (optionally) countryCode. For fetching, provide the tokenId.",
    inputSchema: VinOperationsSchema as any,
  },
  (async (args: z.infer<typeof VinOperationsSchema>, _extra: any) => {
    if (args.operation === "decode") {
      if (!authState.developerJwt) {
        throw new Error("Not authenticated");
      }
      const decoded = await authState.dimo!.devicedefinitions.decodeVin({
        ...authState.developerJwt,
        vin: (args as any).vin,
        countryCode: (args as any).countryCode
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(decoded, null, 2)
        }]
      };
    } else {
      const vinJwt = await ensureVehicleJwt((args as any).tokenId, [5]);
      const vin = await authState.dimo!.telemetry.getVin({
        ...vinJwt,
        tokenId: (args as any).tokenId
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(vin, null, 2)
        }]
      };
    }
  }) as any
);

server.tool(
  "attestation_create",
  "Create a verifiable credential (VC) for a vehicle. Use this tool to generate a Proof of Movement (PoM) or VIN credential for a vehicle, which can be used to prove vehicle activity or identity. Provide the tokenId and type ('pom' or 'vin'). Optionally force creation even if one exists.",
  AttestationCreateSchema.shape,
  async (args: z.infer<typeof AttestationCreateSchema>) => {
    const requiredPrivilege = args.type === "pom" ? 4 : 5;
    const attestJwt = await ensureVehicleJwt(args.tokenId, [requiredPrivilege]);
    let attestResult;
    if (args.type === "pom") {
      attestResult = await authState.dimo!.attestation.createPomVC({
        ...attestJwt,
        tokenId: args.tokenId
      });
    } else {
      attestResult = await authState.dimo!.attestation.createVinVC({
        ...attestJwt,
        tokenId: args.tokenId,
        force: args.force
      });
    }
    return {
      content: [{
        type: "text",
        text: JSON.stringify(attestResult, null, 2)
      }]
    };
  }
);

server.tool(
  "search_vehicles",
  "Search for vehicle definitions and information in DIMO. Use this tool to look up supported makes, models, and years, or to find vehicles matching a query. You can filter by make, model, year, or a free-text query.",
  SearchVehiclesSchema.shape,
  async (args: z.infer<typeof SearchVehiclesSchema>) => {
    if (!authState.dimo) {
      throw new Error("DIMO not initialized");
    }
    const searchParams: any = {};
    if (args.query) searchParams.query = args.query;
    if (args.makeSlug) searchParams.makeSlug = args.makeSlug;
    if (args.year) searchParams.year = args.year;
    if (args.model) searchParams.model = args.model;
    const searchResults = await authState.dimo.devicedefinitions.search(searchParams);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(searchResults, null, 2)
      }]
    };
  }
);

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

// Main function to start the server
async function main() {
  // Check for environment variables
  const env = process.env;

  // Initialize DIMO with environment if provided, otherwise use Production
  authState.dimo = new DIMO(env.DIMO_ENVIRONMENT as "Production" | "Dev" || "Production");


  // Auto-authenticate if credentials are provided
  if (env.DIMO_CLIENT_ID && env.DIMO_DOMAIN && env.DIMO_PRIVATE_KEY) {
    try {
      authState.developerJwt = await authState.dimo.auth.getDeveloperJwt({
        client_id: env.DIMO_CLIENT_ID,
        domain: env.DIMO_DOMAIN,
        private_key: env.DIMO_PRIVATE_KEY
      });
      console.error(JSON.stringify({
        level: "info",
        event: "dimo_auth_success",
        message: "DIMO developer authentication successful"
      }));
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        event: "dimo_auth_failed",
        message: "Failed to auto-authenticate",
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(JSON.stringify({
    level: "info",
    event: "stdio_server_running",
    message: "DIMO MCP Server running on stdio"
  }));
}

// Handle errors
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});