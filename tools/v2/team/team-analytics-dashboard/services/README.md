# Services

This folder is reserved for folder-local analytics services.

Allowed here:

- fixture normalization
- summary calculations
- local threshold evaluation
- pure mapping helpers

Not allowed here:

- inbox ingestion
- wallet or Stellar calls
- database access
- app-wide side effects

Any future service should stay dependency-light and only consume local data.
