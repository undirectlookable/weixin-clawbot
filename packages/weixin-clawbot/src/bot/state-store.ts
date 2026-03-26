import fs from "node:fs";
import path from "node:path";

export const DEFAULT_STATE_ROOT = path.join(process.cwd(), ".weixin-clawbot");

const ACCOUNTS_DIRNAME = "accounts";

type AccountStatePaths = {
  accountsDir: string;
  syncFile: string;
  contextTokenFile: string;
};

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function resolveStateRoot(rootDir?: string): string {
  if (rootDir === undefined) {
    return DEFAULT_STATE_ROOT;
  }

  return rootDir.trim();
}

function createAccountStatePaths(
  rootDir: string,
  accountId: string,
): AccountStatePaths {
  const accountsDir = path.join(rootDir, ACCOUNTS_DIRNAME);
  return {
    accountsDir,
    syncFile: path.join(accountsDir, `${accountId}.sync.json`),
    contextTokenFile: path.join(
      accountsDir,
      `${accountId}.context-tokens.json`,
    ),
  };
}

function readJsonFile<T>(filePath: string): T | undefined {
  try {
    if (!fs.existsSync(filePath)) {
      return undefined;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return undefined;
  }
}

function writeJsonFile(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value), "utf-8");
}

export class BotStateStore {
  private readonly paths: AccountStatePaths | undefined;
  private readonly contextTokens = new Map<string, string>();
  private syncCursor: string | undefined;

  constructor(accountId: string, rootDir?: string) {
    const resolvedRoot = resolveStateRoot(rootDir);
    this.paths = resolvedRoot
      ? createAccountStatePaths(resolvedRoot, accountId)
      : undefined;
  }

  ensureReady(): void {
    if (!this.paths) {
      return;
    }

    ensureDir(this.paths.accountsDir);
  }

  loadSyncCursor(): string | undefined {
    if (!this.paths) {
      return this.syncCursor;
    }

    const data = readJsonFile<{ get_updates_buf?: unknown }>(
      this.paths.syncFile,
    );
    return typeof data?.get_updates_buf === "string"
      ? data.get_updates_buf
      : undefined;
  }

  saveSyncCursor(cursor: string): void {
    this.syncCursor = cursor;

    if (!this.paths) {
      return;
    }

    writeJsonFile(this.paths.syncFile, { get_updates_buf: cursor });
  }

  restoreContextTokens(): void {
    if (!this.paths) {
      return;
    }

    this.contextTokens.clear();

    const persistedTokens = readJsonFile<Record<string, unknown>>(
      this.paths.contextTokenFile,
    );
    if (!persistedTokens) {
      return;
    }

    for (const [userId, token] of Object.entries(persistedTokens)) {
      if (typeof token === "string" && token) {
        this.contextTokens.set(userId, token);
      }
    }
  }

  getContextToken(userId: string): string | undefined {
    return this.contextTokens.get(userId);
  }

  setContextToken(userId: string, token: string): void {
    this.contextTokens.set(userId, token);
    if (this.paths) {
      this.persistContextTokens();
    }
  }

  private persistContextTokens(): void {
    if (!this.paths) {
      return;
    }

    writeJsonFile(
      this.paths.contextTokenFile,
      Object.fromEntries(this.contextTokens.entries()),
    );
  }
}
