#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DIMO } from '@dimo-network/data-sdk';
import { z } from 'zod';
import { introspectEndpoint } from "./helpers/introspection";
import { parse } from "graphql/language";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// At the top, define the hardcoded URLs for identity and telemetry
const IDENTITY_URL = "https://identity-api.dimo.zone/query";
const TELEMETRY_URL = "https://telemetry-api.dimo.zone/query";
const DEVICES_API_URL = "https://devices-api.dimo.zone";

interface VehicleJwtCacheEntry {
  token: any;
  privileges: number[];
  expiresAt: number; // Unix timestamp in ms
}

interface AuthState {
  dimo?: DIMO;
  developerJwt?: any;
  vehicleJwts: Map<number, VehicleJwtCacheEntry>;
}

const IdentityQuerySchema = z.object({
  	query: z.string(),
		variables: z.record(z.string(), z.string())
});

const TelemetryQuerySchema = z.object({
  	query: z.string(),
		variables: z.record(z.string(), z.string())
});

const VinDecodeSchema = z.object({
    vin: z.string(),
    countryCode: z.string().default("USA")
  });

const AttestationCreateSchema = z.object({
  tokenId: z.number(),
  type: z.enum(["pom", "vin"]),
  force: z.boolean().default(false)
});

const SearchVehiclesSchema = z.object({
  query: z.string().optional(),
  make: z.string().optional(),
  year: z.number().optional(),
  model: z.string().optional()
});

const GetAuthenticationTokenSchema = z.object({
  tokenId: z.number(),
  privileges: z.array(z.number()).optional()
});

const VehicleCommandSchema = z.object({
  tokenId: z.number(),
});

const authState: AuthState = {
  vehicleJwts: new Map()
};

// Initialize MCP Server
const server = new McpServer(
  {
    name: "dimo-mcp-server",
    version: "1.0.0",
  }
);

// Helper function to ensure vehicle JWT exists
async function ensureVehicleJwt(tokenId: number): Promise<any> {
  if (!authState.dimo) {
    throw new Error("DIMO not initialized. Call dimo_init first.");
  }
  if (!authState.developerJwt) {
    throw new Error("Not authenticated. Call dimo_authenticate first.");
  }

  // Get new JWT with required privileges
  const vehicleJwt = await authState.dimo.tokenexchange.getVehicleJwt({
    ...authState.developerJwt,
    tokenId: tokenId
  });

  return vehicleJwt;
}

server.tool(
  "identity_query",
  "Query the DIMO Identity GraphQL API. Introspect the schema with identity_schema before. Use this tool to fetch public identity data (such as user, developer license, aftermarketdevice, manufacturer, sacds, or vehicle info). Provide a GraphQL query string and variables as an object. No authentication required.",
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
  "Query the DIMO Telemetry GraphQL API for real-time or historical vehicle data. Check the schema before using telemetry_introspect. Use this tool to fetch telemetry (status, location, movement, VIN, attestations) for a specific vehicle. Requires vehicle to be shared with the developer license. Provide a GraphQL query string, as as well required variables as an object. Always provide tokenId in variables to query.",
  TelemetryQuerySchema.shape,
  async (args: z.infer<typeof TelemetryQuerySchema>) => {
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
      const telemetryJwt = await ensureVehicleJwt(Number(args.variables.tokenId));
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
        "Authorization" : `${telemetryJwt.headers.Authorization}`,
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

server.tool(  
  "vin_decode",
  "Decode a VIN using DIMO. Use this tool to decode a VIN string (get make/model/year/etc). For decoding, provide the VIN and (optionally) countryCode. For fetching, provide the tokenId.",
  VinDecodeSchema.shape,
  async (args: z.infer<typeof VinDecodeSchema>) => {
      if (!authState.developerJwt) {
        throw new Error("Not authenticated");
      }
      const decoded = await authState.dimo!.devicedefinitions.decodeVin({
        ...authState.developerJwt,
        vin: args.vin,
        countryCode: args.countryCode
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(decoded, null, 2)
        }]
      };
    }
);

server.tool(
  "attestation_create",
  "Create a verifiable credential (VC) for a vehicle. Use this tool to generate a Proof of Movement (PoM) or VIN credential for a vehicle, which can be used to prove vehicle activity or identity. Provide the tokenId and type ('pom' or 'vin'). Optionally force creation even if one exists.",
  AttestationCreateSchema.shape,
  async (args: z.infer<typeof AttestationCreateSchema>) => {
    const attestJwt = await ensureVehicleJwt(args.tokenId);
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
    if (args.make) searchParams.makeSlug = args.make;
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

server.tool(
  "lock_doors",
  "Lock the doors of a vehicle.",
  VehicleCommandSchema.shape,
  async (args: z.infer<typeof VehicleCommandSchema>) => {
    try {
      const commandJwt = await ensureVehicleJwt(args.tokenId);
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
        "Authorization" : `${commandJwt.headers.Authorization}`,
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

server.tool(
  "unlock_doors",
  "Unlock the doors of a vehicle.",
  VehicleCommandSchema.shape,
  async (args: z.infer<typeof VehicleCommandSchema>) => {
    try {
      const commandJwt = await ensureVehicleJwt(args.tokenId);
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
        "Authorization" : `${commandJwt.headers.Authorization}`,
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

server.tool(
  "start_charge",
  "Start the vehicle charging.",
  VehicleCommandSchema.shape,
  async (args: z.infer<typeof VehicleCommandSchema>) => {
    try {
      const commandJwt = await ensureVehicleJwt(args.tokenId);
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
        "Authorization" : `${commandJwt.headers.Authorization}`,
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

server.tool(
  "stop_charge",
  "Stop the vehicle charging.",
  VehicleCommandSchema.shape,
  async (args: z.infer<typeof VehicleCommandSchema>) => {
    try {
      const commandJwt = await ensureVehicleJwt(args.tokenId);
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
        "Authorization" : `${commandJwt.headers.Authorization}`,
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

// Main function to start the server
async function main() {
  // Check for environment variables
  const env = process.env;

  // Initialize DIMO with environment if provided, otherwise use Production
  authState.dimo = new DIMO("Production");


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
}

// Handle errors
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});