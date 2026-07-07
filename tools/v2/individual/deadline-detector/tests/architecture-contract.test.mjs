import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const toolRoot = fileURLToPath(new URL("..", import.meta.url));
const toolPath = "tools/v2/individual/deadline-detector/";

const requiredDocs = [
  "README.md",
  "specs.md",
  "docs/ARCHITECTURE.md",
  "docs/DATA_OWNERSHIP.md",
  "docs/TEST_PLAN.md",
  "docs/ACCESSIBILITY.md",
  "docs/VISUAL_STYLE.md",
];

const markdownFiles = listFiles(toolRoot).filter((file) => extname(file) === ".md");
const codeFiles = listFiles(toolRoot).filter((file) =>
  [".js", ".mjs", ".ts", ".tsx"].includes(extname(file)),
);

describe("Deadline Detector - architecture contract", () => {
  it("keeps required architecture documents folder-local", () => {
    for (const doc of requiredDocs) {
      const absolute = resolve(toolRoot, doc);
      assert.ok(existsSync(absolute), `${doc} must exist`);
      assert.ok(isPathInside(toolRoot, absolute), `${doc} must stay inside ${toolPath}`);
    }
  });

  it("documents module boundaries, data ownership, and integration constraints", () => {
    assertDocIncludes("docs/ARCHITECTURE.md", [
      toolPath,
      "Module Boundaries",
      "Dependency Rules",
      "Future Contributor Contract",
      "No network calls",
      "No persistence writes",
      "reminder",
      "calendar",
    ]);

    assertDocIncludes("docs/DATA_OWNERSHIP.md", [
      "DeadlineMessage",
      "DetectedDeadline",
      "DeadlineDetectionSummary",
      "Fixture Rules",
      "Future Integration Adapter Boundary",
      "No step writes to disk",
    ]);

    assertDocIncludes("specs.md", [
      "Module Boundaries",
      "Future contributors may change",
      "Future contributors may not change",
      "Files outside",
      toolPath,
    ]);
  });

  it("removes broken generation/template leftovers from markdown docs", () => {
    const forbidden = ["$(", "$dir", "Set-Content", "System.Collections.Hashtable", "@ |"];

    for (const file of markdownFiles) {
      const text = readFileSync(file, "utf8");
      for (const token of forbidden) {
        assert.ok(!text.includes(token), `${relative(toolRoot, file)} still contains ${token}`);
      }
    }
  });

  it("keeps relative imports inside the tool folder", () => {
    for (const file of codeFiles) {
      const imports = extractImportSpecifiers(readFileSync(file, "utf8"));

      for (const specifier of imports) {
        if (!specifier.startsWith(".")) continue;
        const resolved = resolve(dirname(file), specifier);
        assert.ok(
          isPathInside(toolRoot, resolved),
          `${relative(toolRoot, file)} imports outside the tool folder: ${specifier}`,
        );
      }
    }
  });

  it("does not import forbidden main app or provider modules", () => {
    const forbiddenImportFragments = [
      "@/",
      "src/",
      "routes/",
      "router",
      "inbox",
      "mailbox",
      "calendar",
      "reminder",
      "notification",
      "wallet",
      "stellar",
      "database",
      "components/ui",
      "design-system",
    ];

    for (const file of codeFiles) {
      const imports = extractImportSpecifiers(readFileSync(file, "utf8"));
      for (const specifier of imports) {
        for (const fragment of forbiddenImportFragments) {
          assert.ok(
            !specifier.toLowerCase().includes(fragment),
            `${relative(toolRoot, file)} imports forbidden module fragment ${fragment}`,
          );
        }
      }
    }
  });
});

function assertDocIncludes(relativePath, expectedPhrases) {
  const text = readFileSync(resolve(toolRoot, relativePath), "utf8");
  for (const phrase of expectedPhrases) {
    assert.ok(text.includes(phrase), `${relativePath} must mention "${phrase}"`);
  }
}

function extractImportSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
}

function listFiles(root) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const fullPath = resolve(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function isPathInside(root, target) {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
