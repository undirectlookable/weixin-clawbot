type BotEnvConfig = {
  token?: string | undefined;
  userId?: string | undefined;
  baseUrl?: string | undefined;
  stateRoot?: string | undefined;
  debug: boolean;
};

export function loadBotEnvConfig(): BotEnvConfig {
  return {
    token: readTrimmedEnv("WEIXIN_CLAWBOT_TOKEN"),
    userId: readTrimmedEnv("WEIXIN_CLAWBOT_USER_ID"),
    baseUrl: readTrimmedEnv("WEIXIN_CLAWBOT_BASE_URL"),
    stateRoot: readOptionalTrimmedEnv("WEIXIN_CLAWBOT_STATE_ROOT"),
    debug: parseBooleanEnv(process.env.WEIXIN_CLAWBOT_DEBUG),
  };
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on", "debug"].includes(
    value.trim().toLowerCase(),
  );
}

function readTrimmedEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function readOptionalTrimmedEnv(key: string): string | undefined {
  const value = process.env[key];
  return value === undefined ? undefined : value.trim();
}
