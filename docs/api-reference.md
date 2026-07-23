## Crypto Runtime Compatibility

The crypto module provides runtime capability checking for crypto primitives.

### checkCapabilities

Checks available crypto capabilities in the current environment.

```ts
function checkCapabilities(throwOnMissing: boolean): Map<CryptoCapability, boolean>;
function createCryptoAdapter(): CryptoAdapter;
import { createCryptoAdapter, checkCapabilities } from "src/services/crypto";

// Check capabilities without throwing
const caps = checkCapabilities(false);
if (!caps.get("globalCrypto")) {
  console.warn("Crypto not available!");
}

// Create adapter (throws on missing capabilities)
const adapter = createCryptoAdapter();
const randomBytes = adapter.randomBytes(32);
const encoded = adapter.encode("Hello");
```
