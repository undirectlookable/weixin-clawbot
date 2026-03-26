import type { DebugLogger } from "../core/debug.js";
import type { GetUpdatesResp } from "../protocol/api.js";
import type { WeixinMessage } from "../protocol/message.js";
import { getUpdates } from "../transport/api/bot-api.js";
import {
  createSessionExpiredError,
  getRetryDelay,
  getSessionPausedUntil,
  isSessionExpired,
  shouldResetFailureCount,
} from "./session-policy.js";
import { sleep, toError } from "./sleep.js";

type PollLoopParams = {
  signal: AbortSignal;
  baseUrl: string;
  token?: string | undefined;
  autoRetry: boolean;
  syncCursor: string;
  longPollTimeoutMs: number;
  sessionPausedUntil: number;
  debug?: DebugLogger | undefined;
  isRunning: () => boolean;
  persistSyncCursor: (cursor: string) => void;
  onError: (error: Error) => void;
  onMessage: (message: WeixinMessage) => void;
  onStateChange: (state: {
    syncCursor?: string | undefined;
    longPollTimeoutMs?: number | undefined;
    sessionPausedUntil?: number | undefined;
  }) => void;
};

function hasApiError(resp: GetUpdatesResp): boolean {
  return (
    (resp.ret !== undefined && resp.ret !== 0) ||
    (resp.errcode !== undefined && resp.errcode !== 0)
  );
}

function createGetUpdatesError(resp: GetUpdatesResp): Error {
  return new Error(
    `getUpdates failed: ret=${resp.ret ?? ""} errcode=${resp.errcode ?? ""} errmsg=${resp.errmsg ?? ""}`,
  );
}

async function waitForRetry(params: {
  autoRetry: boolean;
  consecutiveFailures: number;
  signal: AbortSignal;
  debug?: DebugLogger | undefined;
}): Promise<number | undefined> {
  if (!params.autoRetry) {
    return undefined;
  }

  const delay = getRetryDelay(params.consecutiveFailures);
  const nextFailureCount = shouldResetFailureCount(params.consecutiveFailures)
    ? 0
    : params.consecutiveFailures;
  params.debug?.log("poll.retry_scheduled", {
    delayMs: delay,
    consecutiveFailures: nextFailureCount,
  });
  await sleep(delay, params.signal);
  return nextFailureCount;
}

export async function runPollingLoop(params: PollLoopParams): Promise<void> {
  let consecutiveFailures = 0;
  let syncCursor = params.syncCursor;
  let longPollTimeoutMs = params.longPollTimeoutMs;
  let sessionPausedUntil = params.sessionPausedUntil;
  const debug = params.debug;

  debug?.log("loop.start", {
    syncCursorPresent: Boolean(syncCursor),
    longPollTimeoutMs,
    autoRetry: params.autoRetry,
  });

  while (params.isRunning() && !params.signal.aborted) {
    if (sessionPausedUntil > Date.now()) {
      const remaining = sessionPausedUntil - Date.now();
      debug?.log("session.paused", { remainingMs: remaining });
      await sleep(remaining, params.signal);
      continue;
    }

    try {
      debug?.log("poll.request", {
        syncCursorPresent: Boolean(syncCursor),
        timeoutMs: longPollTimeoutMs,
      });

      const resp = await getUpdates({
        baseUrl: params.baseUrl,
        token: params.token,
        get_updates_buf: syncCursor,
        timeoutMs: longPollTimeoutMs,
        signal: params.signal,
        debug: debug?.child("api"),
      });

      if (resp.longpolling_timeout_ms && resp.longpolling_timeout_ms > 0) {
        longPollTimeoutMs = resp.longpolling_timeout_ms;
        params.onStateChange({ longPollTimeoutMs });
        debug?.log("poll.timeout_updated", { longPollTimeoutMs });
      }

      if (hasApiError(resp)) {
        if (isSessionExpired(resp)) {
          sessionPausedUntil = getSessionPausedUntil();
          params.onStateChange({ sessionPausedUntil });
          debug?.log("poll.session_expired", {
            ret: resp.ret,
            errcode: resp.errcode,
            errmsg: resp.errmsg,
            sessionPausedUntil,
          });
          params.onError(createSessionExpiredError());
          consecutiveFailures = 0;
          continue;
        }

        consecutiveFailures += 1;
        debug?.log("poll.api_error", {
          consecutiveFailures,
          ret: resp.ret,
          errcode: resp.errcode,
          errmsg: resp.errmsg,
        });
        params.onError(createGetUpdatesError(resp));

        const nextFailureCount = await waitForRetry({
          autoRetry: params.autoRetry,
          consecutiveFailures,
          signal: params.signal,
          debug,
        });
        if (nextFailureCount === undefined) {
          break;
        }
        consecutiveFailures = nextFailureCount;
        continue;
      }

      consecutiveFailures = 0;

      if (resp.get_updates_buf) {
        syncCursor = resp.get_updates_buf;
        params.persistSyncCursor(syncCursor);
        params.onStateChange({ syncCursor });
        debug?.log("poll.cursor_updated", {
          cursorLength: syncCursor.length,
        });
      }

      debug?.log("poll.response", {
        messageCount: resp.msgs?.length ?? 0,
      });

      for (const message of resp.msgs ?? []) {
        params.onMessage(message);
      }
    } catch (error) {
      if (params.signal.aborted || !params.isRunning()) {
        debug?.log("poll.aborted");
        break;
      }

      consecutiveFailures += 1;
      debug?.log("poll.exception", {
        consecutiveFailures,
        error: toError(error),
      });
      params.onError(toError(error));

      const nextFailureCount = await waitForRetry({
        autoRetry: params.autoRetry,
        consecutiveFailures,
        signal: params.signal,
        debug,
      });
      if (nextFailureCount === undefined) {
        break;
      }
      consecutiveFailures = nextFailureCount;
    }
  }

  debug?.log("loop.end", {
    aborted: params.signal.aborted,
    running: params.isRunning(),
  });
}
