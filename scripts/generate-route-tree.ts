import { configSchema, Generator } from "@tanstack/router-generator";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const config = configSchema.parse({
  target: "react",
  routesDirectory: path.join(root, "src", "routes"),
  generatedRouteTree: path.join(root, "src", "routeTree.gen.ts"),
  tmpDir: path.join(root, ".tanstack", "tmp"),
});

const generator = new Generator({ config, root });

await generator.run();

// The @tanstack/react-start plugin appends a typed router registration so the
// `server` handler option is accepted by createFileRoute. The standalone
// generator does not emit it, so re-append it to match a plugin build.
const routeTreePath = path.join(root, "src", "routeTree.gen.ts");
const content = readFileSync(routeTreePath, "utf8");
const marker = "\nimport type { getRouter } from './router.tsx'";
if (!content.trimEnd().endsWith("_addFileTypes<FileRouteTypes>()")) {
  console.error("Unexpected routeTree.gen.ts tail; skipping react-start registration.");
  process.exit(1);
}
const appended =
  content.trimEnd() +
  "\n\n" +
  "import type { getRouter } from './router.tsx'\n" +
  "import type { createStart } from '@tanstack/react-start'\n" +
  "declare module '@tanstack/react-start' {\n" +
  "  interface Register {\n" +
  "    ssr: true\n" +
  "    router: Awaited<ReturnType<typeof getRouter>>\n" +
  "  }\n" +
  "}\n";
writeFileSync(routeTreePath, appended);
console.log("routeTree.gen.ts regenerated");
