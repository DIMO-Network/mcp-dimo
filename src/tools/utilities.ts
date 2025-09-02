import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import type { AuthState } from '../shared/types.js';
import { validateVehicleOperation, getVehicleJwtWithValidation } from '../shared/command-helpers.js';

// Schemas
const VinDecodeSchema = z.object({
  vin: z.string(),
  countryCode: z.string().default("USA")
});

const AttestationCreateSchema = z.object({
  tokenId: z.number(),
  type: z.enum(["vin"]),
  force: z.boolean().default(false)
});

const SearchVehiclesSchema = z.object({
  query: z.string().optional(),
  make: z.string().optional(),
  year: z.number().optional(),
  model: z.string().optional()
});

export function registerUtilityTools(server: McpServer, authState: AuthState) {

  // VIN decoding tool
  server.tool(
    "vin_decode",
    "Decode a VIN using DIMO. Use this tool to decode a VIN string (get make/model/year/etc). For decoding, provide the VIN and (optionally) countryCode.",
    VinDecodeSchema.shape,
    async (args: z.infer<typeof VinDecodeSchema>) => {
      // Use developer JWT for API calls
      if (!authState.developerJwt) {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: "Developer JWT not configured. Please set DIMO_DOMAIN and DIMO_PRIVATE_KEY environment variables. Current configuration is missing required credentials for API access."
          }]
        };
      }

      const decoded = await authState.dimo!.devicedefinitions.decodeVin({
        ...authState.developerJwt,
        vin: args.vin,
        countryCode: args.countryCode
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(decoded, null, 2)
        }]
      };
    }
  );

  // Vehicle search tool
  server.tool(
    "search_vehicles",
    "Search for vehicle definitions and information in DIMO. Use this tool to look up supported makes, models, and years, or to find vehicles matching a query. You can filter by make, model, year, or a free-text query. This searches the general vehicle database, not user-specific vehicles. For user vehicles, use check_vehicle_access_status.",
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
          type: "text" as const,
          text: JSON.stringify(searchResults, null, 2)
        }]
      };
    }
  );

  // Attestation creation tool
  server.tool(
    "attestation_create",
    "Create a verifiable credential (VC) for a vehicle. **Prerequisites:** Vehicle must be shared with this developer license and user must be authenticated. Call check_vehicle_access_status first to see available vehicles. Use this tool to generate a VIN credential for a vehicle, which can be used to prove vehicle activity or identity. Provide the tokenId and type ('vin'). Optionally force creation even if one exists.",
    AttestationCreateSchema.shape,
    async (args: z.infer<typeof AttestationCreateSchema>) => {
      // Validate vehicle operation (auth + ownership)
      const validationError = await validateVehicleOperation(authState, args.tokenId);
      if (validationError) {
        return validationError;
      }

      // Get vehicle JWT
      const jwtResult = await getVehicleJwtWithValidation(authState, args.tokenId, `GraphQL request failed due to a missing Authorization header. Ensure the vehicle is shared with the developer license and has the required privileges.`);
      if (jwtResult.error) {
        return jwtResult.error;
      }

      let attestResult;

      attestResult = await authState.dimo!.attestation.createVinVC({
        ...jwtResult.jwt,
        tokenId: args.tokenId,
        force: args.force
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(attestResult, null, 2)
        }]
      };
    }
  );
}
