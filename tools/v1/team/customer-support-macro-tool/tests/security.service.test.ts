import { describe, expect, it } from "vitest";

import {
  limitMacrosForSearch,
  sanitizeMacroText,
  validateMacroSafety,
} from "../services/security.service";

describe("customer support macro safety guards", () => {
  it("escapes html-sensitive characters and strips invisible control characters", () => {
    const hostile = '<img src=x onerror="alert(1)"> Refund approved\u202E';

    const safe = sanitizeMacroText(hostile);

    expect(safe).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; Refund approved");
    expect(safe).not.toContain("<");
    expect(safe).not.toContain("\u202E");
  });

  it("reports unsafe macro tag input before it reaches rendering or search", () => {
    const errors = validateMacroSafety({
      title: " Refund follow-up ",
      body: "Thanks for your patience.",
      tags: Array.from({ length: 13 }, (_, index) =>
        index === 12 ? "x".repeat(41) : `tag-${index}`,
      ),
    });

    expect(errors).toEqual([
      { field: "tags", message: "Use 12 tags or fewer." },
      { field: "tags", message: "Tags must be 40 characters or fewer." },
    ]);
  });

  it("caps large macro lists before expensive search or rendering work", () => {
    const macros = Array.from({ length: 305 }, (_, index) => ({ id: `macro-${index}` }));

    const result = limitMacrosForSearch(macros, 250);

    expect(result.truncated).toBe(true);
    expect(result.items).toHaveLength(250);
    expect(result.items[0]).toEqual({ id: "macro-0" });
    expect(macros).toHaveLength(305);
  });
});
