import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import type { AuthState } from '../shared/types.js';
import { getEnvConfig } from "../shared/config.js";
import { ensureVehicleJwt } from "../shared/auth-helpers.js";
import { checkVehicleOwnership } from "../helpers/identity-queries.js";

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
        throw new Error("Developer JWT not configured. Please provide developer JWT credentials.");
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

  // Vehicle search tool
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

  // Attestation creation tool
  server.tool(
    "attestation_create",
    "Create a verifiable credential (VC) for a vehicle. Use this tool to generate a VIN credential for a vehicle, which can be used to prove vehicle activity or identity. Provide the tokenId and type ('vin'). Optionally force creation even if one exists.",
    AttestationCreateSchema.shape,
    async (args: z.infer<typeof AttestationCreateSchema>) => {
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
      const telemetryJwt = await ensureVehicleJwt(authState, Number(args.tokenId));
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

      let attestResult;

      attestResult = await authState.dimo!.attestation.createVinVC({
        ...telemetryJwt,
        tokenId: args.tokenId,
        force: args.force
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(attestResult, null, 2)
        }]
      };
    }
  );
}
