import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseExampleDebugEnabled } from "./debug.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

export type ExampleAssets = {
  file: {
    path: string;
    fileName: string;
  };
  image: {
    path: string;
  };
  video: {
    path: string;
  };
};

export type ExampleConfig = {
  assets: ExampleAssets;
  debug: boolean;
};

function createExampleAssets(rootDir: string): ExampleAssets {
  return {
    file: {
      path: path.join(rootDir, "assets", "example-note.txt"),
      fileName: "example-note.txt",
    },
    image: {
      path: path.join(rootDir, "assets", "sample.png"),
    },
    video: {
      path: path.join(rootDir, "assets", "sample.mp4"),
    },
  };
}

export function loadExampleConfig(): ExampleConfig {
  return {
    assets: createExampleAssets(projectRoot),
    debug: parseExampleDebugEnabled(),
  };
}
