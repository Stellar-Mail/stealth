import { readFileSync } from "node:fs";
import postcss from "postcss";
import { expect, it } from "vitest";

it("hides native and custom scrollbar indicators without disabling overflow", () => {
  const styles = postcss.parse(
    readFileSync("src/features/design-system/styles/interactions.css", "utf8"),
  );
  const rules = new Map<string, Map<string, string>>();
  let globalScrollbarLayer: string | undefined;
  styles.walkRules((rule) => {
    if (rule.selector === "*") globalScrollbarLayer = rule.parent?.type;
    const declarations = new Map<string, string>();
    rule.walkDecls((decl) => {
      declarations.set(decl.prop, decl.value);
    });
    rules.set(rule.selector, declarations);
  });
  expect(rules.get("*")?.get("scrollbar-width")).toBe("none");
  expect(globalScrollbarLayer).toBe("root");
  expect(rules.get(".scrollbar-thin")?.get("scrollbar-width")).toBe("none");
  expect(rules.get("*::-webkit-scrollbar")?.get("display")).toBe("none");
  expect(rules.get(".app-scrollbar")?.get("display")).toBe("none");
  for (const selector of ["*", ".scrollbar-thin"]) {
    expect(rules.get(selector)?.has("overflow")).toBe(false);
  }
});
