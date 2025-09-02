# DIMO MCP Server

An MCP (Model Context Protocol) server that provides seamless access to the DIMO Network APIs, enabling AI assistants to query vehicle data, decode VINs, create verifiable credentials, and interact with the DIMO ecosystem.

## Overview

This server acts as a bridge between AI assistants and DIMO's vehicle data network, providing:
- Direct access to DIMO's GraphQL APIs (Identity and Telemetry)
- Automatic JWT token management for authenticated endpoints
- VIN decoding and vehicle information lookup
- Verifiable credential creation (Proof of Movement and VIN credentials)
- Schema introspection for both APIs

## Features

### 🆔 Server Identity & Authentication

#### `developer_license_info`
**Get current identity and authorization status of this DIMO MCP server instance.**

This tool provides essential context about who the MCP server is acting as within the DIMO ecosystem. It tells you your developer license identity, authentication status, and vehicle access summary.

**Provides:**
- **Developer Identity**: Client ID of the developer license you represent
- **Authentication Status**: OAuth and Developer JWT configuration status  
- **Vehicle Access Summary**: Total number of vehicles currently sharing data with your license
- **Vehicle List**: Details of accessible vehicles (first 5 shown)
- **Authorization Context**: Whether users need to complete OAuth flow for vehicle access
- **Identity Context**: Clear "who am I" summary for Claude

Use this tool when you need to understand your identity context for DIMO operations.

**Example:**
```javascript
{
  "tool": "developer_license_info",
  "arguments": {}
}
```

**GraphQL Query Used:**
```graphql
{
  vehicles(filterBy: {privileged: "0x106C8EcD7793842DfD31E0D86C31900c1C722f60"} first: 10) {
    totalCount
  }
}
```

**Sample Response:**
```json
{
  "clientId": "0xE40AEc6f45e854b2E0cDa20624732F16AA029Ae7",
  "isAuthenticated": true,
  "oauthConfigured": true,
  "developerJwtConfigured": true,
  "totalVehiclesWithAccess": 3,
  "summary": "Acting as developer license 0xE40AEc6f45e854b2E0cDa20624732F16AA029Ae7 with access to 3 vehicles",
  "identity_context": {
    "who_am_i": "DIMO Developer License 0xE40AEc6f45e854b2E0cDa20624732F16AA029Ae7",
    "authentication_status": "Authenticated",
    "oauth_status": "User Authorized",
    "vehicle_access_count": 3
  }
}
```

### 🔍 GraphQL Query Tools

#### `identity_query`
Query the DIMO Identity GraphQL API for public identity data such as users, devices, and vehicles. No authentication required.

**Example:**
```graphql
{
  vehicles(first: 10) {
    nodes {
      id
      tokenId
      make
      model
      year
    }
  }
}
```

#### `telemetry_query`
Query the DIMO Telemetry GraphQL API for real-time or historical vehicle data. Automatically handles authentication with appropriate privileges.

**Parameters:**
- `query`: GraphQL query string
- `variables`: Optional query variables
- `tokenId`: Vehicle token ID (required)

**Example:**
```graphql
{
  vehicle(tokenId: 12345) {
    signalsLatest {
      speed {
        value
        timestamp
      }
      batteryLevel {
        value
        timestamp
      }
    }
  }
}
```

#### `vin_decode`
Decode a VIN string to get make, model, year, and other vehicle details.

**Parameters:**
- `vin`: VIN string to decode (required)
- `countryCode`: Country code for decoding (optional, default: "USA")

#### `search_vehicles`
Search for vehicle definitions and information in DIMO. Filter by make, model, year, or free-text query.

**Parameters:**
- `query`: Free-text search
- `make`: Filter by make (e.g., "tesla", "ford")
- `year`: Filter by year
- `model`: Filter by model

### 🔐 Access & Permissions

#### `check_vehicle_access`
Check if the developer license has access to vehicles. Verifies OAuth flow completion.

#### `check_vehicle_permissions`
Get detailed information about what specific permissions (privileges) the developer currently has on vehicles using the SACD system.

**Parameters:**
- `tokenId`: Optional vehicle token ID to check permissions for
- `userAddress`: Optional user address to filter by vehicle owner

### 🚗 Vehicle Commands

#### `lock_doors`
Lock the doors of a vehicle. Requires vehicle access privileges.

#### `unlock_doors`
Unlock the doors of a vehicle. Requires vehicle access privileges.

#### `start_charge`
Start charging an electric vehicle. Requires vehicle access privileges.

#### `stop_charge`
Stop charging an electric vehicle. Requires vehicle access privileges.

