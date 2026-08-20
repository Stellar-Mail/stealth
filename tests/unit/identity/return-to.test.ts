import { describe, expect, it } from "vitest";

import { safeReturnTo, validateReturnTo } from "@/features/identity/returnTo";

describe("validateReturnTo (open-redirect protection)", () => {
  it("accepts safe same-origin relative paths", () => {
    expect(validateReturnTo("/")).toBe("/");
    expect(validateReturnTo("/mail")).toBe("/mail");
    expect(validateReturnTo("/mail/123?tab=preview")).toBe("/mail/123?tab=preview");
    expect(validateReturnTo("/folder/inbox#section")).toBe("/folder/inbox#section");
    expect(validateReturnTo("/a/b/c")).toBe("/a/b/c");
  });

  it("rejects absolute URLs (off-origin)", () => {
    expect(validateReturnTo("https://evil.example")).toBeNull();
    expect(validateReturnTo("http://evil.example/path")).toBeNull();
    expect(validateReturnTo("ftp://evil.example")).toBeNull();
    expect(validateReturnTo("mailto:attacker@evil.example")).toBeNull();
  });

  it("rejects protocol-relative URLs", () => {
    expect(validateReturnTo("//evil.example")).toBeNull();
    expect(validateReturnTo("//evil.example/path")).toBeNull();
    expect(validateReturnTo("///evil.example")).toBeNull();
    expect(validateReturnTo("////evil.example")).toBeNull();
  });

  it("rejects backslash-aliased protocol-relative URLs", () => {
    expect(validateReturnTo("/\\evil.example")).toBeNull();
    expect(validateReturnTo("\\evil.example")).toBeNull();
    expect(validateReturnTo("\\\\evil.example")).toBeNull();
    expect(validateReturnTo("//\\evil.example")).toBeNull();
  });

  it("rejects encoded protocol-relative lookalikes that decode to an authority", () => {
    expect(validateReturnTo("/%2f%2fevil.example")).toBeNull();
    expect(validateReturnTo("/%2F%2Fevil.example")).toBeNull();
  });

  it("rejects control characters and whitespace smuggling", () => {
    // Leading/trailing whitespace is trimmed (never navigated), so a value
    // that trims to a plain relative path stays safe.
    expect(validateReturnTo("/\n")).toBe("/");
    expect(validateReturnTo("/\r\n")).toBe("/");
    expect(validateReturnTo("/\t")).toBe("/");
    // Control characters inside the path are rejected outright.
    expect(validateReturnTo("/a\nb")).toBeNull();
    expect(validateReturnTo("/a\rb")).toBeNull();
    expect(validateReturnTo("/\u0000b")).toBeNull();
  });

  it("rejects values that are not relative paths", () => {
    expect(validateReturnTo("evil.example")).toBeNull();
    expect(validateReturnTo("")).toBeNull();
    expect(validateReturnTo("   ")).toBeNull();
    expect(validateReturnTo("javascript:alert(1)")).toBeNull();
    expect(validateReturnTo("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(validateReturnTo("#fragment-only")).toBeNull();
    expect(validateReturnTo("?query=only")).toBeNull();
  });

  it("rejects non-string inputs", () => {
    expect(validateReturnTo(null)).toBeNull();
    expect(validateReturnTo(undefined)).toBeNull();
    expect(validateReturnTo(123)).toBeNull();
    expect(validateReturnTo(["//evil.example"])).toBeNull();
  });

  it("trims surrounding whitespace before validating", () => {
    expect(validateReturnTo("  /mail  ")).toBe("/mail");
  });

  it("rejects malformed percent-encoding", () => {
    expect(validateReturnTo("/%zz")).toBeNull();
    expect(validateReturnTo("/%2")).toBeNull();
  });
});

describe("safeReturnTo", () => {
  it("falls back to the home path for unsafe values", () => {
    expect(safeReturnTo("https://evil.example")).toBe("/");
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo(null)).toBe("/");
    expect(safeReturnTo(undefined)).toBe("/");
    expect(safeReturnTo("")).toBe("/");
  });

  it("passes through valid same-origin relative paths", () => {
    expect(safeReturnTo("/inbox")).toBe("/inbox");
    expect(safeReturnTo("/")).toBe("/");
  });
});
