import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as icons from "@/features/design-system/components/mail-icons";

describe("custom postal icons", () => {
  it("keeps every icon crisp, theme-inheriting and decorative by default", () => {
    for (const Icon of Object.values(icons)) {
      const svg = renderToStaticMarkup(<Icon size={18} />);
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('stroke="currentColor"');
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain('width="18"');
      expect(svg).toContain("data-mail-icon=");
      expect(svg).not.toContain("<image");
    }
  });

  it("supports caller sizing, accessible labels and stroke scaling", () => {
    const svg = renderToStaticMarkup(
      <icons.ComposeIcon
        size={12}
        strokeWidth={2}
        absoluteStrokeWidth
        aria-hidden={false}
        aria-label="Compose"
      />,
    );
    expect(svg).toContain('stroke-width="4"');
    expect(svg).toContain('aria-label="Compose"');
    expect(svg).toContain('aria-hidden="false"');
  });
});
