import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import type { AuthState } from '../shared/types.js';
import { validateVehicleOperation, getVehicleJwtWithValidation } from '../shared/command-helpers.js';

// Attestation Schemas
const AttestationCreateVinSchema = z.object({
  tokenId: z.number(),
  force: z.boolean().default(false)
});

const AttestationCreateOdometerSchema = z.object({
  tokenId: z.number(),
  timestamp: z.string().datetime().optional()
});

const AttestationCreateVehicleHealthSchema = z.object({
  tokenId: z.number(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime()
});

const AttestationCreateVehiclePositionSchema = z.object({
  tokenId: z.number(),
  timestamp: z.string().datetime()
});

export function registerAttestationTools(server: McpServer, authState: AuthState) {

  // VIN Attestation creation tool
  server.tool(
    "attestation_create_vin",
    "Create a VIN verifiable credential (VC) for a vehicle. **Prerequisites:** Vehicle must be shared with this developer license and user must be authenticated. Call check_vehicle_access_status first to see available vehicles. Use this tool to generate a VIN credential for a vehicle, which can be used to prove vehicle identity. Provide the tokenId and optionally force creation even if one exists.",
    AttestationCreateVinSchema.shape,
    async (args: z.infer<typeof AttestationCreateVinSchema>) => {
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

      const attestResult = await authState.dimo!.attestation.createVinVC({
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

  // Odometer Statement Attestation creation tool
  server.tool(
    "attestation_create_odometer",
    "Create an odometer statement verifiable credential (VC) for a vehicle. **Prerequisites:** Vehicle must be shared with this developer license and user must be authenticated. Call check_vehicle_access_status first to see available vehicles. This uses privId 4 and generates a credential based on the vehicle's odometer reading. Provide the tokenId and optionally a timestamp.",
    AttestationCreateOdometerSchema.shape,
    async (args: z.infer<typeof AttestationCreateOdometerSchema>) => {
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

      const params: any = {
        ...jwtResult.jwt,
        tokenId: args.tokenId
      };
      if (args.timestamp) {
        params.timestamp = args.timestamp;
      }

      const attestResult = await authState.dimo!.attestation.createOdometerStatementVC(params);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(attestResult, null, 2)
        }]
      };
    }
  );

  // Vehicle Health Attestation creation tool
  server.tool(
    "attestation_create_vehicle_health",
    "Create a vehicle health verifiable credential (VC) for a vehicle. **Prerequisites:** Vehicle must be shared with this developer license and user must be authenticated. Call check_vehicle_access_status first to see available vehicles. This uses privId 4 and generates a credential based on the vehicle's health data over a time period. Provide the tokenId, startTime, and endTime.",
    AttestationCreateVehicleHealthSchema.shape,
    async (args: z.infer<typeof AttestationCreateVehicleHealthSchema>) => {
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

      const attestResult = await authState.dimo!.attestation.createVehicleHealthVC({
        ...jwtResult.jwt,
        tokenId: args.tokenId,
        startTime: args.startTime,
        endTime: args.endTime
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(attestResult, null, 2)
        }]
      };
    }
  );

  // Vehicle Position Attestation creation tool
  server.tool(
    "attestation_create_vehicle_position",
    "Create a vehicle position verifiable credential (VC) for a vehicle. **Prerequisites:** Vehicle must be shared with this developer license and user must be authenticated. Call check_vehicle_access_status first to see available vehicles. This uses privId 4 and generates a credential based on the vehicle's position at a specific timestamp. Provide the tokenId and timestamp.",
    AttestationCreateVehiclePositionSchema.shape,
    async (args: z.infer<typeof AttestationCreateVehiclePositionSchema>) => {
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

      const attestResult = await authState.dimo!.attestation.createVehiclePositionVC({
        ...jwtResult.jwt,
        tokenId: args.tokenId,
        timestamp: args.timestamp
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

