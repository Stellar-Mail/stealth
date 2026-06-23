import { describe, expect, it } from "vitest";
import { extractPlaceholder } from "./extractor";

describe("extractor", () => {
  it("returns placeholder", () => {
    expect(extractPlaceholder()).toBe("placeholder");
  });
});
