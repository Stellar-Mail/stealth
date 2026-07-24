import { openApiDocument } from "../src/server/api/openapi.ts";
import * as fs from "fs";

fs.writeFileSync("openapi.json", JSON.stringify(openApiDocument, null, 2));
console.log("openapi.json generated successfully.");
