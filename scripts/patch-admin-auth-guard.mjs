import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "app", "api", "admin");

const IMPORT =
  'import { guardAdminApi } from "lib/auth/admin-route";\n';
const GUARD = `  const denied = await guardAdminApi();\n  if (denied) return denied;\n`;

function patchFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  if (src.includes("guardAdminApi")) return false;

  if (!src.includes('from "lib/auth/admin-route"')) {
    const lines = src.split("\n");
    let insertAt = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) insertAt = i + 1;
      else if (insertAt > 0 && lines[i].trim() === "") break;
      else if (insertAt > 0 && !lines[i].startsWith("import ")) break;
    }
    lines.splice(insertAt, 0, IMPORT.trim());
    src = lines.join("\n");
  }

  src = src.replace(
    /export async function (GET|POST|PUT|PATCH|DELETE)\([^)]*\) \{\n/g,
    (match) => `${match}${GUARD}`
  );

  fs.writeFileSync(filePath, src);
  return true;
}

function walk(dir) {
  let count = 0;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) count += walk(full);
    else if (name === "route.ts") {
      if (patchFile(full)) count++;
    }
  }
  return count;
}

const patched = walk(root);
console.log(`Patched ${patched} admin route files.`);
