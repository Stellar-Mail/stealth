import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const file = resolve("src/features/design-system/styles/fonts.css");
const source = readFileSync(file, "utf8");
const faces: Map<string, string>[] = [];
postcss.parse(source).walkAtRules("font-face", (rule) => {
  const declarations = new Map<string, string>();
  rule.walkDecls((declaration) => {
    declarations.set(declaration.prop, declaration.value);
  });
  faces.push(declarations);
});

describe("same-origin mail typography", () => {
  it("ships every original family without external CSS or font requests", () => {
    expect(source).not.toMatch(/@import|https?:\/\//);
    expect(faces.map((face) => face.get("font-family"))).toEqual([
      '"Inter"',
      '"Space Grotesk"',
      '"Newsreader"',
    ]);
    for (const face of faces) {
      expect(face.get("font-weight")).toBe("400 700");
      expect(face.get("font-display")).toBe("swap");
      expect(face.get("unicode-range")).toContain("U+0000-00FF");
      const asset = face.get("src")!.match(/url\("([^"]+)"\)/)![1];
      expect(asset).toMatch(/^\.\.\/assets\/fonts\/[a-z-]+\.woff2$/);
      expect(
        readFileSync(resolve(dirname(file), asset))
          .subarray(0, 4)
          .toString(),
      ).toBe("wOF2");
      const license = asset.replace("-latin.woff2", "-OFL.txt");
      expect(readFileSync(resolve(dirname(file), license), "utf8")).toContain(
        "SIL OPEN FONT LICENSE",
      );
    }
  });

  it("preserves the preview family and existing sizes rather than restyling card geometry", () => {
    expect(source).toContain('--font-mail-preview: "Space Grotesk", var(--font-interface)');
    expect(source).toContain(".mail-preview-heading");
    expect(source).toContain(".mail-preview-subheading");
    expect(source).not.toMatch(/font-size:|line-height:|min-height:/);
  });
});
