# DIMO MCP Server

An MCP (Model Context Protocol) server that provides seamless access to the DIMO Network APIs, enabling AI assistants to query vehicle data, execute vehicle commands, decode VINs, create verifiable credentials, and interact with the DIMO ecosystem.

## Overview

This server acts as a bridge between AI assistants and DIMO's vehicle data network, providing:
- Direct access to DIMO's GraphQL APIs (Identity and Telemetry)
- Automatic JWT token management for authenticated endpoints
- Vehicle ownership validation with fleet mode support
- VIN decoding and vehicle information lookup
- Vehicle command execution (doors, charging)
- Verifiable credential creation (VIN credentials)
- Vehicle NFT minting using DIMO transactions SDK
- Schema introspection for both APIs
- OAuth authentication flow management

## Architecture

The server is built with a modular architecture split across focused tool categories:

- **Server Identity Tools** (`server-identity.ts`) - Authentication, OAuth flows, and vehicle access checking
- **Vehicle Data Tools** (`vehicle-data.ts`) - GraphQL queries for identity and telemetry APIs with schema introspection
- **Vehicle Commands Tools** (`vehicle-commands.ts`) - Door lock/unlock and charging start/stop commands
- **Vehicle Minting Tools** (`vehicle-minting.ts`) - Vehicle NFT minting using DIMO transactions SDK
- **Utilities Tools** (`utilities.ts`) - VIN decoding, vehicle search, and attestation creation

## Quick Start

### Prerequisites

