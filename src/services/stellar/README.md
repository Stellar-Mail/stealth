# Stellar Services

Client-side Stellar RPC/Horizon adapters, transaction builders, memo helpers, wallet integration, and server-side managed wallet provisioning (BETA-015).

- `keypair.ts` — trusted-server Stellar keypair generation.
- `wallet-secret-crypto.ts` — encrypt/decrypt managed wallet seeds at rest.
- `account-provision.ts` — prepare and fund managed testnet accounts.
- `funding-adapter.ts` — friendbot/fake funding adapter for testnet accounts.
- `managed-wallet.ts` — intent-bound signing for managed operator flows.
