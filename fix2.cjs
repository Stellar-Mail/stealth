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
for (const file of files) {
  if (file.endsWith(".tsx") || file.endsWith(".ts")) {
    let content = fs.readFileSync(file, "utf8");
    let modified = false;
    if (content.includes("../../@/components/ui/")) {
      content = content.replace(/\.\.\/\.\.\/@\/components\/ui\//g, "@/components/ui/");
      modified = true;
    }
    if (modified) {
      fs.writeFileSync(file, content);
      console.log("Fixed:", file);
    }
  }
}
