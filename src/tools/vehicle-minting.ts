import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import type { AuthState, VehicleMintParams } from '../shared/types.js';
import { parseEventLogs } from 'viem';
import { initializeKernelSignerFromEnv } from "../helpers/kernel-signer.js";
import { getEnvConfig } from "../shared/config.js";

// Import ContractType from the transactions package
// Note: Importing the enum from the types
const ContractType = {
  DIMO_CREDIT: 0,
  DIMO_REGISTRY: 1,
  DIMO_VEHICLE_ID: 2,
  DIMO_SACD: 3,
  DIMO_TOKEN: 4,
  DIMO_FORWARDER: 5,
  DIMO_STAKING: 6,
  UNISWAP_V3_POOL: 7
} as const;

// Logging helper
function logInfo(message: string, data?: any) {
  console.error(JSON.stringify({
    level: "info",
    event: "vehicle_minting",
    message,
    ...(data && { data })
  }));
}

// Schemas
const VinMintSchema = z.object({
  vin: z.string().describe("Vehicle VIN to decode and mint"),
  countryCode: z.string().default("USA").describe("Country code for VIN decoding (default: USA)")
});

const DeviceDefinitionMintSchema = z.object({
  make: z.string().describe("Vehicle make (e.g., 'Toyota', 'Ford')"),
  model: z.string().describe("Vehicle model (e.g., 'Camry', 'F-150')"),
  year: z.number().describe("Vehicle year (e.g., 2023)")
});


