function hasCause(cause: unknown): cause is Error {
  return cause !== undefined;
}

export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

export function describeError(error: unknown): string {
  return toError(error).message;
}

export function createError(message: string, cause?: unknown): Error {
  if (!hasCause(cause)) {
    return new Error(message);
  }

  return new Error(message, {
    cause: toError(cause),
  });
}

export function createScopedError(
  scope: string,
  message: string,
  cause?: unknown,
): Error {
  return createError(`${scope} failed: ${message}`, cause);
}

export function createAbortError(
  message = "The operation was aborted",
  cause?: unknown,
): Error {
  const error = createError(message, cause);
  error.name = "AbortError";
  return error;
}

export function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === "AbortError";
}

export function createTimeoutError(
  scope: string,
  timeoutMs: number,
  cause?: unknown,
): Error {
  const error = createError(`${scope} timed out after ${timeoutMs}ms`, cause);
  error.name = "TimeoutError";
  return error;
}

export function isTimeoutError(error: unknown): error is Error {
  return error instanceof Error && error.name === "TimeoutError";
}

export function wrapError(prefix: string, error: unknown): Error {
  return createError(`${prefix}: ${describeError(error)}`, error);
}
