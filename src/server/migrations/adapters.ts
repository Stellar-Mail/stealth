import { userSchema, sessionSchema } from "../api/domain";
import { usernameIndexSchema, verificationSchema, walletMetadataSchema } from "./identity-schemas";
import { fingerprintKey } from "./envelope";
import type { IdentityRecordFamily, MigrationRunOptions } from "./types";

// ---------------------------------------------------------------------------
// BETA-024 (Issue #1931) — identity record families.
//
// Five families cover the identity/session schema surface named in the issue:
// users, sessions, usernames (the username secondary index), verification, and
// wallet metadata. All five are governed at version 1 today; forward/backward
// maps are wired per-family so later betas (BETA-007 sessions, BETA-014
// provisioning) can bump a version and ship its transform + reversion here.
//
// The `username` family owns the `user:username:` namespace as versioned
// records; its integrity hook confirms each username still points at a live
// user (dangling-index detection). The `user` family verifies its email and
// address indexes exist and point back, and the `username` family is the
// single owner of username dangling detection.
// ---------------------------------------------------------------------------

export const identityRecordFamilies: readonly IdentityRecordFamily[] = [
  {
    name: "user",
    keyPrefix: "user:id:",
    indexPrefixes: ["user:email:", "user:address:"] as const,
    indexResolvers: [
      {
        prefix: "user:email:",
        resolve: (payload) => {
          const email = payload.email;
          return typeof email === "string" ? email.toLowerCase().trim() : null;
        },
      },
      {
        prefix: "user:username:",
        resolve: (payload) => {
          const username = payload.username;
          return typeof username === "string" ? username.toLowerCase().trim() : null;
        },
      },
      {
        prefix: "user:address:",
        resolve: (payload) => {
          const address = payload.address;
          return typeof address === "string" ? address.toUpperCase().trim() : null;
        },
      },
    ] as const,
    currentVersion: 1,
    schema: userSchema,
    forward: {},
    backward: {},
  },
  {
    name: "session",
    keyPrefix: "session:",
    indexPrefixes: [] as const,
    currentVersion: 1,
    schema: sessionSchema,
    forward: {},
    backward: {},
  },
  {
    name: "username",
    keyPrefix: "user:username:",
    indexPrefixes: [] as const,
    currentVersion: 1,
    schema: usernameIndexSchema,
    forward: {},
    backward: {},
    checkRecord: async (payload, key, storage) => {
      if (typeof payload !== "string") return null;
      const target = await storage.get(`user:id:${payload}`);
      if (target === null || target === undefined) {
        return { kind: "dangling_index", key: fingerprintKey(key) };
      }
      return null;
    },
  },
  {
    name: "verification",
    keyPrefix: "verification:",
    indexPrefixes: [] as const,
    currentVersion: 1,
    schema: verificationSchema,
    forward: {},
    backward: {},
  },
  {
    name: "wallet-metadata",
    keyPrefix: "wallet:metadata:",
    indexPrefixes: [] as const,
    currentVersion: 1,
    schema: walletMetadataSchema,
    forward: {},
    backward: {},
  },
];

export function selectFamilies(
  families: readonly IdentityRecordFamily[],
  options: MigrationRunOptions = {},
): readonly IdentityRecordFamily[] {
  if (!options.family) return families;
  const selected = families.filter((family) => family.name === options.family);
  return selected;
}

export function getFamily(
  families: readonly IdentityRecordFamily[],
  name: string,
): IdentityRecordFamily | undefined {
  return families.find((family) => family.name === name);
}
