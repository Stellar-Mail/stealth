import { describe, expect, it } from "vitest";
import {
  getTagToken,
  getAudienceToken,
  CAMPAIGN_STATUS_TOKENS,
  TAG_COLOR_TOKENS,
  AUDIENCE_BADGE_TOKENS,
} from "../constants/displayTokens";

describe("Campaign Display Tokens Utilities", () => {
  describe("getTagToken", () => {
    it("should retrieve token styling for known tags (case-insensitive)", () => {
      const onboardingToken = getTagToken("onboarding");
      expect(onboardingToken.bg).toBe(TAG_COLOR_TOKENS.onboarding.bg);
      expect(onboardingToken.text).toBe(TAG_COLOR_TOKENS.onboarding.text);
      expect(onboardingToken.border).toBe(TAG_COLOR_TOKENS.onboarding.border);

      const upperWelcomeToken = getTagToken("WELCOME");
      expect(upperWelcomeToken.bg).toBe(TAG_COLOR_TOKENS.welcome.bg);
      expect(upperWelcomeToken.text).toBe(TAG_COLOR_TOKENS.welcome.text);
    });

    it("should return fallback token with original label for unknown tags", () => {
      const customTag = "my-custom-arbitrary-tag";
      const token = getTagToken(customTag);
      expect(token.bg).toBe(TAG_COLOR_TOKENS.default.bg);
      expect(token.text).toBe(TAG_COLOR_TOKENS.default.text);
      expect(token.border).toBe(TAG_COLOR_TOKENS.default.border);
      expect(token.label).toBe(customTag);
    });
  });

  describe("getAudienceToken", () => {
    it("should retrieve token styling for known audiences", () => {
      const audience = "New Signups";
      const token = getAudienceToken(audience);
      expect(token.bg).toBe(AUDIENCE_BADGE_TOKENS["New Signups"].bg);
      expect(token.text).toBe(AUDIENCE_BADGE_TOKENS["New Signups"].text);
      expect(token.border).toBe(AUDIENCE_BADGE_TOKENS["New Signups"].border);
    });

    it("should return fallback token with original label for unknown audiences", () => {
      const customAudience = "Vip Users Section";
      const token = getAudienceToken(customAudience);
      expect(token.bg).toBe(AUDIENCE_BADGE_TOKENS.default.bg);
      expect(token.text).toBe(AUDIENCE_BADGE_TOKENS.default.text);
      expect(token.border).toBe(AUDIENCE_BADGE_TOKENS.default.border);
      expect(token.label).toBe(customAudience);
    });
  });

  describe("CAMPAIGN_STATUS_TOKENS", () => {
    it("should define tokens for all six campaign statuses", () => {
      const expected = ["draft", "ready", "active", "paused", "archived", "failed"];
      for (const s of expected) {
        expect(CAMPAIGN_STATUS_TOKENS[s as keyof typeof CAMPAIGN_STATUS_TOKENS]).toBeDefined();
      }
    });
  });
});
