import { describe, expect, it } from "vitest";
import { DemoAdminDashboard } from "../../../src/features/demo-admin-dashboard";

describe("DemoAdminDashboard module", () => {
  it("exports the DemoAdminDashboard component", () => {
    expect(DemoAdminDashboard).toBeDefined();
    expect(typeof DemoAdminDashboard).toBe("function");
  });
});
