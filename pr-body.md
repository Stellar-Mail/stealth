## Summary

This PR configures the Stealth application and username resolver with stable HTTPS origins (`stealth.me`), DNS/TLS configurations, HTTP-to-HTTPS redirects, root domain redirects, CORS allowlists, cookie configurations, and Stellar federation response behavior. Replaces placeholder `.stealth.mail` domains with the canonical `.stealth.me` TLD, handles HTTPS redirects and root-domain routing, dynamically hosts the `stellar.toml` metadata file, and implements the SEP-2 Stellar federation lookup route with proper wildcard CORS headers.

**Closes #1997**

### What's included

1. **Dynamic Stellar TOML serving (`src/server.ts`)**:
   - Intercepts requests for `/.well-known/stellar.toml` on the root domain (`stealth.me`) and subdomains.
   - Serves dynamic TOML content pointing `FEDERATION_SERVER` to the appropriate subdomain (e.g. `app.stealth.me` for production, `app-preview.stealth.me` for staging, and `localhost` for dev) with wildcard CORS (`Access-Control-Allow-Origin: *`) and `text/plain` Content-Type.
2. **Redirects & Security (`src/server.ts`)**:
   - Redirects HTTP traffic to HTTPS in production-like environments (utilizing the `x-forwarded-proto` header).
   - Redirects root domain (`stealth.me`, `www.stealth.me`) traffic to the stable app subdomain (`app.stealth.me`) while preserving the request path and query parameters (except for `.well-known/stellar.toml` lookups).
   - Ensures all intercepted responses are passed through `applySecurityHeaders` to keep the security envelope robust.
3. **Stellar Federation Endpoints (`src/routes/api/v1/federation.ts` & `src/server/api/cors.ts`)**:
   - Created a standard SEP-2 Stellar federation handler resolving name queries (`type=name` e.g. `username*stealth.me`) and ID queries (`type=id` e.g. `GBRPYHIL...`) back to their canonical handle.
   - Configured a CORS allowlist bypass specifically for `/api/v1/federation` requests to allow wildcard `*` access, satisfying Stellar federation requirements without relaxing other API route guards.
4. **Domain Configurations (`wrangler.jsonc`, `src/config/loader.ts`, `tests/unit/config/runtime-config.test.ts`)**:
   - Migrated production and preview environment URLs from the `stealth.mail` TLD placeholder to the approved `stealth.me` TLD.
   - Updated default fallbacks in the runtime configuration loader.
   - Updated config loader test suite assertions to match the new domain settings.
5. **Verification & Operator Guidance (`docs/deployment/DOMAINS.md`)**:
   - Created a DNS and TLS setup runbook detailing necessary Cloudflare record targets (CNAME, TXT, SRV, redirects).
   - Included exact, repeatable test commands (`curl`, `nslookup`, `openssl`) to verify domain resolution, SSL handshakes, dynamic TOML rendering, redirects, and federation route behavior.

## Validation

The checks below document the verification performed for this change.

- **Automated Unit Tests**:
  - Implemented unit tests in `tests/unit/api/federation.test.ts` (9 tests passed).
  - Updated config tests in `tests/unit/config/runtime-config.test.ts` (15 tests passed).
  - Verified the full local test suite passes cleanly: `2700+ tests passed`.
- **Compilation**:
  - Confirmed the client and server SSR bundles build successfully without any compilation errors.
- **Security & Isolation Check**:
  - Verified no plaintext passwords, secret keys, or credentials are added to the codebase or PR artifacts.
