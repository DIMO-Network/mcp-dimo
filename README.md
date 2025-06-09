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

### 🚗 Vehicle Operations

#### `vin_operations`
Decode VINs or retrieve VIN information for registered vehicles.

**Operations:**
- `decode`: Decode a VIN string to get make, model, year, and other details
  - Parameters: `vin` (required), `countryCode` (optional, default: "USA")
- `get`: Retrieve the VIN for a registered vehicle
  - Parameters: `tokenId` (required)

#### `search_vehicles`
Search for vehicle definitions and information in DIMO. Filter by make, model, year, or free-text query.

**Parameters:**
- `query`: Free-text search
- `makeSlug`: Filter by make (e.g., "tesla", "ford")
- `year`: Filter by year
- `model`: Filter by model

### 🏆 Verifiable Credentials

#### `attestation_create`
Create verifiable credentials for vehicles to prove activity or identity.

**Parameters:**
- `tokenId`: Vehicle token ID
- `type`: Credential type ("pom" for Proof of Movement, "vin" for VIN credential)
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

```bash
# DIMO environment (optional, defaults to "Production")
DIMO_ENVIRONMENT=Production  # or "Dev"

# Auto-authentication credentials (optional but recommended)
DIMO_CLIENT_ID=your_client_id
DIMO_DOMAIN=your_domain.com
DIMO_PRIVATE_KEY=your_private_key_here

# Additional headers for GraphQL requests (optional)
HEADERS={"X-Custom-Header": "value"}
```

### MCP Client Configuration

#### For Claude Desktop

Add to your configuration file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

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

### 4. Create Proof of Movement
```javascript
// Use attestation_create tool
{
  "tokenId": 12345,
  "type": "pom"
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

The server handles authentication automatically:

1. **Developer Authentication**: If credentials are provided via environment variables, the server authenticates on startup
2. **Vehicle JWT Management**: When querying telemetry data or creating attestations, the server automatically:
   - Checks if a valid JWT exists for the vehicle
   - Requests appropriate privileges based on the operation
   - Caches tokens to minimize API calls

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