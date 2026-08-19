/** Default Horizon friendbot endpoint for Stellar testnet account funding. */
export const DEFAULT_TESTNET_FRIENDBOT_URL = "https://friendbot.stellar.org";

export interface StellarFundingConfig {
  friendbotUrl: string;
}

export function resolveStellarFundingConfig(
  env: Record<string, string | undefined> = {},
): StellarFundingConfig {
  return {
    friendbotUrl: env.STEALTH_TESTNET_FRIENDBOT_URL ?? DEFAULT_TESTNET_FRIENDBOT_URL,
  };
}
