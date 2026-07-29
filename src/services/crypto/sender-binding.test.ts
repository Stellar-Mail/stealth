import { describe, it, expect } from "vitest";
import { verifySenderBinding, SenderBindingError } from "./sender-binding";

describe("verifySenderBinding", () => {
  const SENDER = "GBX2V4M6X5F3KQDQ5Y74Z75U7Y";
  const DELEGATE = "GCH3Y5V6X5F3KQDQ5Y74Z75U7Z";

  it("should pass when signer matches declared sender exactly", () => {
    expect(() => verifySenderBinding(SENDER, SENDER)).not.toThrow();
  });

  it("should pass with normalized casing and whitespace", () => {
    expect(() => verifySenderBinding(` ${SENDER.toLowerCase()} `, SENDER)).not.toThrow();
  });

  it("should throw SenderBindingError when signer does not match sender", () => {
    expect(() => verifySenderBinding(DELEGATE, SENDER)).toThrow(SenderBindingError);
    expect(() => verifySenderBinding(DELEGATE, SENDER)).toThrow(
      "Wallet signer identity does not match the envelope sender.",
    );
  });

  describe("with delegation", () => {
    it("should pass when signer is the authorized delegate and sender matches", () => {
      expect(() =>
        verifySenderBinding(DELEGATE, SENDER, {
          delegate: DELEGATE,
          sender: SENDER,
        }),
      ).not.toThrow();
    });

    it("should throw when signer matches delegate but sender does not match authorization sender", () => {
      expect(() =>
        verifySenderBinding(DELEGATE, "GOTHER...", {
          delegate: DELEGATE,
          sender: SENDER,
        }),
      ).toThrow(SenderBindingError);
    });

    it("should throw when sender matches but signer is not the authorized delegate", () => {
      expect(() =>
        verifySenderBinding("GUNAUTHORIZED...", SENDER, {
          delegate: DELEGATE,
          sender: SENDER,
        }),
      ).toThrow(SenderBindingError);
    });

    it("should pass with normalized casing and whitespace in delegation", () => {
      expect(() =>
        verifySenderBinding(` ${DELEGATE.toLowerCase()} `, ` ${SENDER} `, {
          delegate: DELEGATE.toUpperCase(),
          sender: SENDER.toLowerCase(),
        }),
      ).not.toThrow();
    });
  });
});
