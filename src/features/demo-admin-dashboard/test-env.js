const fs = require('fs');
const path = require('path');
console.log("Current dir:", __dirname);
console.log("Workspace files:", fs.readdirSync(path.resolve(__dirname, '../../../')));
console.log("Parent folders:", fs.readdirSync(path.resolve(__dirname, '../../../../')));
try {
  console.log("vitest path:", require.resolve("vitest"));
} catch (e) {
  console.log("Failed to resolve vitest:", e.message);
}
