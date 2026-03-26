import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const packagesRoot = path.join(process.cwd(), "packages");
const npmCacheDir = path.join(tmpdir(), "weixin-clawbot-npm-cache");
const jsonMode = process.argv.includes("--json");

mkdirSync(npmCacheDir, { recursive: true });

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function formatBytes(value) {
  if (value < 1024) {
    return `${value} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function listPublicPackages() {
  if (!existsSync(packagesRoot)) {
    return [];
  }

  return readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const packageDir = path.join(packagesRoot, entry.name);
      const packageJsonPath = path.join(packageDir, "package.json");

      if (!existsSync(packageJsonPath)) {
        return [];
      }

      const packageJson = readJson(packageJsonPath);
      return packageJson.private === true
        ? []
        : [{ dir: packageDir, packageJson }];
    });
}

function runNpm(args, cwd) {
  return spawnSync("npm", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
  });
}

function detectRegistryStatus(packageName, version, cwd) {
  const result = runNpm(
    ["view", `${packageName}@${version}`, "version", "--json"],
    cwd,
  );
  const output = `${result.stdout}\n${result.stderr}`;

  if (result.status === 0) {
    return { status: "published" };
  }

  if (
    output.includes("E404") ||
    output.includes("No match found for version")
  ) {
    return { status: "unpublished" };
  }

  return {
    status: "unknown",
    detail: output.trim() || `npm view exited with code ${result.status ?? 1}`,
  };
}

function parsePackJson(stdout) {
  const normalized = stdout.trim();
  const match = normalized.match(/(\[\s*\{[\s\S]*\}\s*\])\s*$/);

  if (!match) {
    throw new Error("Unable to parse npm pack --dry-run output.");
  }

  const packResult = JSON.parse(match[1]);

  if (!Array.isArray(packResult) || packResult.length === 0) {
    throw new Error("npm pack --dry-run did not return any package metadata.");
  }

  return packResult[0];
}

function dryRunPack(packageDir) {
  const result = runNpm(
    ["pack", "--dry-run", "--json", "--silent"],
    packageDir,
  );

  if (result.status !== 0) {
    const detail = `${result.stdout}\n${result.stderr}`.trim();
    throw new Error(
      detail || `npm pack exited with code ${result.status ?? 1}`,
    );
  }

  // npm pack prints prepack logs before the final JSON payload.
  return parsePackJson(result.stdout);
}

const packages = listPublicPackages();

if (packages.length === 0) {
  console.log("No public packages were found under packages/.");
  process.exit(0);
}

const summary = packages.map(({ dir, packageJson }) => {
  const registry = detectRegistryStatus(
    packageJson.name,
    packageJson.version,
    dir,
  );
  const pack = dryRunPack(dir);

  return {
    name: packageJson.name,
    version: packageJson.version,
    directory: path.relative(process.cwd(), dir),
    registry,
    pack: {
      filename: pack.filename,
      entryCount: pack.entryCount,
      size: pack.size,
      unpackedSize: pack.unpackedSize,
      files: pack.files.map((file) => file.path),
    },
  };
});

if (jsonMode) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

console.log("Release dry-run summary");

for (const item of summary) {
  console.log("");
  console.log(`${item.name}@${item.version}`);
  console.log(`  directory: ${item.directory}`);

  if (item.registry.status === "published") {
    console.log("  registry: already published");
  } else if (item.registry.status === "unpublished") {
    console.log("  registry: not published yet");
  } else {
    console.log("  registry: unknown");
    console.log(`  registry detail: ${item.registry.detail}`);
  }

  console.log(`  tarball: ${item.pack.filename}`);
  console.log(`  files: ${item.pack.entryCount}`);
  console.log(
    `  size: ${formatBytes(item.pack.size)} packed / ${formatBytes(item.pack.unpackedSize)} unpacked`,
  );
  console.log("  sample files:");

  for (const filePath of item.pack.files.slice(0, 8)) {
    console.log(`    - ${filePath}`);
  }

  if (item.pack.files.length > 8) {
    console.log(`    - ... (${item.pack.files.length - 8} more)`);
  }
}
