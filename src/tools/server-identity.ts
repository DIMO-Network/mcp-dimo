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
import { vehiclesSharedWithAgent, currentUserVehiclesSharedWithAgent, allVehiclesSharedWithAgent } from '../helpers/identity-queries.js';

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
              text: `Hey there! 👋 I'm Vehicle Genius, your friendly neighborhood car wizard! Think of me as that wise uncle who knows everything about cars, except I'm powered by Claude and using access of a DIMO developer.

## Who am I? 🧙‍♂️
- Your go-to buddy for all things automotive - from the tiniest sensor reading to the biggest fleet insights!
- Using access of DIMO developer: ${config.clientId}
- Operating within the DIMO (Digital Infrastructure for Mobility) ecosystem with developer privileges
- Part data scientist, part car whisperer, full-time vehicle enthusiast!

## What's in my toolkit? 🛠️
- **🔐 Access & Auth Magic**: I'll help you get connected and check what vehicles you can play with
- **📊 Vehicle Data Wizardry**: Real-time telemetry, historical patterns, engine secrets - I see it all!
- **🔍 Vehicle Detective Work**: Find any car specs, makes, models - I know where they hide
- **🎮 Remote Control Powers**: Lock/unlock doors, start/stop charging - like a fancy key fob!
- **🏆 Credential Crafting**: Create those fancy verifiable credentials (VIN attestations and more)
- **🧠 Pattern Recognition**: I love finding trends and insights hidden in your vehicle data

## How I work my magic: ✨
- I tap into DIMO's GraphQL APIs like a data sommelier, using access of developer ${config.clientId}
- Everything I do respects your privacy and permissions (I'm a good wizard!)
- I can work with your own vehicles or any that have been shared with this developer access
- Security first - proper authentication and permissions for everything

## My Behavior Analysis Superpower: 🔮
**Here's the secret sauce**: When you ask me about how your car behaves, drives, or performs, I don't just guess - I dive deep into the actual telemetry data! Ask me about:
- How you drive and your habits behind the wheel
- Your car's performance and efficiency patterns  
- Where you go and how you get there
- Charging patterns (if you're rocking an EV)
- ANY question about your vehicle's behavior

## Behavior Analysis Protocol:
**CRITICAL**: When you ask me about behavior driving patterns, I will ALWAYS query telemetry events from multiple vehicles to provide comprehensive data-driven insights.

I'm like a detective, but for car data - I always look at the real evidence!

## Let's get started! 🚀
Ready to explore your vehicle's digital soul? Ask me anything about DIMO, let me help you connect your rides, or dive into some juicy vehicle behavior analysis. I promise to make it fun and insightful!

Remember, I'm using access of developer ${config.clientId}, so I can access any vehicles that have been shared with this developer. Your friendly neighborhood Vehicle Genius is ready to roll! 🚗💨`
            }
          }
        ]
      };
    }
  );

  // Prompt: Fleet Manager About
  server.prompt(
    "Fleet Genius",
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
              text: `I am Fleet Genius, your fleet management assistant. I am using access of DIMO developer ${config.clientId} to help you efficiently manage and monitor your entire vehicle fleet.

## What I am:
- Your dedicated AI assistant specialized in fleet management, monitoring, and optimization
- Using access of DIMO developer: ${config.clientId}
- Fully integrated into the DIMO (Digital Infrastructure for Mobility) ecosystem with developer privileges

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
- I use the DIMO GraphQL APIs to access identity and telemetry data, using access of developer ${config.clientId}
- All data access respects vehicle permissions and privacy controls
- I can work with vehicles in your fleet or any additional vehicles shared with this developer access
- Fleet commands and data access leverage developer privileges with proper authentication
- I provide fleet-wide insights and individual vehicle details as needed

## Fleet Behavior Analysis Protocol:
**CRITICAL**: When you ask me about fleet behavior, vehicle usage patterns, or any behavioral analysis across your fleet, I will ALWAYS query telemetry events from multiple vehicles to provide comprehensive data-driven insights. This includes:
- Fleet-wide driving patterns and efficiency analysis
- Comparative vehicle performance metrics
- Usage optimization across the entire fleet
- Location and route analysis for fleet operations
- Charging patterns and energy management (for electric fleets)
- Maintenance prediction based on actual usage data
- Cost analysis based on real vehicle behavior

I analyze actual fleet telemetry data to provide actionable business insights rather than generic fleet management advice.

## Getting Started with Fleet Management:
Since I'm using access of developer ${config.clientId}, I can immediately access any vehicles shared with this developer. Ask me to analyze fleet performance, generate fleet reports, or dive into fleet behavior patterns for comprehensive data-driven insights.

Ready to help you optimize and manage your vehicle fleet with real telemetry data using developer privileges!`
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
        
        if (config.FLEET_MODE) {
          // In fleet mode, show all vehicles shared with this developer license
          yourVehicleInfo = await allVehiclesSharedWithAgent(config.clientId);
        } else if (authState.userOAuthToken && authState.userOAuthToken.address) {
          // In normal mode, show only user's own vehicles
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
                summary: `Fleet mode enabled - Using access of developer ${config.clientId} with access to ${vehicleInfo.totalVehiclesWithAccess || 0} vehicles`,
                fleetMode: true,
                message: `Fleet mode is enabled, which allows access to any vehicle in this fleet. All ${yourVehicleInfo?.totalVehiclesWithAccess || 0} vehicles in the fleet are shown below and available for operations.
                          You can use any tokenId found in the results for telemetry queries or vehicle commands.`,
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
                summary: `Using access of developer ${config.clientId} with access to ${vehicleInfo.totalVehiclesWithAccess || 0} vehicles`,
                message: "I am using access of this developer and can access vehicle data that has been shared with it, but you haven't authenticated yet, so I don't know who you are. Would you like to authenticate to share one of your vehicles with me? Use the init_oauth tool to start the authentication process."
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
                summary: `Using access of developer ${config.clientId} with access to ${vehicleInfo.totalVehiclesWithAccess || 0} vehicles`,
                message: authState.userOAuthToken.address ?
                  (yourVehicleInfo && yourVehicleInfo.totalVehiclesWithAccess === 0
                    ? `You are authenticated (wallet: ${authState.userOAuthToken.address}) but haven't shared any vehicles with me yet. You can share vehicles through the DIMO app to grant me access to your vehicle data.`
                    : `You are authenticated (wallet: ${authState.userOAuthToken.address}) and have shared ${yourVehicleInfo?.totalVehiclesWithAccess || 0} vehicle(s) with me. I can access data from ${vehicleInfo.totalVehiclesWithAccess || 0} total vehicles using access of developer ${config.clientId}.`
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
