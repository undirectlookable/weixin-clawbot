export type ExampleDebugFields = Record<string, unknown>;

export type ExampleDebugLogger = {
  readonly enabled: boolean;
  child(scope: string): ExampleDebugLogger;
  log(event: string, fields?: ExampleDebugFields): void;
};

type ExampleDebugLoggerOptions = {
  enabled?: boolean | undefined;
  namespace?: string | undefined;
  sink?: ((line: string) => void) | undefined;
};

const DEFAULT_NAMESPACE = "example";
const SENSITIVE_KEY_PATTERN =
  /token|authorization|secret|password|aes|param|cursor|ticket|filekey/i;

class ConsoleExampleDebugLogger implements ExampleDebugLogger {
  readonly enabled: boolean;

  constructor(
    enabled: boolean,
    private readonly namespace: string,
    private readonly sink: (line: string) => void,
  ) {
    this.enabled = enabled;
  }

  child(scope: string): ExampleDebugLogger {
    return new ConsoleExampleDebugLogger(
      this.enabled,
      `${this.namespace}:${scope}`,
      this.sink,
    );
  }

  log(event: string, fields?: ExampleDebugFields): void {
    if (!this.enabled) {
      return;
    }

    const prefix = `[${new Date().toISOString()}] [${this.namespace}] ${event}`;
    if (!fields || Object.keys(fields).length === 0) {
      this.sink(prefix);
      return;
    }

    this.sink(`${prefix} ${JSON.stringify(serialize(fields))}`);
  }
}

export function createExampleDebugLogger(
  options: ExampleDebugLoggerOptions = {},
): ExampleDebugLogger {
  return new ConsoleExampleDebugLogger(
    options.enabled ?? false,
    options.namespace ?? DEFAULT_NAMESPACE,
    options.sink ?? ((line) => console.error(line)),
  );
}

export function parseExampleDebugEnabled(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    argv.includes("--debug") ||
    parseBooleanEnv(env.EXAMPLE_DEBUG) ||
    parseBooleanEnv(env.WEIXIN_CLAWBOT_DEBUG)
  );
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on", "debug"].includes(
    value.trim().toLowerCase(),
  );
}

function serialize(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return "<redacted>";
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serialize(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        serialize(entryValue, entryKey),
      ]),
    );
  }

  return String(value);
}
