import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const changesetCliPath = require.resolve("@changesets/cli/bin.js");
const candidateRefs = [
  process.env.CHANGESET_BASE_REF,
  "origin/main",
  "main",
].filter(Boolean);

function hasGitRef(ref) {
  try {
    execFileSync("git", ["rev-parse", "--verify", ref], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (!hasGitRef("HEAD")) {
  console.log(
    "Skipping changeset status because this repository does not have any commits yet.",
  );
  process.exit(0);
}

const baseRef = candidateRefs.find((ref) => hasGitRef(ref));

if (!baseRef) {
  console.error(
    "Unable to find a base ref for changeset status. Set CHANGESET_BASE_REF or fetch main first.",
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [changesetCliPath, "status", "--since", baseRef],
  {
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