// Helper function to wait for user operation receipt
async function waitForUserOperationReceipt(kernelSigner: any, userOperationHash: string) {
  try {
    logInfo("Waiting for user operation receipt", { userOperationHash });

    const client = await kernelSigner.getActiveClient();
    const txResult = await client.waitForUserOperationReceipt({
      hash: userOperationHash as `0x${string}`,
      timeout: 15000
    });

    logInfo('User operation receipt', txResult.receipt);

    return {
      success: true,
      receipt: txResult.receipt,
      logs: txResult.logs
    };
  } catch (error) {
    logInfo("Error waiting for user operation receipt", { error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Failed to wait for user operation receipt: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to mint a vehicle with VIN
async function mintVehicleWithVin(authState: AuthState, vin: string, countryCode: string = "USA") {
  try {
    if (!authState.kernelSigner) {
      throw new Error("KernelSigner not initialized. Please ensure all required environment variables are configured for auto-initialization.");
    }

    if (!authState.dimo || !authState.developerJwt) {
      throw new Error("DIMO not initialized or developer JWT not configured. Please ensure proper configuration.");
    }

    // Decode VIN first
    const vinDecoded = await authState.dimo.devicedefinitions.decodeVin({
      ...authState.developerJwt,
      vin: vin,
      countryCode: countryCode
    });

    if (!vinDecoded || !vinDecoded.data) {
      throw new Error(`Failed to decode VIN: ${vin}. Please check the VIN and try again.`);
    }

    const definition = vinDecoded.data.deviceDefinition;
    const walletAddress = await authState.kernelSigner.getAddress();

    logInfo('Minting vehicle with device definition', {
      manufacturerNode: Number(definition.manufacturer.tokenId),
      owner: walletAddress,
      deviceDefinitionID: definition.definitionId,
      attributeInfo: [
        {
          attribute: "Make",
          info: definition.make,
        },
        {
          attribute: "Model",
          info: definition.model,
        },
        {
          attribute: "Year",
          info: definition.year.toString(),
        }
      ],
    });

    // Mint the vehicle with device definition
    const response = await authState.kernelSigner.mintVehicleWithDeviceDefinition({
      manufacturerNode: BigInt(definition.manufacturer.tokenId),
      owner: walletAddress as `0x${string}`,
      deviceDefinitionID: definition.definitionId,
      attributeInfo: [
        {
          attribute: "Make",
          info: definition.make,
        },
        {
          attribute: "Model",
          info: definition.model,
        },
        {
          attribute: "Year",
          info: definition.year.toString(),
        }
      ]
    }, true);

    let userOperationHash = "";
    if (typeof response.userOpHash !== "string") {
      if (typeof response.userOpHash === "object" && response.userOpHash !== null) {
        userOperationHash = response.userOpHash["userOperationHash"] as `0x${string}`;
      }
    } else {
      userOperationHash = response.userOpHash;
    }

    if (!userOperationHash) {
      throw new Error("No user operation hash returned from minting transaction");
    }

    // Wait for user operation receipt
    const txResult = await waitForUserOperationReceipt(authState.kernelSigner, userOperationHash);

    // Parse event logs using proper ABI parsing
    const log = parseEventLogs({
      abi: authState.kernelSigner.contractMapping[ContractType.DIMO_REGISTRY].abi,
      logs: txResult.logs,
      eventName: "VehicleNodeMintedWithDeviceDefinition",
    })[0];

    logInfo('User operation log', log);

    if (!log) {
      throw new Error("No event logs found");
    }

    const event = (log as any).args as {
      manufacturerId: BigInt;
      vehicleId: BigInt;
      owner: `0x${string}`;
      deviceDefinitionId: string;
    };

    const vehicleId = event.vehicleId;

    logInfo('Vehicle minted successfully', {
      vin,
      vehicleId: vehicleId.toString()
    });

    return {
      success: true,
      userOperationHash,
      receipt: txResult.receipt,
      vehicleId,
      vehicle: {
        make: definition.make,
        model: definition.model,
        year: definition.year,
        vin: vin
      },
      decodedVin: vinDecoded.data
    };
  } catch (error) {
    throw new Error(`Failed to mint vehicle with VIN: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to mint a vehicle with device definition (make/model/year)
async function mintVehicleWithDeviceDefinition(authState: AuthState, make: string, model: string, year: number) {
  try {
    if (!authState.kernelSigner) {
      throw new Error("KernelSigner not initialized. Please ensure all required environment variables are configured for auto-initialization.");
    }

    if (!authState.dimo) {
      throw new Error("DIMO not initialized. Please ensure proper configuration.");
    }

    if (!authState.userOAuthToken) {
      throw new Error("I dont know who you are, please login so i can get your address..");
    }

    // Search for device definition
    const searchResults = await authState.dimo.devicedefinitions.search({
      makeSlug: make.toLowerCase(),
      model: model,
      year: year
    });

    if (!searchResults || !searchResults.data || searchResults.data.length === 0) {
      throw new Error(`No device definition found for ${make} ${model} ${year}. Please check your vehicle information.`);
    }

    // Use the first matching result
    const definition = searchResults.data[0];
    const walletAddress = authState.userOAuthToken?.address;

    logInfo('Minting vehicle with device definition', {
      manufacturerNode: Number(definition.manufacturer.tokenId),
      owner: walletAddress,
      deviceDefinitionID: definition.definitionId,
      attributeInfo: [
        {
          attribute: "Make",
          info: definition.make,
        },
        {
          attribute: "Model",
          info: definition.model,
        },
        {
          attribute: "Year",
          info: definition.year.toString(),
        }
      ],
    });

    // Mint the vehicle with device definition
    const response = await authState.kernelSigner.mintVehicleWithDeviceDefinition({
      manufacturerNode: BigInt(definition.manufacturer.tokenId),
      owner: walletAddress as `0x${string}`,
      deviceDefinitionID: definition.definitionId,
      attributeInfo: [
        {
          attribute: "Make",
          info: definition.make,
        },
        {
          attribute: "Model",
          info: definition.model,
        },
        {
          attribute: "Year",
          info: definition.year.toString(),
        }
      ]
    }, true);

    let userOperationHash = "";
    if (typeof response.userOpHash !== "string") {
      if (typeof response.userOpHash === "object" && response.userOpHash !== null) {
        userOperationHash = response.userOpHash["userOperationHash"] as `0x${string}`;
      }
    } else {
      userOperationHash = response.userOpHash;
    }

    if (!userOperationHash) {
      throw new Error("No user operation hash returned from minting transaction");
    }

    // Wait for user operation receipt
    const txResult = await waitForUserOperationReceipt(authState.kernelSigner, userOperationHash);

    // Parse event logs using proper ABI parsing
    const log = parseEventLogs({
      abi: authState.kernelSigner.contractMapping[ContractType.DIMO_REGISTRY].abi,
      logs: txResult.logs,
      eventName: "VehicleNodeMintedWithDeviceDefinition",
    })[0];

    logInfo('User operation log', log);

    if (!log) {
      throw new Error("No event logs found");
    }

    const event = (log as any).args as {
      manufacturerId: BigInt;
      vehicleId: BigInt;
      owner: `0x${string}`;
      deviceDefinitionId: string;
    };

    const vehicleId = event.vehicleId;

    logInfo('Vehicle minted successfully', {
      make,
      model,
      year,
      vehicleId: vehicleId.toString()
    });

    return {
      success: true,
      userOperationHash,
      receipt: txResult.receipt,
      vehicleId,
      vehicle: {
        make: make,
        model: model,
        year: year
      },
      deviceDefinition: definition
    };
  } catch (error) {
    throw new Error(`Failed to mint vehicle with device definition: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function registerVehicleMintingTools(server: McpServer, authState: AuthState) {

  // Mint vehicle with VIN tool
  server.tool(
    "mint_vehicle_with_vin",
    "Mint a new vehicle NFT by providing a VIN. The VIN will be decoded to extract vehicle information and device definition. **Prerequisites:** KernelSigner is auto-initialized on server startup if environment variables are configured.",
    VinMintSchema.shape,
    async (args: z.infer<typeof VinMintSchema>) => {
      try {
        const result = await mintVehicleWithVin(authState, args.vin, args.countryCode);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: result.success,
              message: "Vehicle minted successfully with VIN",
              userOperationHash: result.userOperationHash,
              vehicleId: result.vehicleId,
              vehicle: result.vehicle,
              decodedVin: result.decodedVin
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: `Failed to mint vehicle with VIN: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // Mint vehicle with device definition tool
  server.tool(
    "mint_vehicle_with_device_definition",
    "Mint a new vehicle NFT by providing make, model, and year. The system will search for the appropriate device definition. **Prerequisites:** KernelSigner is auto-initialized on server startup if environment variables are configured.",
    DeviceDefinitionMintSchema.shape,
    async (args: z.infer<typeof DeviceDefinitionMintSchema>) => {
      try {
        const result = await mintVehicleWithDeviceDefinition(authState, args.make, args.model, args.year);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: result.success,
              message: "Vehicle minted successfully with device definition",
              userOperationHash: result.userOperationHash,
              vehicleId: result.vehicleId,
              vehicle: result.vehicle,
              deviceDefinition: result.deviceDefinition
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: `Failed to mint vehicle with device definition: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

}
