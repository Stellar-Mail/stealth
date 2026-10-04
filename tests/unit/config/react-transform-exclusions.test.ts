import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it } from "vitest";

it("retains dependency and router exclusions in the React transform config", () => {
  const source = ts.createSourceFile(
    "vite.config.ts",
    readFileSync("vite.config.ts", "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const exclusions: string[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "react"
    ) {
      const options = node.arguments[0];
      if (options && ts.isObjectLiteralExpression(options)) {
        for (const property of options.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            property.name.getText(source) === "exclude" &&
            ts.isArrayLiteralExpression(property.initializer)
          ) {
            exclusions.push(
              ...property.initializer.elements.map((element) =>
                ts.isStringLiteral(element) ? element.text : element.getText(source),
              ),
            );
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(exclusions).toContain("/node_modules/");
  expect(exclusions).toContain("src/router.tsx");
});
