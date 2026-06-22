import { describe, expect, it } from "vitest";
import { detectOtp } from "../../../src/features/otp/detectOtp";

describe("detectOtp — successful detection", () => {
  it("detects a 6-digit code preceded by the keyword 'code'", () => {
    expect(detectOtp("Your code: 847291")).toBe("847291");
  });

  it("detects a 4-digit PIN preceded by 'pin'", () => {
    expect(detectOtp("Your pin is 5823")).toBe("5823");
  });

  it("detects an 8-digit code preceded by 'verification code'", () => {
    expect(detectOtp("Enter your verification code: 38291047")).toBe("38291047");
  });

  it("detects a 6-digit code preceded by 'OTP' (case-insensitive)", () => {
    expect(detectOtp("OTP: 102938")).toBe("102938");
  });

  it("detects a 6-digit code preceded by 'one-time password'", () => {
    expect(detectOtp("Your one-time password is 663821")).toBe("663821");
  });

  it("detects a 6-digit code preceded by 'security code'", () => {
    expect(detectOtp("security code 749102")).toBe("749102");
  });

  it("detects a standalone 6-digit code on its own line", () => {
    expect(detectOtp("Please use the following:\n482910\nThis code expires soon.")).toBe("482910");
  });

  it("strips spaces from formatted codes like '123 456'", () => {
    expect(detectOtp("Your code is 123 456")).toBe("123456");
  });

  it("strips hyphens from formatted codes like '123-456'", () => {
    expect(detectOtp("Your code is 123-456")).toBe("123456");
  });
});

describe("detectOtp — edge and failure cases", () => {
  it("returns null for an empty string", () => {
    expect(detectOtp("")).toBeNull();
  });

  it("returns null when body contains no digits at all", () => {
    expect(detectOtp("Hello, please confirm your account.")).toBeNull();
  });

  it("returns null for a 3-digit number (too short)", () => {
    expect(detectOtp("Your code: 382")).toBeNull();
  });

  it("truncates a 9-digit sequence to the first 8 digits (max length)", () => {
    // The regex captures up to 8 digits greedily; the 9th is ignored
    expect(detectOtp("Your code: 123456789")).toBe("12345678");
  });

  it("returns null when keyword and digits are separated by more than 40 characters", () => {
    const longGap = "code" + " ".repeat(41) + "847291";
    expect(detectOtp(longGap)).toBeNull();
  });

  it("does not false-positive on a year in prose", () => {
    expect(detectOtp("This message was sent in 2026 from our team.")).toBeNull();
  });

  it("does not false-positive on a phone number without a keyword", () => {
    // 10 digits — outside 4-8 range and no standalone 6-digit on own line
    expect(detectOtp("Call us at 4155551234 anytime.")).toBeNull();
  });

  it("returns null for whitespace-only body", () => {
    expect(detectOtp("   \n  ")).toBeNull();
  });
});