- Node.js 18 or higher (or Bun runtime)
- DIMO Developer License from [DIMO Developer Console](https://console.dimo.org/)
- Valid API credentials (client ID, domain, and private key)

### Installation

```bash
# Install via npm
npm install -g mcp-dimo

# Or clone and build locally
git clone https://github.com/DIMO-Network/mcp-dimo.git
cd mcp-dimo
bun install
bun run build
```

### Configuration

Set up your environment variables:

```bash
# Required - DIMO Developer License credentials
DIMO_CLIENT_ID=your_client_id_here
DIMO_DOMAIN=your_domain.com  
DIMO_PRIVATE_KEY=your_private_key_here

# Optional - Fleet mode (skips ownership checks)
FLEET_MODE=false

# Optional - Custom login URL
DIMO_LOGIN_BASE_URL=https://login.dimo.org
```

### MCP Client Setup (Claude Desktop)

Add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "dimo": {
      "command": "mcp-dimo",
      "env": {
        "DIMO_CLIENT_ID": "your_client_id_here",
        "DIMO_DOMAIN": "your_domain.com",
        "DIMO_PRIVATE_KEY": "your_private_key_here"
      }
    }
  }
}
```

## Available Tools

### 🆔 Server Identity & Authentication

#### `check_vehicle_access_status`
**Check current vehicle access status and authentication state.**

**ALWAYS call this tool first** to understand what vehicles are available before attempting any vehicle operations. Shows which vehicles have granted access to their data.

**Example:**
```javascript
// Check what vehicles are accessible
{
  "tool": "check_vehicle_access_status",
  "arguments": {}
}
```

#### `init_oauth`
**Initialize OAuth authentication flow with automatic callback handling.**

Starts a local server and opens OAuth URL for user authentication.

**Parameters:**
- `port` (optional): Local server port (default: 3333)

**Example:**
```javascript
{
  "tool": "init_oauth", 
  "arguments": {"port": 3333}
}
```

#### `generate_vehicle_data_sharing_url`
**Generate URL for users to share vehicle data with this developer license.**

**Parameters:**
- `permissionTemplateId` (optional): Permission template ID (default: 1)

### 📊 Vehicle Data & Schema

#### `identity_introspect`
**Introspect the DIMO Identity GraphQL schema.**

**ALWAYS call this tool first** before using `identity_query` to understand available fields and types.

#### `identity_query`
**Query the DIMO Identity GraphQL API for public data.**

**Prerequisites:** Must call `identity_introspect` first to understand schema structure.

**Parameters:**
- `query`: GraphQL query string
- `variables`: Query variables object

**Example:**
```javascript
{
  "tool": "identity_query",
  "arguments": {
    "query": "{ vehicle(tokenId: 12345) { owner definition { make model year } } }",
    "variables": {"tokenId": 12345}
  }
}
```

#### `telemetry_introspect`
**Introspect the DIMO Telemetry GraphQL schema.**

**ALWAYS call this tool first** before using `telemetry_query` to understand available fields and types.

#### `telemetry_query`
**Query vehicle telemetry data (requires authentication and vehicle access).**

**Prerequisites:** 
- Must call `telemetry_introspect` first to understand schema structure
- Vehicle must be shared with this developer license
- User must be authenticated

**Parameters:**
- `query`: GraphQL query string
- `variables`: Query variables object (must include `tokenId`)

**Example:**
```javascript
{
  "tool": "telemetry_query",
  "arguments": {
    "query": "{ vehicle(tokenId: $tokenId) { signalsLatest { speed { value timestamp } } } }",
    "variables": {"tokenId": 12345}
  }
}
```

### 🚗 Vehicle Commands

All vehicle commands require:
- Vehicle shared with this developer license
- User authentication
- Vehicle ownership (unless `FLEET_MODE=true`)

#### `lock_doors`
**Lock vehicle doors.**

**Parameters:**
- `tokenId`: Vehicle token ID

#### `unlock_doors`
**Unlock vehicle doors.**

**Parameters:**
- `tokenId`: Vehicle token ID

#### `start_charge`
**Start vehicle charging (electric/hybrid vehicles only).**

**Parameters:**
- `tokenId`: Vehicle token ID

#### `stop_charge`
**Stop vehicle charging (electric/hybrid vehicles only).**

**Parameters:**
- `tokenId`: Vehicle token ID

### 🔧 Utilities

#### `vin_decode`
**Decode a VIN to get vehicle specifications.**

**Parameters:**
- `vin`: Vehicle Identification Number
- `countryCode` (optional): Country code (default: "USA")

**Example:**
```javascript
{
  "tool": "vin_decode",
  "arguments": {
    "vin": "1HGCM82633A123456",
    "countryCode": "USA"
  }
}
```

#### `search_vehicles`
**Search DIMO's vehicle definition database.**

**Parameters:**
- `query` (optional): Free-text search query
- `make` (optional): Vehicle make
- `model` (optional): Vehicle model  
- `year` (optional): Vehicle year

**Example:**
```javascript
{
  "tool": "search_vehicles",
  "arguments": {
    "make": "tesla",
    "year": 2023
  }
}
```

#### `attestation_create`
**Create verifiable credentials for vehicles.**

**Prerequisites:**
- Vehicle must be shared with this developer license
- User must be authenticated
- Vehicle ownership required (unless `FLEET_MODE=true`)

**Parameters:**
- `tokenId`: Vehicle token ID
- `type`: Credential type ("vin")
- `force` (optional): Force creation even if exists (default: false)

### 🚀 Vehicle Minting

#### `initialize_kernel_signer`
**Initialize the DIMO KernelSigner for vehicle minting transactions.**

Sets up the blockchain signer with passkey authentication for minting vehicle NFTs.

**Parameters:**
- `rpcUrl`: RPC URL for the blockchain network
- `bundlerUrl`: Bundler URL for transaction bundling
- `paymasterUrl`: Paymaster URL for gasless transactions
- `environment`: Environment ('dev' or 'prod', default: 'dev')
- `subOrganizationId`: Sub-organization ID for the signer
- `walletAddress`: Wallet address for the signer
- `rpId`: Relying Party ID for passkey authentication

**Example:**
```javascript
{
  "tool": "initialize_kernel_signer",
  "arguments": {
    "rpcUrl": "https://polygon-rpc.com",
    "bundlerUrl": "https://bundler.example.com",
    "paymasterUrl": "https://paymaster.example.com",
    "environment": "prod",
    "subOrganizationId": "org_123",
    "walletAddress": "0x1234...",
    "rpId": "dimo.org"
  }
}
```

#### `mint_vehicle`
**Mint a new vehicle NFT using the DIMO transactions SDK.**

**Prerequisites:**
- KernelSigner must be initialized via `initialize_kernel_signer`

**Parameters:**
- `make`: Vehicle make (e.g., 'Toyota', 'Ford')
- `model`: Vehicle model (e.g., 'Camry', 'F-150')
- `year`: Vehicle year (e.g., 2023)
- `vin` (optional): Vehicle VIN (will be decoded if provided)
- `deviceDefinition` (optional): Device definition object

**Example:**
```javascript
{
  "tool": "mint_vehicle",
  "arguments": {
    "make": "Tesla",
    "model": "Model 3",
    "year": 2023,
    "vin": "5YJ3E1EA4KF123456"
  }
}
```

#### `get_minting_status`
**Check the status of the KernelSigner and minting capabilities.**

Returns information about whether the signer is initialized and ready for vehicle minting.

**Example:**
```javascript
{
  "tool": "get_minting_status",
  "arguments": {}
}
```

## Authentication & Authorization

### Two-Tier Authentication System

#### 1. Developer JWT (System-Level)
- **Purpose**: Authenticate the MCP server itself with DIMO APIs
- **Required for**: All API calls, VIN decoding, vehicle search
- **Configuration**: `DIMO_CLIENT_ID`, `DIMO_DOMAIN`, `DIMO_PRIVATE_KEY`

#### 2. User OAuth (User-Level)  
- **Purpose**: Users grant permission to access their specific vehicle data
- **Required for**: Vehicle telemetry, commands, attestations
- **Process**: Use `init_oauth` tool to start authentication flow

### Fleet Mode

Set `FLEET_MODE=true` to skip vehicle ownership checks, allowing operation on any vehicle shared with the developer license.

```bash
# Enable fleet mode (skip ownership validation)
FLEET_MODE=true

