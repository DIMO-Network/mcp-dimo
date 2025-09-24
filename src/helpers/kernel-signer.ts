import { getEnvConfig } from '../shared/config.js';
import type { AuthState, KernelSignerConfig } from '../shared/types.js';
import { 
  KernelSigner,
  newKernelConfig,
  getPermissionsValue,
  Permission,
  ContractType
} from '@dimo-network/transactions';
// Helper function to initialize KernelSigner from environment variables
export async function initializeKernelSignerFromEnv(authState: AuthState, config: any): Promise<void> {
  try {
    const envConfig = getEnvConfig();
    const kernelConfig = newKernelConfig({
      rpcUrl: envConfig.rpcUrl ?? 'https://polygon-rpc.com',
      bundlerUrl: envConfig.bundlerUrl ?? 'https://bundler.example.com',
      paymasterUrl: envConfig.paymasterUrl ?? 'https://paymaster.example.com',
      environment: 'prod',
      clientId: envConfig.clientId,
      domain: envConfig.domain ?? 'https://dimo.org',
      redirectUri: envConfig.domain ?? 'https://dimo.org',
      usePrivateKey: true,
    });

    authState.kernelSigner = new KernelSigner(kernelConfig);
    await authState.kernelSigner.privateKeyInit(envConfig.mintingWalletPrivateKey as `0x${string}`);

    console.error(JSON.stringify({
      level: "info",
      event: "kernel_signer_auto_initialized",
      message: "KernelSigner auto-initialized successfully from environment variables",
      environment: "prod",
      walletAddress: config.walletAddress
    }));

  } catch (error) {
    console.error(JSON.stringify({
      level: "warn",
      event: "kernel_signer_auto_init_failed",
      message: "Failed to auto-initialize KernelSigner from environment variables",
      error: error instanceof Error ? error.message : String(error)
    }));
  }
}
