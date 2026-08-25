import { openApiDocument } from "../src/server/api/openapi.ts";
import { writeFileSync } from "node:fs";
import prettier from "prettier";

const raw = JSON.stringify(openApiDocument, null, 2) + "\n";
const config = await prettier.resolveConfig("openapi.json");
const formatted = await prettier.format(raw, { ...config, parser: "json" });
writeFileSync("openapi.json", formatted, "utf8");
console.log("openapi.json generated and formatted with Prettier.");