### 🔧 Utilities

### 🏆 Verifiable Credentials

#### `attestation_create`
Create verifiable credentials for vehicles to prove activity or identity.

**Parameters:**
- `tokenId`: Vehicle token ID
- `type`: Credential type ("vin" for VIN credential)
- `force`: Force creation even if one exists (optional, default: false)

### 📋 Schema Introspection

#### `identity_introspect`
Get the complete GraphQL schema for the Identity API to discover available queries and types.

#### `telemetry_introspect`
Get the complete GraphQL schema for the Telemetry API to discover available queries and types.

## Prerequisites

- Node.js 16 or higher
- DIMO Developer License from [DIMO Developer Console](https://console.dimo.org/)
- Valid API credentials (client ID, domain, and private key)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd dimo-mcp-server

# Install dependencies
npm install

# Build the project (if using TypeScript)
npm run build
```

## Configuration

### Environment Variables

Create a `.env` file or set the following environment variables:

#### User Authorization (OAuth)
```bash
# Required for user authorization via browser popup
DIMO_CLIENT_ID=0xE40AEc6f45e854b2E0cDa20624732F16AA029Ae7
DIMO_REDIRECT_URI=https://spoofproof.replit.app

# Optional OAuth settings (with defaults)
DIMO_LOGIN_BASE_URL=https://login.dimo.org
DIMO_ENTRY_STATE=LOGOUT
```

#### System Authentication (Developer JWT)
```bash
# Required for API calls (system-level authentication)
DIMO_CLIENT_ID=your_client_id
DIMO_DOMAIN=your_domain.com
DIMO_PRIVATE_KEY=your_private_key_here
```

#### Full Configuration (Recommended)
```bash
# User authorization
DIMO_CLIENT_ID=0xE40AEc6f45e854b2E0cDa20624732F16AA029Ae7
DIMO_REDIRECT_URI=https://spoofproof.replit.app

# System authentication (same CLIENT_ID, different credentials)
DIMO_DOMAIN=your_domain.com
DIMO_PRIVATE_KEY=your_private_key_here
```

#### Additional Settings
```bash
# Additional headers for GraphQL requests (optional)
HEADERS={"X-Custom-Header": "value"}
```

### MCP Client Configuration

#### For Claude Desktop

Add to your configuration file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Full Configuration (Recommended):**
```json
{
  "mcpServers": {
    "dimo": {
      "command": "node",
      "args": ["/path/to/dimo-mcp-server/index.js"],
      "env": {
        "DIMO_CLIENT_ID": "0xE40AEc6f45e854b2E0cDa20624732F16AA029Ae7",
        "DIMO_REDIRECT_URI": "https://spoofproof.replit.app",
        "DIMO_DOMAIN": "your_domain.com",
        "DIMO_PRIVATE_KEY": "your_private_key"
      }
    }
  }
}
```

**Developer JWT Only (No User Authorization):**
```json
{
  "mcpServers": {
    "dimo": {
      "command": "node",
      "args": ["/path/to/dimo-mcp-server/index.js"],
      "env": {
        "DIMO_CLIENT_ID": "your_client_id",
        "DIMO_DOMAIN": "your_domain.com",
        "DIMO_PRIVATE_KEY": "your_private_key"
      }
    }
  }
}
```

## Usage Examples

### 1. Query Public Vehicle Data
```javascript
// Use identity_query tool
{
  "query": "{ vehicles(first: 5) { nodes { tokenId make model year } } }"
}
```

### 2. Get Vehicle Telemetry
```javascript
// Use telemetry_query tool
{
  "tokenId": 12345,
  "query": "{ vehicle(tokenId: 12345) { signalsLatest { speed { value } } } }"
}
```

### 3. Decode a VIN
```javascript
// Use vin_operations tool
{
  "operation": "decode",
  "vin": "1HGCM82633A123456"
}
```

### 5. Search for Tesla Vehicles
```javascript
// Use search_vehicles tool
{
  "makeSlug": "tesla",
  "year": 2023
}
```

## Authentication Flow

The DIMO MCP server uses a two-tier authentication system that separates user consent from system API access:

### 1. User Authorization (OAuth)

**Purpose:** Users grant the MCP server permission to access their DIMO account and vehicle data.

**When needed:** Required for accessing user-specific data like vehicle telemetry, sending vehicle commands, or creating attestations.

Users grant access to their DIMO account through OAuth popup authentication:

#### New OAuth Tools

##### `oauth_init`
Initialize user authorization flow. Returns an OAuth URL for users to grant access to their DIMO account.

**Example:**
```javascript
{
  "tool": "oauth_init",
  "arguments": {}
}
```

##### `oauth_callback`
Complete user authorization by processing the callback URL after the user grants access.

**Parameters:**
- `callbackUrl`: The full URL you were redirected to after granting access

**Example:**
```javascript
{
  "tool": "oauth_callback",
  "arguments": {
    "callbackUrl": "https://spoofproof.replit.app?code=AUTH_CODE&state=STATE"
  }
}
```

##### `oauth_status`
Check current user authorization status, system authentication configuration, and optionally verify access to a specific vehicle.

**Parameters:**
- `verifyVehicleAccess`: Optional vehicle token ID to verify access to

**Example:**
```javascript
// Basic status check
{
  "tool": "oauth_status",
  "arguments": {}
}

// Verify access to specific vehicle
{
  "tool": "oauth_status",
  "arguments": {
    "verifyVehicleAccess": 12345
  }
}
```

##### `check_vehicle_access`
Verify developer license access to vehicles by querying the DIMO Identity API with the correct `privileged` filter. This confirms that the OAuth authorization flow has been completed successfully by checking actual API access.

**Parameters:**
- `tokenId`: Optional specific vehicle token ID to check access for  
- `userAddress`: Optional user address to filter by vehicle owner

**Examples:**
```javascript
// Check access to all vehicles privileged to the developer license
{
  "tool": "check_vehicle_access",
  "arguments": {}
}

// Check access to a specific vehicle
{
  "tool": "check_vehicle_access", 
  "arguments": {
    "tokenId": 12345
  }
}

// Check access for a specific user's vehicles
{
  "tool": "check_vehicle_access",
  "arguments": {
    "userAddress": "0x1234567890123456789012345678901234567890"
  }
}
```

**GraphQL Query Used:**
```graphql
{
  vehicles(filterBy: {privileged: "env.DIMO_CLIENT_ID", owner: "userAddress"} first: 10) {
    totalCount
    nodes {
      id
      tokenId
      owner
      make
      model
      year
    }
  }
}
```

##### `check_vehicle_permissions`
Get detailed information about what specific permissions (privileges) the developer currently has on vehicles using the SACD (Service Access Contract Definition) system. This provides a comprehensive view of granted privileges with human-readable descriptions.

**Parameters:**
- `tokenId`: Optional specific vehicle token ID to check permissions for
- `userAddress`: Optional user address to filter by vehicle owner

**Examples:**
```javascript
// Check permissions on all accessible vehicles
{
  "tool": "check_vehicle_permissions",
  "arguments": {}
}

// Check permissions on a specific vehicle
{
  "tool": "check_vehicle_permissions",
  "arguments": {
    "tokenId": 12345
  }
}

// Check permissions for a specific user's vehicles
{
  "tool": "check_vehicle_permissions",
  "arguments": {
    "userAddress": "0x1234567890123456789012345678901234567890"
  }
}
```

**Privilege Definitions (from [DIMO SACD Documentation](https://docs.dimo.org/developer-platform/developer-guide/permissions-contract-sacd)):**
- **Privilege 1**: All-time, non-location data
- **Privilege 2**: Commands (send commands to vehicle)
- **Privilege 3**: Current location data
- **Privilege 4**: All-time location data (historical)
- **Privilege 5**: View VIN credentials
- **Privilege 6**: Live data streams
- **Privilege 7**: Raw data access
- **Privilege 8**: Approximate location data

**Sample Response:**
```json
{
  "hasAccess": true,
  "totalCount": 2,
  "vehicles": [
    {
      "tokenId": 12345,
      "owner": "0x...",
      "make": "Tesla",
      "model": "Model 3",
      "year": 2023,
      "privileges": {
        "translated": [
          {"id": 1, "name": "Non-Location Data", "description": "All-time, non-location data"},
          {"id": 2, "name": "Commands", "description": "Send commands to the vehicle"},
          {"id": 3, "name": "Current Location", "description": "View current location data"}
        ],
        "count": 3
      }
    }
  ]
}
```

#### OAuth Flow Verification

The server now provides **two-part verification** to ensure OAuth authentication is working correctly:

1. **Token Verification**: Checks if user has completed OAuth flow and has a valid token
2. **API Access Verification**: Queries the DIMO Identity API to confirm the developer license actually has access to specified vehicles

This addresses the requirement that *"to check if the oauth flow has been completed, requires two things: 1. You can query the dimo identity api to check if there is currently access."*

#### Automatic Authorization Prompts

When user OAuth is configured and you use any DIMO tool that requires user access (like `telemetry_query`, `lock_doors`, etc.), the server will:

1. **Check OAuth Token**: Verify user has granted authorization
2. **Verify Vehicle Access**: Query Identity API to confirm access to the specific vehicle
3. **Provide Clear Guidance**: Show authorization URL with instructions if access is missing

#### Manual Authorization Flow

1. Call `oauth_init` to get the authorization URL
2. Open the returned URL in a browser popup
3. Complete the DIMO authorization process (user grants access)
4. Copy the callback URL after redirect  
5. Call `oauth_callback` with the full callback URL
6. Use `oauth_status` to verify authorization status

### 2. System Authentication (Developer JWT)

**Purpose:** Authenticates the MCP server itself to make API calls to DIMO services.

**When needed:** Required for all API operations. The server uses these credentials after users have granted OAuth authorization.

The MCP server uses Developer JWT for making API calls on behalf of authorized users:

1. **Developer JWT**: System-level credentials configured via environment variables
2. **API Calls**: All DIMO API requests use the Developer JWT for authentication
3. **Vehicle JWT Management**: When accessing vehicle-specific data, the server:
   - Uses Developer JWT to request vehicle-specific tokens
   - Caches tokens with appropriate privileges
   - Automatically refreshes expired tokens

### Privilege Requirements

Different operations require specific privileges:
- **Privilege 1**: Basic telemetry data
- **Privilege 2**: Extended telemetry data
- **Privilege 3**: Location data
- **Privilege 4**: Proof of Movement creation
- **Privilege 5**: VIN access and VIN credential creation

## API Endpoints

The server connects to the following DIMO APIs:
- **Identity API**: `https://identity-api.dimo.zone/query` (Public)
- **Telemetry API**: `https://telemetry-api.dimo.zone/query` (Authenticated)

## Error Handling

The server provides detailed error messages for common issues:
- Invalid GraphQL queries
- Authentication failures
- Missing privileges
- Network errors
- Invalid parameters

## Logging

The server uses structured JSON logging to stderr for better debugging:
```json
{
  "level": "info",
  "event": "dimo_auth_success",
  "message": "DIMO developer authentication successful"
}
```

## Security Considerations

- Store API credentials securely using environment variables
- Never commit credentials to version control
- Use `.env` files for local development only
- Rotate API keys regularly
- Limit token privileges to what's necessary

## Development

### Project Structure

```
src/
├── index.ts                  # Main MCP server entry point
├── helpers/
│   ├── developer-jwt.ts      # Developer JWT authentication functions
│   ├── oauth.ts              # OAuth authentication functions  
│   ├── queries.ts            # GraphQL queries for DIMO APIs
│   ├── introspection.ts      # GraphQL schema introspection
│   ├── headers.ts            # Header parsing utilities
│   └── package.ts            # Package version utilities
├── shared/
│   ├── types.ts              # Shared TypeScript interfaces
│   ├── config.ts             # Environment configuration
│   ├── auth-helpers.ts       # Authentication helper functions
│   ├── vehicle-queries.ts    # Vehicle data querying functions
│   └── privileges.ts         # SACD privilege definitions
├── tools/
│   ├── server-identity.ts    # Server identity tool, OAuth, and access tools
│   ├── vehicle-data.ts       # Vehicle data querying tools  
│   ├── vehicle-commands.ts   # Vehicle command tools
│   └── utilities.ts          # Utility tools (VIN decode, search, etc.)
└── types/
    └── dimo-sdk.d.ts         # DIMO SDK type definitions
```

### Development Commands

```bash
# Run in development mode
npm run dev

# Run tests  
npm test

# Build for production
npm run build
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify your credentials are correct
   - Ensure your developer license is active
   - Check that your domain matches the one configured in DIMO Console

2. **GraphQL Query Errors**
   - Use the introspection tools to verify schema
   - Check that required fields are included
   - Validate query syntax

3. **Permission Denied**
   - Ensure the vehicle owner has granted necessary privileges
   - Check that your developer license has access to the vehicle

## Resources

- [DIMO Developer Documentation](https://docs.dimo.org/developer-platform)
- [DIMO Developer Console](https://console.dimo.org/)
- [DIMO GraphQL Playground - Identity](https://identity-api.dimo.zone/)
- [DIMO GraphQL Playground - Telemetry](https://telemetry-api.dimo.zone/)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)

## Support

For issues and questions:
- DIMO Discord: [https://discord.gg/dimo](https://discord.gg/dimo)
- GitHub Issues: [Create an issue](https://github.com/DIMO-Network/data-sdk/issues)

## License

MIT