import { DIMO } from '@dimo-network/data-sdk';
import { StoredOAuthToken } from '../helpers/oauth.js';
import { DeveloperJWT } from '../helpers/developer-jwt.js';

export interface VehicleJwtCacheEntry {
  token: any;
  privileges: number[];
  expiresAt: number; // Unix timestamp in ms
}

export interface AuthState {
  dimo?: DIMO;
  developerJwt?: DeveloperJWT;
  userOAuthToken?: StoredOAuthToken; // User's OAuth token for authorization
  vehicleJwts: Map<number, VehicleJwtCacheEntry>;
}

export interface PrivilegeDefinition {
  id: number;
  name: string;
  description: string;
}

export interface ServerIdentityInfo {
  clientId: string;
  totalVehiclesWithAccess?: number;
  isUserLoggedIn: boolean;
  totalOfYourVehiclesWithAccess?: number;
  vehicles?: any[];
}

// API URLs
export const IDENTITY_URL = "https://identity-api.dimo.zone/query";
export const TELEMETRY_URL = "https://telemetry-api.dimo.zone/query";
export const DEVICES_API_URL = "https://devices-api.dimo.zone";
