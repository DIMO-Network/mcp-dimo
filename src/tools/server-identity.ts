import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import {
  generateVehicleDataSharingUrl,
  VehicleDataSharingConfigSchema,
  initOAuthServer,
  type StoredOAuthToken
} from '../helpers/oauth.js';
import type { AuthState, ServerIdentityInfo } from '../shared/types.js';
import { getEnvConfig } from '../shared/config.js';
import { vehiclesSharedWithAgent, currentUserVehiclesSharedWithAgent } from '../helpers/identity-queries.js';

const DeveloperLicenseInfoSchema = z.object({});
const LocalOAuthServerSchema = z.object({
  port: z.number().optional().default(3333)
});

const VehicleDataSharingUrlSchema = z.object({
  permissionTemplateId: z.number().optional().default(1),
});

export function registerServerIdentityTools(server: McpServer, authState: AuthState) {

  // Prompt: About this vehicle data agent
  server.prompt(
    "Vehicle Genius",
    "Get information about Vehicle Genius and its capabilities as your personal vehicle assistant",
    async () => {
      const config = getEnvConfig();

      return {
        description: "Vehicle Genius - Your Personal Vehicle Assistant",
        messages: [
          {
            role: "assistant",
            content: {
              type: "text",
              text: `I am Vehicle Genius, your personal assistant for all things vehicle related, powered by Claude and connected to the DIMO network.

## What I am:
- Your personal AI assistant specialized in vehicle data, analysis, and control
- Connected to the DIMO (Digital Infrastructure for Mobility) ecosystem
- I have assumed the identity of developer: ${config.clientId}

## What I can do:
- **Identity & Access**: Check vehicle access, manage OAuth authentication, view developer license status
- **Vehicle Data**: Query real-time and historical vehicle telemetry (location, speed, engine data, etc.)
- **Vehicle Search**: Find vehicle definitions, makes, models, and specifications
- **Vehicle Commands**: Control compatible vehicles (lock/unlock doors, start/stop charging)
- **Credentials**: Create verifiable credentials for vehicles (Proof of Movement, VIN attestations)
- **Data Analysis**: Help analyze patterns, generate insights from vehicle data

## How I work:
- I use the DIMO GraphQL APIs to access identity and telemetry data
- All data access respects user permissions and privacy controls
- I can work with vehicles you own or data shared with this developer license
- Commands and data access require proper authentication and vehicle permissions

## Getting Started:
Ask me questions about DIMO, authenticate to share your vehicles with me, or explore vehicle data that's already been shared with this developer license.

Ready to be your personal guide to the world of connected vehicle data!`
            }
          }
        ]
      };
    }
  );

  // Prompt: Fleet Manager About
  server.prompt(
    "Fleet Manager",
    "Get information about Vehicle Genius and its capabilities as your fleet management assistant",
    async () => {
      const config = getEnvConfig();

      return {
        description: "Vehicle Genius - Your Fleet Management Assistant",
        messages: [
          {
            role: "assistant",
            content: {
              type: "text",
              text: `I am Vehicle Genius, your fleet management assistant, powered by Claude and connected to the DIMO network to help you efficiently manage and monitor your entire vehicle fleet.

## What I am:
- Your dedicated AI assistant specialized in fleet management, monitoring, and optimization
- Connected to the DIMO (Digital Infrastructure for Mobility) ecosystem
- I have assumed the identity of developer: ${config.clientId}

## What I can do for your fleet:
- **Fleet Overview**: Monitor vehicle access status, authentication, and permissions across your entire fleet
- **Fleet Telemetry**: Query real-time and historical data from all vehicles (location, speed, engine diagnostics, fuel efficiency, etc.)
- **Vehicle Search & Discovery**: Find and manage vehicle definitions, makes, models, and specifications for fleet planning
- **Fleet Commands**: Control compatible vehicles across your fleet (lock/unlock doors, start/stop charging, remote diagnostics)
- **Fleet Credentials**: Create and manage verifiable credentials for fleet vehicles (Proof of Movement, VIN attestations)
- **Fleet Analytics**: Analyze patterns, generate insights, and create reports from fleet-wide vehicle data
- **Cost Optimization**: Help identify fuel efficiency trends, maintenance needs, and operational improvements
- **Compliance & Reporting**: Generate fleet reports for regulatory compliance and business intelligence

## How I help manage your fleet:
- I use the DIMO GraphQL APIs to access identity and telemetry data from all your vehicles
- All data access respects vehicle permissions and privacy controls
- I can work with vehicles in your fleet or additional data shared with this developer license
- Fleet commands and data access require proper authentication and vehicle permissions
- I provide fleet-wide insights and individual vehicle details as needed

## Getting Started with Fleet Management:
Authenticate to connect your fleet vehicles with me, ask me to analyze fleet performance, generate fleet reports, or explore operational insights from your connected vehicle data.

Ready to help you optimize and manage your vehicle fleet with data-driven insights!`
            }
          }
        ]
      };
    }
  );

  // Tool: Vehicle Access Status
  server.tool(
    "check_vehicle_access_status",
    "Check the current status of vehicles sharing data with this developer license. **ALWAYS call this tool first** to understand what vehicles are available before attempting any vehicle operations. This tool shows which vehicles have granted access to their data, including the total count of vehicles sharing data with your developer license and, if you're authenticated, how many of your own vehicles are sharing data. Use this tool to understand your current vehicle data access permissions and see what vehicles you can query or control.",
    DeveloperLicenseInfoSchema.shape,
    async (args: z.infer<typeof DeveloperLicenseInfoSchema>) => {
      try {
        const config = getEnvConfig();

        const vehicleInfo = await vehiclesSharedWithAgent(config.clientId);
        let yourVehicleInfo;
        if (authState.userOAuthToken && authState.userOAuthToken.address) {
          yourVehicleInfo = await currentUserVehiclesSharedWithAgent(
            config.clientId,
            authState.userOAuthToken.address
          );
        }

        const licenseInfo: ServerIdentityInfo = {
          clientId: config.clientId,
          totalVehiclesWithAccess: vehicleInfo?.totalVehiclesWithAccess,
          isUserLoggedIn: authState.userOAuthToken ? true : false,
          totalOfYourVehiclesWithAccess: yourVehicleInfo?.totalVehiclesWithAccess,
          vehicles: yourVehicleInfo?.vehicles
        };

        // Return different messages based on fleet mode and user login status
        if (config.FLEET_MODE) {
          // Fleet mode enabled - provide guidance for finding vehicles via Identity API
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                ...licenseInfo,
                summary: `Fleet mode enabled - Acting as developer license ${config.clientId} with access to ${vehicleInfo.totalVehiclesWithAccess || 0} vehicles`,
                fleetMode: true,
                message: `Fleet mode is enabled, which allows access to any vehicle shared with this developer license without ownership validation. To find specific vehicles to work with:

1. **Call identity_introspect** to understand the schema structure
2. **Use identity_query** to search for vehicles with proper GraphQL syntax:

**Query vehicles shared with this developer license:**
\`\`\`graphql
{
  vehicles(first: 100 filterBy: {privileged: $clientId} ) {
    nodes {
      tokenId
      tokenDID
      name
      mintedAt
      manufacturer {
        name
      }
      definition {
        make
        model
        year
      }
    }
  }
}
\`\`\`

**Variables:**
\`\`\`json
{"clientId": "${config.clientId}"}
\`\`\`

**Query specific vehicle by tokenId:**
\`\`\`graphql
{
  vehicle(tokenId: $tokenId) {
    tokenId
    owner
    definition {
      make
      model
      year
    }
  }
}
\`\`\`

You can then use any tokenId found in the results for telemetry queries or vehicle commands.`,
                availableVehicles: vehicleInfo.totalVehiclesWithAccess || 0,
                userAuthenticated: !!authState.userOAuthToken
              }, null, 2)
            }]
          };
        } else if (!authState.userOAuthToken) {
          // User is not logged in
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                ...licenseInfo,
                summary: `Acting as developer license ${config.clientId} with access to ${vehicleInfo.totalVehiclesWithAccess || 0} vehicles`,
                message: "I can access vehicle data that has been shared with this developer license, but you haven't authenticated yet, so i dont know who you are. Would you like to authenticate to share one of your vehicles with me? Use the init_oauth tool to start the authentication process."
              }, null, 2)
            }]
          };
        } else {
          // User is logged in
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                ...licenseInfo,
                summary: `Acting as developer license ${config.clientId} with access to ${vehicleInfo.totalVehiclesWithAccess || 0} vehicles`,
                message: authState.userOAuthToken.address ?
                  (yourVehicleInfo && yourVehicleInfo.totalVehiclesWithAccess === 0
                    ? `You are authenticated (wallet: ${authState.userOAuthToken.address}) but haven't shared any vehicles with me yet. You can share vehicles through the DIMO app to grant me access to your vehicle data.`
                    : `You are authenticated (wallet: ${authState.userOAuthToken.address}) and have shared ${yourVehicleInfo?.totalVehiclesWithAccess || 0} vehicle(s) with me. I can access data from ${vehicleInfo.totalVehiclesWithAccess || 0} total vehicles through this developer license.`
                  ) :
                  "You are authenticated but I couldn't determine your wallet address. Please try re-authenticating with init_oauth."
              }, null, 2)
            }]
          };
        }
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: `Failed to get developer license information: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );
  // Local OAuth server tool
  server.tool(
    "init_oauth",
    "Initialize OAuth flow with a temporary local HTTP server to automatically handle the callback. This starts a local server, opens the OAuth URL, and automatically completes the flow when the user authenticates.",
    LocalOAuthServerSchema.shape,
    async (args: z.infer<typeof LocalOAuthServerSchema>) => {
      const { port } = args;
      const config = getEnvConfig();

      // Callback to handle successful token reception
      const onTokenReceived = (token: StoredOAuthToken) => {
        authState.userOAuthToken = token;
      };

      return initOAuthServer(port, config, onTokenReceived);
    }
  );

  // Vehicle data sharing URL tool
  server.tool(
    "generate_vehicle_data_sharing_url",
    "Generate a URL for users to share their vehicle data with this developer license. This creates a DIMO login URL with specific parameters for data sharing permissions, including permission template ID and optional vehicle make filters. Users can visit this URL to authenticate and grant access to their vehicle data.",
    VehicleDataSharingUrlSchema.shape,
    async (args: z.infer<typeof VehicleDataSharingUrlSchema>) => {
      try {
        const config = getEnvConfig();
        const parsedConfig = VehicleDataSharingConfigSchema.parse(config);
        const sharingUrl = generateVehicleDataSharingUrl(parsedConfig, args.permissionTemplateId?.toString());

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              url: sharingUrl,
              instructions: "Share this URL with users who want to grant access to their vehicle data. After visiting this URL and authenticating, their vehicles will be accessible through this developer license.",
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: `Failed to generate vehicle data sharing URL: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

}
