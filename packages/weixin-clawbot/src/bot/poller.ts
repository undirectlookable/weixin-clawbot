import type { DebugLogger } from "../core/debug.js";
import type { WeixinMessage } from "../protocol/message.js";
import { runPollingLoop } from "./polling-loop.js";
import { toError } from "./sleep.js";
import type { BotStateStore } from "./state-store.js";

type BotPollerCallbacks = {
  getMessageHandlerCount: () => number;
  onMessage: (message: WeixinMessage) => void;
  onError: (error: Error) => void;
  onEnd: (details: { aborted: boolean; idle?: boolean | undefined }) => void;
};

type BotPollerOptions = {
  accountId: string;
  baseUrl: string;
  token?: string | undefined;
  autoRetry: boolean;
  stateStore: BotStateStore;
  debug: DebugLogger;
  initialLongPollTimeoutMs: number;
};

export class BotPoller {
  private running = false;
  private abortController: AbortController | undefined;
  private longPollTimeoutMs: number;
  private syncCursor = "";
  private sessionPausedUntil = 0;

  constructor(private readonly options: BotPollerOptions) {
    this.longPollTimeoutMs = options.initialLongPollTimeoutMs;
  }

  isRunning(): boolean {
    return this.running;
  }

  startSession(messageHandlerCount: number): boolean {
    if (this.running) {
      this.options.debug.log("start.skipped", { reason: "already-running" });
      return false;
    }

    this.options.stateStore.ensureReady();
    this.options.stateStore.restoreContextTokens();
    this.syncCursor = this.options.stateStore.loadSyncCursor() ?? "";

    this.options.debug.log("start", {
      accountId: this.options.accountId,
      syncCursorPresent: Boolean(this.syncCursor),
      longPollTimeoutMs: this.longPollTimeoutMs,
      autoRetry: this.options.autoRetry,
      messageHandlerCount,
    });

    this.running = true;
    return true;
  }

  endSession(callbacks: BotPollerCallbacks): boolean {
    if (!this.running) {
      this.options.debug.log("end.skipped", { reason: "not-running" });
      return false;
    }

    this.options.debug.log("end.requested");
    this.running = false;
    if (this.abortController) {
      this.abortController.abort();
      return true;
    }

    this.options.debug.log("stop", { aborted: false, idle: true });
    callbacks.onEnd({ aborted: false, idle: true });
    return true;
  }

  syncHandlerState(reason: string, callbacks: BotPollerCallbacks): void {
    if (!this.running) {
      return;
    }

    if (this.hasMessageHandlers(callbacks)) {
      this.startPolling(reason, callbacks);
      return;
    }

    if (!this.abortController) {
      this.options.debug.log("polling.idle", {
        reason,
        messageHandlerCount: callbacks.getMessageHandlerCount(),
      });
      return;
    }

    this.options.debug.log("polling.pause_requested", {
      reason,
      messageHandlerCount: callbacks.getMessageHandlerCount(),
    });
    this.abortController.abort();
  }

  private hasMessageHandlers(callbacks: BotPollerCallbacks): boolean {
    return callbacks.getMessageHandlerCount() > 0;
  }

  private startPolling(reason: string, callbacks: BotPollerCallbacks): void {
    if (
      !this.running ||
      this.abortController ||
      !this.hasMessageHandlers(callbacks)
    ) {
      return;
    }

    this.abortController = new AbortController();
    this.options.debug.log("polling.start", {
      reason,
      messageHandlerCount: callbacks.getMessageHandlerCount(),
      syncCursorPresent: Boolean(this.syncCursor),
      longPollTimeoutMs: this.longPollTimeoutMs,
    });
    void this.pollLoop(this.abortController.signal, callbacks);
  }

  private async pollLoop(
    signal: AbortSignal,
    callbacks: BotPollerCallbacks,
  ): Promise<void> {
    try {
      await runPollingLoop({
        signal,
        baseUrl: this.options.baseUrl,
        token: this.options.token,
        autoRetry: this.options.autoRetry,
        syncCursor: this.syncCursor,
        longPollTimeoutMs: this.longPollTimeoutMs,
        sessionPausedUntil: this.sessionPausedUntil,
        debug: this.options.debug.child("polling"),
        isRunning: () => this.running,
        persistSyncCursor: (cursor) =>
          this.options.stateStore.saveSyncCursor(cursor),
        onError: (error) => callbacks.onError(error),
        onMessage: (message) => callbacks.onMessage(message),
        onStateChange: (state) => {
          if (state.syncCursor !== undefined) {
            this.syncCursor = state.syncCursor;
          }
          if (state.longPollTimeoutMs !== undefined) {
            this.longPollTimeoutMs = state.longPollTimeoutMs;
          }
          if (state.sessionPausedUntil !== undefined) {
            this.sessionPausedUntil = state.sessionPausedUntil;
          }
        },
      });
    } catch (error) {
      if (this.running) {
        const resolvedError = toError(error);
        this.options.debug.log("poll_loop.failed", { error: resolvedError });
        callbacks.onError(resolvedError);
      }
    } finally {
      if (this.abortController?.signal === signal) {
        this.abortController = undefined;
      }

      if (!this.running) {
        this.options.debug.log("stop", { aborted: signal.aborted });
        callbacks.onEnd({ aborted: signal.aborted });
      } else if (signal.aborted) {
        this.options.debug.log("polling.stopped", {
          reason: this.hasMessageHandlers(callbacks)
            ? "polling_reconfigured"
            : "no_message_handlers",
        });
        this.syncHandlerState("poll_loop_aborted", callbacks);
      } else {
        this.running = false;
        this.options.debug.log("stop", { aborted: false });
        callbacks.onEnd({ aborted: false });
      }
    }
  }
}
