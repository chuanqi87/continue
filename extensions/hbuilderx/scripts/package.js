const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const version = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), {
    encoding: "utf-8",
  }),
).version;

const args = process.argv.slice(2);
let target;
if (args[0] === "--target") {
  target = args[1];
}

const buildDir = path.join(__dirname, "..", "build");
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir);
}

const archiveName = `continue-hbuilderx-${version}${target ? `-${target}` : ""}.zip`;
const archivePath = path.join(buildDir, archiveName);

// Assemble include list
const cwd = path.join(__dirname, "..");
const includes = [
  "out",
  "bin",
  "gui",
  "media",
  "models",
  "textmate-syntaxes",
  "config_schema.json",
  "package.json",
  "README.md",
];

// Ensure out/extension.js exists; if not, run esbuild
try {
  const outJs = path.join(cwd, "out", "extension.js");
  if (!fs.existsSync(outJs)) {
    console.log("[hbuilderx] extension.js not found; building with esbuild...");
    execSync("node scripts/esbuild.js --sourcemap", { cwd, stdio: "inherit" });
  }
} catch (e) {
  console.error("[hbuilderx] esbuild failed:", e.message || e);
  process.exit(1);
}

// Validate required paths
const required = ["out/extension.js", "package.json"];
for (const rel of required) {
  const p = path.join(cwd, rel);
  if (!fs.existsSync(p)) {
    console.error(`[hbuilderx] Missing required file before packaging: ${rel}`);
    process.exit(1);
  }
}

console.log(`[hbuilderx] Creating archive: ${archivePath}`);

// Build the zip command, excluding large dev node_modules at root
const hasZip = (() => {
  try {
    execSync("zip -v | head -n1", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

try {
  if (hasZip) {
    // zip -r build/file.zip <includes...>
    const includeArgs = includes.filter((name) =>
      fs.existsSync(path.join(cwd, name)),
    );
    if (includeArgs.length === 0) {
      console.error("[hbuilderx] Nothing to include for packaging");
      process.exit(1);
    }
    const cmd = `cd ${cwd} && zip -r -q ${archivePath} ${includeArgs
      .map((s) => `'${s}'`)
      .join(" ")} -x 'node_modules/*'`;
    execSync(cmd, { stdio: "inherit" });
  } else {
    // Fallback to tar.gz if zip is unavailable
    const tarName = archiveName.replace(/\.zip$/, ".tar.gz");
    const tarPath = path.join(buildDir, tarName);
    const includeArgs = includes.filter((name) =>
      fs.existsSync(path.join(cwd, name)),
    );
    const cmd = `cd ${cwd} && tar -czf ${tarPath} ${includeArgs
      .map((s) => `'${s}'`)
      .join(" ")} --exclude='node_modules'`;
    execSync(cmd, { stdio: "inherit" });
    console.log(`[hbuilderx] Created archive: ${tarPath}`);
    process.exit(0);
  }

  console.log(`[hbuilderx] Package created at ${archivePath}`);
} catch (error) {
  console.error("[hbuilderx] Packaging failed:", error.message || error);
  process.exit(1);
}
