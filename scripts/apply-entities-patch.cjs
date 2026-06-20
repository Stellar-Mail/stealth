const fs = require("fs");
const path = require("path");
const pkgPath = path.resolve(__dirname, "..", "node_modules", "entities", "package.json");
try {
  if (!fs.existsSync(pkgPath)) {
    console.log("entities package not installed; skipping patch");
    process.exit(0);
  }
  const raw = fs.readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(raw);
  pkg.exports = pkg.exports || {};
  if (!pkg.exports["./decode"]) {
    pkg.exports["./decode"] = { require: "./lib/decode.js", import: "./lib/esm/decode.js" };
    console.log("Added ./decode export");
  }
  if (!pkg.exports["./escape"]) {
    pkg.exports["./escape"] = { require: "./lib/escape.js", import: "./lib/esm/escape.js" };
    console.log("Added ./escape export");
  }
  pkg.exports["./lib/decode.js"] = pkg.exports["./lib/decode.js"] || {
    require: "./lib/decode.js",
    import: "./lib/esm/decode.js",
  };
  pkg.exports["./lib/escape.js"] = pkg.exports["./lib/escape.js"] || {
    require: "./lib/escape.js",
    import: "./lib/esm/escape.js",
  };
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + "\n");
  console.log("entities package.json patched");
} catch (err) {
  console.error("Failed to patch entities package.json:", err);
  process.exit(1);
}
