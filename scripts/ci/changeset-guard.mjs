import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const compareRef = process.argv[2] ?? "origin/main";
const packagesRoot = path.join(process.cwd(), "packages");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function listPublicPackageDirs() {
  if (!existsSync(packagesRoot)) {
    return [];
  }

  return readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const packageJsonPath = path.join(
        packagesRoot,
        entry.name,
        "package.json",
      );

      if (!existsSync(packageJsonPath)) {
        return [];
      }

      const packageJson = readJson(packageJsonPath);
      return packageJson.private === true
        ? []
        : [path.posix.join("packages", entry.name)];
    });
}

function listChangedFiles() {
  const diffOutput = execFileSync(
    "git",
    ["diff", "--name-only", `${compareRef}...HEAD`],
    {
      encoding: "utf8",
    },
  ).trim();

  return diffOutput === "" ? [] : diffOutput.split("\n").filter(Boolean);
}

function writeOutputs(outputs) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }

  for (const [key, value] of Object.entries(outputs)) {
    appendFileSync(outputPath, `${key}=${value}\n`);
  }
}

const publicPackageDirs = listPublicPackageDirs();
const changedFiles = listChangedFiles();
const changedPublicPackageDirs = publicPackageDirs.filter((packageDir) =>
  changedFiles.some(
    (filePath) =>
      filePath === packageDir || filePath.startsWith(`${packageDir}/`),
  ),
);
const hasChangesetFile = changedFiles.some((filePath) => {
  if (!filePath.startsWith(".changeset/") || !filePath.endsWith(".md")) {
    return false;
  }

  return path.posix.basename(filePath) !== "README.md";
});

writeOutputs({
  public_package_changed: String(changedPublicPackageDirs.length > 0),
  changed_public_packages: changedPublicPackageDirs
    .map((packageDir) => path.posix.basename(packageDir))
    .join(","),
  has_changeset_file: String(hasChangesetFile),
});

console.log(`compare_ref=${compareRef}`);
console.log(`changed_files=${changedFiles.length}`);
console.log(`public_package_changed=${changedPublicPackageDirs.length > 0}`);
console.log(
  `changed_public_packages=${changedPublicPackageDirs.join(",") || "(none)"}`,
);
console.log(`has_changeset_file=${hasChangesetFile}`);
