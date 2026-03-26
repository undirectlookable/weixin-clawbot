export type DebugFields = Record<string, unknown>;

export type DebugLogger = {
  readonly enabled: boolean;
  child(scope: string): DebugLogger;
  log(event: string, fields?: DebugFields): void;
};

type DebugLoggerOptions = {
  enabled?: boolean | undefined;
  namespace?: string | undefined;
  sink?: ((line: string) => void) | undefined;
};

const SENSITIVE_KEY_PATTERN =
  /token|authorization|secret|password|aes|param|cursor|ticket|filekey/i;
const DEFAULT_NAMESPACE = "weixin-clawbot";
const MAX_DEPTH = 4;
const MAX_STRING_LENGTH = 240;
const MAX_ARRAY_ITEMS = 10;

class ConsoleDebugLogger implements DebugLogger {
  readonly enabled: boolean;

  constructor(
    enabled: boolean,
    private readonly namespace: string,
    private readonly sink: (line: string) => void,
  ) {
    this.enabled = enabled;
  }

  child(scope: string): DebugLogger {
    return new ConsoleDebugLogger(
      this.enabled,
      `${this.namespace}:${scope}`,
      this.sink,
    );
  }

  log(event: string, fields?: DebugFields): void {
    if (!this.enabled) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.namespace}] ${event}`;
    if (!fields || Object.keys(fields).length === 0) {
      this.sink(prefix);
      return;
    }

    this.sink(`${prefix} ${JSON.stringify(sanitizeValue(fields))}`);
  }
}

export function createDebugLogger(
  options: DebugLoggerOptions = {},
): DebugLogger {
  return new ConsoleDebugLogger(
    options.enabled ?? false,
    options.namespace ?? DEFAULT_NAMESPACE,
    options.sink ?? ((line) => console.error(line)),
  );
}

function sanitizeValue(value: unknown, key?: string, depth = 0): unknown {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return redactValue(value);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (depth >= MAX_DEPTH) {
    return "<max-depth>";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, undefined, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeValue(entryValue, entryKey, depth + 1),
      ]),
    );
  }

  return String(value);
}

function redactValue(value: unknown): string {
  if (typeof value === "string") {
    return `<redacted:${value.length}>`;
  }

  if (Array.isArray(value)) {
    return `<redacted:${value.length}>`;
  }

  if (value && typeof value === "object") {
    return "<redacted>";
  }

  return "<redacted>";
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}...<trimmed:${value.length}>`;
}
