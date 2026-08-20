import { describe, expect, it } from "vitest";

import {
  getAccountProfile,
  updateAccountProfile,
} from "../../../src/server/api/account-settings-service";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import type { User, Profile, MailboxPolicy } from "../../../src/server/api/domain";

const validAddress = `G${"A".repeat(55)}`;

describe("AccountSettingsService", () => {
  it("getAccountProfile returns the composite profile", async () => {
    const repo = new MemoryApiRepository();
    const now = new Date().toISOString();

    const user: User = {
      userId: "u1",
      address: validAddress,
      email: "test@example.com",
      username: "testuser",
      status: "active",
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await repo.createUser(user);

    const profile: Profile = {
      userId: "u1",
      username: "testuser",
      displayName: "Test User",
      bio: "Hello",
      locale: "en",
      timezone: "UTC",
      addressDisplay: "truncated",
      createdAt: now,
      updatedAt: now,
    };
    await repo.setProfile(profile);

    const policy: MailboxPolicy = {
      allowUnknown: true,
      minimumPostage: "0",
      requireVerified: false,
    };
    await repo.setPolicy(validAddress, policy);

    const result = await getAccountProfile(repo, validAddress, "req1");

    expect(result.user.username).toBe("testuser");
    expect(result.profile.displayName).toBe("Test User");
    expect(result.account.address).toBe(validAddress);
    expect(result.account.network).toBe("Testnet");
  });

  it("updateAccountProfile applies valid changes", async () => {
    const repo = new MemoryApiRepository();
    const now = new Date().toISOString();

    const user: User = {
      userId: "u1",
      address: validAddress,
      email: "test@example.com",
      username: "testuser",
      status: "active",
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await repo.createUser(user);

    const profile: Profile = {
      userId: "u1",
      username: "testuser",
      displayName: "Test User",
      locale: "en",
      timezone: "UTC",
      addressDisplay: "truncated",
      createdAt: now,
      updatedAt: now,
    };
    await repo.setProfile(profile);

    const version = new Date(profile.updatedAt).getTime();

    const result = await updateAccountProfile(
      repo,
      validAddress,
      { displayName: "New Name", locale: "en-GB", version },
      "req2",
    );

    expect(result.profile.displayName).toBe("New Name");
    expect(result.profile.locale).toBe("en-GB");

    // Check DB
    const dbProfile = await repo.getProfile("u1");
    expect(dbProfile?.displayName).toBe("New Name");
  });

  it("updateAccountProfile rejects stale versions", async () => {
    const repo = new MemoryApiRepository();
    const now = new Date().toISOString();

    const user: User = {
      userId: "u1",
      address: validAddress,
      email: "test@example.com",
      username: "testuser",
      status: "active",
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await repo.createUser(user);

    const profile: Profile = {
      userId: "u1",
      username: "testuser",
      displayName: "Test User",
      locale: "en",
      timezone: "UTC",
      addressDisplay: "truncated",
      createdAt: now,
      updatedAt: now,
    };
    await repo.setProfile(profile);

    const staleVersion = new Date(now).getTime() - 1000;

    await expect(
      updateAccountProfile(
        repo,
        validAddress,
        { displayName: "New Name", version: staleVersion },
        "req2",
      ),
    ).rejects.toThrow(/Profile has been modified/);
  });

  it("updateAccountProfile rejects updates from stale sessions", async () => {
    const repo = new MemoryApiRepository();
    const now = new Date().toISOString();

    const user: User = {
      userId: "u1",
      address: validAddress,
      email: "test@example.com",
      username: "testuser",
      status: "active",
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await repo.createUser(user);

    const profile: Profile = {
      userId: "u1",
      username: "testuser",
      displayName: "Test User",
      locale: "en",
      timezone: "UTC",
      addressDisplay: "truncated",
      createdAt: now,
      updatedAt: now,
    };
    await repo.setProfile(profile);

    const version = new Date(profile.updatedAt).getTime();

    // Create an authenticated time 20 minutes ago
    const staleAuthTime = new Date(Date.now() - 20 * 60 * 1000);

    await expect(
      updateAccountProfile(
        repo,
        validAddress,
        { displayName: "New Name", version },
        "req2",
        staleAuthTime,
      ),
    ).rejects.toThrow(/re-authenticate/);
  });
});