# Disable fleet mode (enforce ownership validation) 
FLEET_MODE=false  # or omit the variable
```

## Environment Variables

### Required
```bash
DIMO_CLIENT_ID=your_client_id_here          # Your DIMO developer license client ID
```

### Optional
```bash
DIMO_DOMAIN=your_domain.com                 # Required for Developer JWT
DIMO_PRIVATE_KEY=your_private_key_here      # Required for Developer JWT
FLEET_MODE=false                            # Skip ownership checks when true
DIMO_LOGIN_BASE_URL=https://login.dimo.org  # Custom login URL
DIMO_ENTRY_STATE=LOGIN                      # OAuth entry state

# Vehicle Minting (Transactions SDK)
DIMO_RPC_URL=https://polygon-rpc.com        # Blockchain RPC URL
DIMO_BUNDLER_URL=https://bundler.example.com # Transaction bundler URL
DIMO_PAYMASTER_URL=https://paymaster.example.com # Paymaster URL for gasless transactions
```

## Usage Workflow

### Recommended Tool Call Sequence

1. **`check_vehicle_access_status`** - See what vehicles are available
2. **`identity_introspect`** / **`telemetry_introspect`** - Understand schema structure  
3. **`init_oauth`** (if needed) - Authenticate user for vehicle access
4. **`identity_query`** / **`telemetry_query`** - Query with proper schema knowledge
5. **Vehicle commands/operations** - Execute actions on known vehicles

### Example: Complete Vehicle Data Query

```javascript
// 1. Check available vehicles
{"tool": "check_vehicle_access_status", "arguments": {}}

// 2. Understand telemetry schema
{"tool": "telemetry_introspect", "arguments": {}}

// 3. Authenticate user (if needed)
{"tool": "init_oauth", "arguments": {}}

