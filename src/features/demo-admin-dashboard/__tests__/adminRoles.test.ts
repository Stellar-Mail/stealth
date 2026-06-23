import { describe, expect, it } from "vitest";
import {
  getPermissionsForRole,
  roleHasPermission,
  ROLE_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
} from "../types/adminRoles";
import type { AdminPermission, AdminRole } from "../types/adminRoles";

const ALL_ROLES: AdminRole[] = [
  "viewer",
  "editor",
  "reviewer",
  "campaign-manager",
  "super-admin",
];

const ALL_PERMISSIONS = Object.keys(PERMISSION_DESCRIPTIONS) as AdminPermission[];

describe("adminRoles", () => {
  it("defines permissions for every role", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });

  it("has a description for every permission", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(PERMISSION_DESCRIPTIONS[permission]).toBeTruthy();
    }
  });

  it("grants viewer the baseline read-only permissions", () => {
    const viewerPerms = getPermissionsForRole("viewer");
    expect(viewerPerms).toContain("campaign:view");
    expect(viewerPerms).toContain("draft:view");
    expect(viewerPerms).toContain("audit:view");
    expect(viewerPerms).toContain("dataset:view");
    expect(viewerPerms).not.toContain("campaign:create");
    expect(viewerPerms).not.toContain("draft:edit");
    expect(viewerPerms).not.toContain("settings:edit");
  });

  it("grants editor draft creation and tag permissions", () => {
    const editorPerms = getPermissionsForRole("editor");
    expect(editorPerms).toContain("draft:create");
    expect(editorPerms).toContain("draft:edit");
    expect(editorPerms).toContain("campaign:tag");
    expect(editorPerms).toContain("dataset:edit");
    expect(editorPerms).not.toContain("campaign:delete");
    expect(editorPerms).not.toContain("draft:delete");
  });

  it("grants reviewer draft deletion and rollback", () => {
    const reviewerPerms = getPermissionsForRole("reviewer");
    expect(reviewerPerms).toContain("draft:delete");
    expect(reviewerPerms).toContain("campaign:rollback");
    expect(reviewerPerms).toContain("audit:export");
    expect(reviewerPerms).not.toContain("campaign:create");
    expect(reviewerPerms).not.toContain("campaign:publish");
  });

  it("grants campaign-manager full campaign lifecycle", () => {
    const cmPerms = getPermissionsForRole("campaign-manager");
    expect(cmPerms).toContain("campaign:create");
    expect(cmPerms).toContain("campaign:edit");
    expect(cmPerms).toContain("campaign:delete");
    expect(cmPerms).toContain("campaign:publish");
    expect(cmPerms).toContain("campaign:assign");
    expect(cmPerms).toContain("campaign:import");
    expect(cmPerms).toContain("dataset:import");
    expect(cmPerms).toContain("settings:edit");
    expect(cmPerms).not.toContain("role:manage");
  });

  it("grants super-admin all permissions including role management", () => {
    const saPerms = getPermissionsForRole("super-admin");
    expect(saPerms).toContain("role:manage");
    for (const permission of ALL_PERMISSIONS) {
      expect(saPerms).toContain(permission);
    }
  });

  it("roleHasPermission returns correct boolean", () => {
    expect(roleHasPermission("viewer", "campaign:view")).toBe(true);
    expect(roleHasPermission("viewer", "campaign:create")).toBe(false);
    expect(roleHasPermission("super-admin", "role:manage")).toBe(true);
    expect(roleHasPermission("editor", "campaign:delete")).toBe(false);
    expect(roleHasPermission("reviewer", "draft:delete")).toBe(true);
  });

  it("each role inherits all permissions of the role below it", () => {
    for (let i = 1; i < ALL_ROLES.length; i++) {
      const lower = ALL_ROLES[i - 1];
      const higher = ALL_ROLES[i];
      for (const perm of ROLE_PERMISSIONS[lower]) {
        expect(ROLE_PERMISSIONS[higher]).toContain(perm);
      }
    }
  });

  it("every permission in the union is assigned to at least one role", () => {
    const assigned = new Set<AdminPermission>();
    for (const role of ALL_ROLES) {
      for (const perm of ROLE_PERMISSIONS[role]) {
        assigned.add(perm);
      }
    }
    for (const permission of ALL_PERMISSIONS) {
      expect(assigned.has(permission)).toBe(true);
    }
  });

  it("every permission referenced in a role exists in PERMISSION_DESCRIPTIONS", () => {
    for (const role of ALL_ROLES) {
      for (const perm of ROLE_PERMISSIONS[role]) {
        expect(PERMISSION_DESCRIPTIONS[perm]).toBeDefined();
      }
    }
  });
});
