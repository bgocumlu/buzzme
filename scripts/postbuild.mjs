import { readFileSync, writeFileSync } from "node:fs";

const filePath = "dist/index.js";
const shebang = "#!/usr/bin/env node\n";
const content = readFileSync(filePath, "utf-8");

if (!content.startsWith("#!")) {
  writeFileSync(filePath, shebang + content);
}
