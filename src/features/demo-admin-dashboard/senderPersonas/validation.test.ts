import { describe, expect, it } from "vitest";
import { validateSenderPersona } from "./validation";
import type { SenderPersona } from "./types";

describe("validateSenderPersona", () => {
  it("passes for a valid safe persona", () => {
    const persona: SenderPersona = {
      id: "1",
      name: "Alice",
      email: "alice@example.com",
      policy: "allow",
      isTrusted: true,
    };
    const issues = validateSenderPersona(persona);
    expect(issues).toHaveLength(0);
  });

  it("warns on unsafe domain", () => {
    const persona: SenderPersona = {
      id: "2",
      name: "Bob",
      email: "bob@hacker.com",
      policy: "none",
      isTrusted: false,
    };
    const issues = validateSenderPersona(persona);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].fieldPath).toBe("email");
  });

  it("errors on empty name", () => {
    const persona: SenderPersona = {
      id: "3",
      name: "",
      email: "safe@example.com",
      policy: "none",
      isTrusted: false,
    };
    const issues = validateSenderPersona(persona);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].fieldPath).toBe("name");
  });
});
