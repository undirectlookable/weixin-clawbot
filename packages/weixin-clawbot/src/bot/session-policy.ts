import {
  BACKOFF_DELAY_MS,
  MAX_CONSECUTIVE_FAILURES,
  RETRY_DELAY_MS,
  SESSION_EXPIRED_ERRCODE,
  SESSION_PAUSE_DURATION_MS,
} from "../core/constants.js";

export function isSessionExpired(params: {
  errcode?: number | undefined;
  ret?: number | undefined;
}): boolean {
  return (
    params.errcode === SESSION_EXPIRED_ERRCODE ||
    params.ret === SESSION_EXPIRED_ERRCODE
  );
}

export function createSessionExpiredError(): Error {
  return new Error(
    `session expired (errcode ${SESSION_EXPIRED_ERRCODE}), paused for ${Math.ceil(SESSION_PAUSE_DURATION_MS / 60_000)} min`,
  );
}

export function getSessionPausedUntil(): number {
  return Date.now() + SESSION_PAUSE_DURATION_MS;
}

export function getRetryDelay(consecutiveFailures: number): number {
  return consecutiveFailures >= MAX_CONSECUTIVE_FAILURES
    ? BACKOFF_DELAY_MS
    : RETRY_DELAY_MS;
}

export function shouldResetFailureCount(consecutiveFailures: number): boolean {
  return consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
}
