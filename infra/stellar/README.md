# Stellar

Stellar network configuration, account funding, Horizon/RPC settings, federation setup, and testnet notes.

## Managed wallet funding (BETA-015)

Beta accounts receive a system-managed Stellar testnet wallet during registration. Funding is performed through a swappable adapter:

- `src/services/stellar/funding-adapter.ts` — `FriendbotFundingAdapter` for live testnet funding and `FakeFundingAdapter` for unit/integration tests.
- `src/services/stellar/funding-config.ts` — friendbot URL configuration (`STEALTH_TESTNET_FRIENDBOT_URL`, default `https://friendbot.stellar.org`).

Production and preview deployments use the real friendbot adapter on testnet. Development and test profiles use the fake adapter so CI does not require network access.