// 4. Query vehicle data
{
  "tool": "telemetry_query",
  "arguments": {
    "query": "{ vehicle(tokenId: $tokenId) { signalsLatest { speed { value } location { latitude longitude } } } }",
    "variables": {"tokenId": 12345}
  }
}
```

## Error Handling

The server provides intelligent error detection and guidance:

### Schema Errors
When GraphQL queries fail due to unknown fields, the server detects this and provides specific guidance:

```
GraphQL schema error detected. Please call telemetry_introspect first to understand the schema structure, then fix your query.
```

### Authentication Errors
Clear messages guide users through the authentication process:

```
You are not logged in, please login and share a vehicle with me.
```

### Ownership Errors
Fleet mode and ownership validation provide appropriate access control:

```
You are not the owner of this vehicle, sorry.
```

## Development

### Project Structure

```
src/
├── index.ts                     # Main MCP server entry point
├── helpers/
│   ├── developer-jwt.ts         # JWT authentication functions
│   ├── identity-queries.ts      # Identity API query functions
│   ├── kernel-signer.ts         # KernelSigner initialization helper
│   ├── oauth.ts                 # OAuth flow management
│   ├── introspection.ts         # GraphQL schema introspection
│   └── package.ts               # Package version utilities
├── shared/
│   ├── types.ts                 # Shared TypeScript interfaces
│   ├── config.ts                # Environment configuration
│   └── command-helpers.ts       # Shared validation utilities
├── tools/
│   ├── server-identity.ts       # Identity, OAuth, and access tools
│   ├── vehicle-data.ts          # GraphQL query tools
│   ├── vehicle-commands.ts      # Vehicle command tools
│   ├── vehicle-minting.ts       # Vehicle NFT minting tools
│   └── utilities.ts             # VIN decode, search, attestation tools
└── types/
    └── dimo-sdk.d.ts            # DIMO SDK type definitions
```

### Development Commands

```bash
# Development mode with hot reload
bun run dev

# Build for production
bun run build

# Start built server
bun run start
```

### Adding New Tools

1. Create tool in appropriate module (`tools/`)
2. Use shared validation helpers from `command-helpers.ts`
3. Follow consistent return format:
   ```typescript
   return {
     content: [{
       type: "text" as const,
       text: JSON.stringify(data, null, 2)
     }]
   };
   ```

## Security Features

- **Input Validation**: All inputs validated using Zod schemas
- **Authentication Required**: Protected endpoints require proper authentication
- **Ownership Validation**: Vehicle operations validate ownership (unless fleet mode)
- **JWT Token Management**: Automatic token refresh and validation
- **Error Sanitization**: Safe error messages without sensitive data exposure

## Troubleshooting

### Common Issues

**1. Authentication Failed**
```
Error: Developer JWT not configured
```
**Solution**: Ensure `DIMO_DOMAIN` and `DIMO_PRIVATE_KEY` are set correctly.

**2. Vehicle Access Denied**
```
Error: You are not the owner of this vehicle
```
**Solution**: Either enable `FLEET_MODE=true` or ensure the authenticated user owns the vehicle.

**3. Schema Errors**
```
GraphQL schema error detected
```
**Solution**: Call the appropriate introspection tool (`identity_introspect` or `telemetry_introspect`) first.

**4. No Vehicle Access**
```
You haven't shared any vehicles with me yet
```
**Solution**: Use `init_oauth` to authenticate and share vehicles through the DIMO app.

### Debug Logging

The server provides structured JSON logging for debugging:

```json
{
  "level": "info",
  "event": "dimo_dev_jwt_success", 
  "message": "Developer JWT configured successfully"
}
```

## API Reference

### Vehicle Data APIs

- **Identity API**: `https://identity-api.dimo.zone/query` - Public vehicle and device information
- **Telemetry API**: `https://telemetry-api.dimo.zone/query` - Real-time and historical vehicle data
- **Devices API**: `https://devices-api.dimo.zone` - Vehicle command execution

### Supported Vehicle Commands

- **Door Control**: Lock/unlock doors on compatible vehicles
- **Charging Control**: Start/stop charging on electric/hybrid vehicles
- **Future**: Additional commands as supported by DIMO network

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the existing patterns
4. Test your changes
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- [DIMO Network](https://dimo.org/)
- [DIMO Developer Console](https://console.dimo.org/)
- [DIMO Documentation](https://docs.dimo.org/)
- [Model Context Protocol](https://modelcontextprotocol.io/)