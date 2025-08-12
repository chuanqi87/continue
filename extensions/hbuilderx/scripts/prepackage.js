const { execSync } = require("child_process");

// Thin forwarder to the single-source implementation
try {
  const args = process.argv.slice(2).join(" ");
  execSync(`node scripts/prepackage-cross-platform.js ${args}`, {
    stdio: "inherit",
  });
  process.exit(0);
} catch (e) {
  process.exit(1);
}
