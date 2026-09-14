const { spawnSync } = require("node:child_process");

const checks = [
  ["node", ["--check", "public/app.js"]],
  ["node", ["--check", "public/school-dialog.js"]],
  ["node", ["--check", "public/material-upload.js"]],
  ["pnpm", ["lint"]],
];

for (const [command, args] of checks) {
  const result = process.platform === "win32" && command === "pnpm"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", ["pnpm", ...args].join(" ")], { stdio: "inherit" })
    : spawnSync(command, args, { stdio: "inherit" });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("BrightEd CI regression checks passed.");
