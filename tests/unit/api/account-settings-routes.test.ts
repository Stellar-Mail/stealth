import { beforeEach, describe, expect, it } from "vitest";

import { Route as ProfileRoute } from "../../../src/routes/api/v1/accounts/profile";
import { Route as AccountInfoRoute } from "../../../src/routes/api/v1/accounts/account-info";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import type { User, Profile, MailboxPolicy } from "../../../src/server/api/domain";
import { ACTOR_HEADER } from "../../../src/server/api/actor";
import { getApiContext } from "../../../src/server/api/context";

const validAddress = `G${"A".repeat(55)}`;

describe("Account Settings Routes", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  it("GET /profile returns composite data", async () => {
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

    const request = new Request("https://stealth.test/api/v1/accounts/profile", {
      headers: { [ACTOR_HEADER]: validAddress },
    });

    const handler = (ProfileRoute as any).options.server?.handlers?.GET;
    const response = await handler({ request } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.profile.displayName).toBe("Test User");
    expect(body.data.account.username).toBe("testuser");
  });

  it("PATCH /profile updates data", async () => {
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

    const request = new Request("https://stealth.test/api/v1/accounts/profile", {
      method: "PATCH",
      headers: {
        [ACTOR_HEADER]: validAddress,
        "content-type": "application/json",
      },
      body: JSON.stringify({ displayName: "Updated Name", version }),
    });

    const handler = (ProfileRoute as any).options.server?.handlers?.PATCH;
    const response = await handler({ request } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.profile.displayName).toBe("Updated Name");
  });

  it("GET /account-info returns only account identifiers", async () => {
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

    const request = new Request("https://stealth.test/api/v1/accounts/account-info", {
      headers: { [ACTOR_HEADER]: validAddress },
    });

    const handler = (AccountInfoRoute as any).options.server?.handlers?.GET;
    const response = await handler({ request } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.account.username).toBe("testuser");
    expect(body.data.profile).toBeUndefined(); // ensure profile is not returned
  });
});
