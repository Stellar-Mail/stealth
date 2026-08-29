import { Generator, getConfig } from "@tanstack/router-generator";

const config = getConfig({
  routesDirectory: "src/routes",
  generatedRouteTree: "src/routeTree.gen.ts",
  quoteStyle: "single",
  semicolons: false,
});

const generator = new Generator({ config, root: process.cwd() });
await generator.run();
console.log("Route tree regenerated");
