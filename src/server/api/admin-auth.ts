/**
 * Server-side administrator authorization for `/api/v1/admin/*` routes.
 *
 * Admin access is an allowlist of Stellar G-addresses from
 * `STEALTH_ADMIN_ADDRESSES` (comma-separated). An empty allowlist fails
 * closed — no principal is treated as an administrator.
 */
import { stellarAddressSchema } from "./domain";
import { ApiError } from "./errors";
import type { ApiContext } from "./context";

export const ADMIN_ADDRESSES_ENV = "STEALTH_ADMIN_ADDRESSES";

export function getAdminAllowlist(env: NodeJS.ProcessEnv = process.env): ReadonlySet<string> {
  const raw = env[ADMIN_ADDRESSES_ENV] ?? "";
  const addresses = new Set<string>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const parsed = stellarAddressSchema.safeParse(trimmed);
    if (parsed.success) addresses.add(parsed.data);
  }
  return addresses;
}

/**
 * Require an authenticated principal that is on the admin allowlist.
 * @returns The verified administrator address.
 */
export function requireAdmin(context: ApiContext): string {
  if (!context.isAuthenticated || !context.principal) {
    throw new ApiError(401, "unauthorized", "Authentication is required");
  }

  const address = context.principal.address;
  if (!getAdminAllowlist().has(address)) {
    throw new ApiError(403, "forbidden", "Administrator access is required");
  }

  return address;
}
