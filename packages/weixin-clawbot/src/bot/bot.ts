import { createDebugLogger, type DebugLogger } from "../core/debug.js";
import {
  downloadFileToWithRuntime,
  downloadFileWithRuntime,
  uploadFileWithRuntime,
} from "../media/file-transfer.js";
import type { WeixinMessage } from "../protocol/message.js";
import type {
  DownloadFileOptions,
  DownloadFileToOptions,
  UploadedFileHandle,
  UploadFileOptions,
} from "../public-types.js";
import { createMessageContext } from "./dispatcher.js";
import {
  addHandler,
  emitHandlers,
  type HandlerSets,
  removeHandler,
} from "./event-emitter.js";
import { type BotOptions, resolveBotOptions } from "./options.js";
import { BotPoller } from "./poller.js";
import { toError } from "./sleep.js";
import { BotStateStore } from "./state-store.js";

export type { BotOptions } from "./options.js";

export type BotEvents = {
  message: (ctx: ReturnType<typeof createMessageContext>) => void;
  error: (error: Error) => void;
  start: () => void;
  end: () => void;
};

export class Bot {
  private readonly token: string | undefined;
  private readonly userId: string | undefined;
  private readonly baseUrl: string;
  private readonly stateRoot: string;
  private readonly accountId: string;
  private readonly cdnBaseUrl: string | undefined;
  private readonly stateStore: BotStateStore;
  private readonly debug: DebugLogger;
  private readonly poller: BotPoller;

  private handlers: HandlerSets<BotEvents> = {
    message: new Set(),
    error: new Set(),
    start: new Set(),
    end: new Set(),
  };

  constructor(options: BotOptions = {}) {
    const resolvedOptions = resolveBotOptions(options);

    this.token = resolvedOptions.token;
    this.userId = resolvedOptions.userId;
    this.baseUrl = resolvedOptions.baseUrl;
    this.stateRoot = resolvedOptions.stateRoot;
    this.accountId = resolvedOptions.accountId;
    this.cdnBaseUrl = resolvedOptions.cdnBaseUrl;
    this.stateStore = new BotStateStore(this.accountId, this.stateRoot);
    this.debug = createDebugLogger({
      enabled: resolvedOptions.debugEnabled,
    }).child("bot");
    this.poller = new BotPoller({
      accountId: this.accountId,
      baseUrl: this.baseUrl,
      token: this.token,
      autoRetry: resolvedOptions.autoRetry,
      stateStore: this.stateStore,
      debug: this.debug,
      initialLongPollTimeoutMs: resolvedOptions.longPollTimeoutMs,
    });

    this.debug.log("constructed", {
      accountId: this.accountId,
      baseUrl: this.baseUrl,
      autoRetry: resolvedOptions.autoRetry,
      longPollTimeoutMs: resolvedOptions.longPollTimeoutMs,
      hasToken: Boolean(this.token),
      hasUserId: Boolean(this.userId),
      stateRoot: this.stateRoot,
      hasCdnBaseUrl: Boolean(this.cdnBaseUrl),
    });
  }

  on<K extends keyof BotEvents>(event: K, handler: BotEvents[K]): this {
    addHandler(this.handlers, event, handler);
    if (event === "message") {
      this.poller.syncHandlerState(
        "message_handler_added",
        this.createPollerCallbacks(),
      );
    }
    return this;
  }

  off<K extends keyof BotEvents>(event: K, handler: BotEvents[K]): this {
    removeHandler(this.handlers, event, handler);
    if (event === "message") {
      this.poller.syncHandlerState(
        "message_handler_removed",
        this.createPollerCallbacks(),
      );
    }
    return this;
  }

  isRunning(): boolean {
    return this.poller.isRunning();
  }

  start(): void {
    const started = this.poller.startSession(this.handlers.message.size);
    if (!started) {
      return;
    }
    this.emit("start");
    this.poller.syncHandlerState("start", this.createPollerCallbacks());
  }

  end(): void {
    this.poller.endSession(this.createPollerCallbacks());
  }

  async uploadFile(options: UploadFileOptions): Promise<UploadedFileHandle> {
    return uploadFileWithRuntime(this.createFileTransferRuntime(), options);
  }

  async downloadFile(options: DownloadFileOptions): Promise<Buffer> {
    return downloadFileWithRuntime(this.createFileTransferRuntime(), options);
  }

  async downloadFileTo(options: DownloadFileToOptions): Promise<void> {
    await downloadFileToWithRuntime(this.createFileTransferRuntime(), options);
  }

  private emit<K extends keyof BotEvents>(
    event: K,
    ...args: Parameters<BotEvents[K]>
  ): void {
    emitHandlers(
      this.handlers,
      event,
      (error) => this.emitError(error),
      toError,
      ...args,
    );
  }

  private emitError(error: Error): void {
    this.debug.log("error", { error });
    this.emit("error", error);
  }

  private createPollerCallbacks() {
    return {
      getMessageHandlerCount: () => this.handlers.message.size,
      onMessage: (message: WeixinMessage) => this.dispatchMessage(message),
      onError: (error: Error) => this.emitError(error),
      onEnd: () => this.emit("end"),
    };
  }

  private createFileTransferRuntime() {
    return {
      token: this.token,
      baseUrl: this.baseUrl,
      cdnBaseUrl: this.cdnBaseUrl,
      debug: this.debug.child("file_transfer"),
    };
  }

  private dispatchMessage(message: WeixinMessage): void {
    this.debug.log("message.received", {
      messageId: message.message_id,
      fromUserId: message.from_user_id,
      toUserId: message.to_user_id,
      itemTypes: (message.item_list ?? []).map((item) => item.type),
      contextTokenPresent: Boolean(message.context_token),
    });

    const ctx = createMessageContext({
      accountId: this.accountId,
      token: this.token,
      userId: this.userId,
      baseUrl: this.baseUrl,
      message,
      cdnBaseUrl: this.cdnBaseUrl,
      stateStore: this.stateStore,
      debug: this.debug.child("context"),
    });
    this.emit("message", ctx);
  }
}
