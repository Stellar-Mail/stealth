const fs = require("fs");
const path = require("path");

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(file));
    } else {
      results.push(file);
    }
  });
  return results;
}

const files = walkDir(path.join(process.cwd(), "tools"));
let count = 0;
for (const file of files) {
  if (file.endsWith(".tsx") || file.endsWith(".ts")) {
    const content = fs.readFileSync(file, "utf8");
    if (content.includes("../../../src/components/ui/")) {
      const newContent = content.replace(
        /\.\.\/\.\.\/\.\.\/src\/components\/ui\//g,
        "@/components/ui/",
      );
      fs.writeFileSync(file, newContent);
      count++;
    }
  }
}
console.log(`Replaced in ${count} files.`);
