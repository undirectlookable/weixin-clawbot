import { BotStateStore } from "../bot/state-store.js";
import { createDebugLogger, type DebugLogger } from "../core/debug.js";
import {
  downloadMediaBuffer,
  downloadMediaToWriter,
} from "../media/download.js";
import type { WeixinMessage } from "../protocol/message.js";
import type {
  BotMessage,
  ReplyInput,
  ReplyResult,
  TypingStatusValue,
} from "../public-types.js";
import { sendContextReply, sendContextTyping } from "./actions.js";
import { toBotMessage } from "./message-view.js";

type BotContextOptions = {
  accountId: string;
  token?: string | undefined;
  userId?: string | undefined;
  baseUrl: string;
  message: WeixinMessage;
  defaultToUserId: string;
  cdnBaseUrl?: string | undefined;
  stateStore?: BotStateStore | undefined;
  debug?: DebugLogger | undefined;
};

export class BotContext {
  readonly accountId: string;
  readonly token: string | undefined;
  readonly userId: string | undefined;
  readonly baseUrl: string;
  readonly rawMessage: unknown;
  readonly message: BotMessage;
  readonly fromUserId: string;
  readonly contextToken: string | undefined;
  readonly messageKind: BotMessage["kind"];
  readonly cdnBaseUrl: string | undefined;

  private readonly rawWeixinMessage: WeixinMessage;
  private readonly stateStore: BotStateStore;
  private readonly debug: DebugLogger;

  constructor(options: BotContextOptions) {
    this.accountId = options.accountId;
    this.token = options.token;
    this.userId = options.userId;
    this.baseUrl = options.baseUrl;
    this.rawWeixinMessage = options.message;
    this.rawMessage = options.message;
    this.fromUserId = options.message.from_user_id ?? options.defaultToUserId;
    this.message = toBotMessage(options.message, this.fromUserId);
    this.contextToken = this.message.contextToken;
    this.messageKind = this.message.kind;
    this.cdnBaseUrl = options.cdnBaseUrl;
    this.stateStore =
      options.stateStore ?? new BotStateStore(options.accountId);
    this.debug = options.debug ?? createDebugLogger().child("context");

    if (this.contextToken && this.fromUserId) {
      this.stateStore.setContextToken(this.fromUserId, this.contextToken);
      this.debug.log("context_token.persisted", {
        fromUserId: this.fromUserId,
      });
    }

    this.debug.log("created", {
      accountId: this.accountId,
      messageKind: this.message.kind,
      messageId: this.message.id,
      fromUserId: this.fromUserId,
      contextTokenPresent: Boolean(this.contextToken),
    });
  }

  async reply(input: ReplyInput): Promise<ReplyResult> {
    return sendContextReply(
      {
        baseUrl: this.baseUrl,
        token: this.token,
        fromUserId: this.fromUserId,
        contextToken: this.resolveContextToken(),
        cdnBaseUrl: this.cdnBaseUrl,
        debug: this.debug,
      },
      input,
    );
  }

  async downloadMedia(): Promise<Buffer> {
    return downloadMediaBuffer({
      message: this.rawWeixinMessage,
      cdnBaseUrl: this.cdnBaseUrl,
      debug: this.debug.child("download"),
    });
  }

  async downloadMediaTo(writable: NodeJS.WritableStream): Promise<void> {
    await downloadMediaToWriter({
      message: this.rawWeixinMessage,
      writable,
      cdnBaseUrl: this.cdnBaseUrl,
      debug: this.debug.child("download"),
    });
  }

  async sendTyping(status?: TypingStatusValue): Promise<void> {
    await sendContextTyping(
      {
        baseUrl: this.baseUrl,
        token: this.token,
        fromUserId: this.fromUserId,
        contextToken: this.resolveContextToken(),
        debug: this.debug,
      },
      status,
    );
  }

  private resolveContextToken(): string | undefined {
    return (
      this.contextToken ?? this.stateStore.getContextToken(this.fromUserId)
    );
  }
}
