import { describe, it, expect } from "vitest";
import { ProjectBinderService } from "../services/projectBinderService";
import { Project } from "../implementation.md";
import type { Email } from "@/components/mail/data";

const testProject: Project = {
  id: "test-proj-1",
  name: "Soroban Launch",
  description: "Stellar Soroban contract tracking",
  stellarAddress: "GCGD3IDSLG2KCE2K3C7IOPQZ2772JDMXOXP23DSEJ4KSDIOPP2",
  members: ["lina*vantage.studio"],
  rules: [
    { id: "r-1", type: "subject", pattern: "Soroban", isActive: true },
    { id: "r-2", type: "sender", pattern: "receipts*stealth.network", isActive: true },
  ],
  createdAt: new Date().toISOString(),
};

const testEmails: Email[] = [
  {
    id: "m-1",
    from: "Lina Park",
    email: "lina*vantage.studio",
    subject: "Refined Soroban contracts design",
    preview: "Soroban details...",
    body: "Body text about Soroban contracts.",
    time: "10:00 AM",
    unread: true,
    starred: false,
    folder: "priority",
    avatarColor: "#5b6470",
  },
  {
    id: "m-2",
    from: "Receipts Contract",
    email: "receipts*stealth.network",
    subject: "Receipt settled",
    preview: "Receipt details...",
    body: "Details of receipt settlement.",
    time: "10:15 AM",
    unread: false,
    starred: false,
    folder: "receipts",
    avatarColor: "#7a8290",
  },
  {
    id: "m-3",
    from: "Other Contact",
    email: "random*domain.com",
    subject: "Lunch tomorrow?",
    preview: "Lunch plan...",
    body: "Let's grab sushi tomorrow.",
    time: "11:00 AM",
    unread: false,
    starred: false,
    folder: "inbox",
    avatarColor: "#4d5560",
  },
];

describe("ProjectBinderService Unit Tests", () => {
  it("should initialize with empty or pre-loaded projects", () => {
    const service = new ProjectBinderService([testProject]);
    expect(service.getProjects()).toHaveLength(1);
    expect(service.getProjects()[0].id).toBe("test-proj-1");
  });

  it("should create new projects dynamically", () => {
    const service = new ProjectBinderService();
    expect(service.getProjects()).toHaveLength(0);

    const newProj: Project = {
      id: "test-proj-2",
      name: "New Marketing Campaign",
      description: "Rebranding campaign",
      members: [],
      rules: [],
      createdAt: new Date().toISOString(),
    };

    service.createProject(newProj);
    expect(service.getProjects()).toHaveLength(1);
    expect(service.getProjects()[0].name).toBe("New Marketing Campaign");
  });

  it("should allow manual binding and unbinding of emails", () => {
    const service = new ProjectBinderService([testProject]);

    // Bind m-3 to project
    service.bindEmail("m-3", "test-proj-1");
    expect(service.getEmailsForProject("test-proj-1")).toContain("m-3");
    expect(service.getProjectsForEmail("m-3")).toContain("test-proj-1");

    // Unbind m-3
    service.unbindEmail("m-3", "test-proj-1");
    expect(service.getEmailsForProject("test-proj-1")).not.toContain("m-3");
    expect(service.getProjectsForEmail("m-3")).not.toContain("test-proj-1");
  });

  it("should automatically bind emails based on active rules", () => {
    const service = new ProjectBinderService([testProject]);

    // Run autobinder
    const bindings = service.autoBindEmails(testEmails);

    // Bindings output verification
    expect(bindings).toHaveLength(2);
    expect(bindings.some((b) => b.emailId === "m-1")).toBe(true);
    expect(bindings.some((b) => b.emailId === "m-2")).toBe(true);
    expect(bindings.some((b) => b.emailId === "m-3")).toBe(false);

    // Get bound email ids
    const boundIds = service.getEmailsForProject("test-proj-1");
    expect(boundIds).toContain("m-1");
    expect(boundIds).toContain("m-2");
    expect(boundIds).not.toContain("m-3");
  });
});
