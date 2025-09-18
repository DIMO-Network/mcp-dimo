#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DIMO } from '@dimo-network/data-sdk';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Shared utilities
import type { AuthState } from './shared/types.js';
import { getEnvConfig } from './shared/config.js';
import { getDeveloperJWT } from './helpers/developer-jwt.js';

// Tool modules
import { registerServerIdentityTools } from './tools/server-identity.js';
import { registerVehicleDataTools } from './tools/vehicle-data.js';
import { registerVehicleCommandTools } from './tools/vehicle-commands.js';
import { registerUtilityTools } from './tools/utilities.js';
import { registerAttestationTools } from './tools/attestations.js';

// Initialize auth state
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

// Main function to start the server
async function main() {
  // Initialize DIMO with Production environment
  authState.dimo = new DIMO("Production");

  // Get environment configuration
  let config;
  try {
    config = getEnvConfig();
  } catch (error) {
    console.error(JSON.stringify({
      level: "warn",
      event: "no_client_id",
      message: "DIMO_CLIENT_ID is required. Please configure your DIMO credentials."
    }));
    const transport = new StdioServerTransport();
    await server.connect(transport);
    return;
  }

  // Set up developer JWT if credentials are available
  try {
    authState.developerJwt = await getDeveloperJWT(authState.dimo, {
      clientId: config.clientId,
      domain: config.domain!,
      privateKey: config.privateKey!
    });
    console.error(JSON.stringify({
      level: "info",
      event: "dimo_dev_jwt_success",
      message: "Developer JWT configured successfully"
    }));
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "dimo_dev_jwt_failed",
      message: "Failed to configure developer JWT",
      error: error instanceof Error ? error.message : String(error)
    }));
  }

  // Log authentication status
  const hasDevJwt = !!authState.developerJwt;
  
  if (hasDevJwt) {
    console.error(JSON.stringify({
      level: "info",
      event: "auth_configured",
      message: "Developer JWT configured. Ready for DIMO operations."
    }));
  } else {
    console.error(JSON.stringify({
      level: "warn",
      event: "no_dev_jwt",
      message: "Developer JWT not configured. Please provide credentials (DIMO_DOMAIN, DIMO_PRIVATE_KEY)."
    }));
  }

  // Register tools from each module
  registerServerIdentityTools(server, authState);
  registerVehicleDataTools(server, authState);  
  registerVehicleCommandTools(server, authState);
  registerUtilityTools(server, authState);
  registerAttestationTools(server, authState);
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Handle errors
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});