import type { BotContext, ReplyInput, TextBotMessage } from "weixin-clawbot";
import { MessageKind } from "weixin-clawbot";

import type { ExampleConfig } from "./config.js";
import type { ExampleDebugFields, ExampleDebugLogger } from "./debug.js";

type TextCommandContext = {
  input: string;
  config: ExampleConfig;
};

type TextCommand = {
  name: string;
  help: string;
  matches: (input: string) => boolean;
  describeMatch?: (
    params: Pick<TextCommandContext, "config" | "input">,
  ) => ExampleDebugFields | undefined;
  buildReply: (params: TextCommandContext) => ReplyInput;
};

const ECHO_PREFIX = "/echo ";

// Keep the command table flat so the example behavior is easy to scan.
const TEXT_COMMANDS: readonly TextCommand[] = [
  {
    name: "/help",
    help: "/help",
    matches: (input) => !input || input === "/help",
    buildReply: () => createHelpReply(),
  },
  {
    name: "/ping",
    help: "/ping",
    matches: (input) => input === "/ping",
    buildReply: () => "pong",
  },
  {
    name: "/echo",
    help: "/echo <text>",
    matches: (input) => input.startsWith(ECHO_PREFIX),
    describeMatch: ({ input }) => ({
      echoed: input.slice(ECHO_PREFIX.length).trim(),
    }),
    buildReply: ({ input }) =>
      input.slice(ECHO_PREFIX.length).trim() || "Nothing to echo.",
  },
  {
    name: "/file",
    help: "/file",
    matches: (input) => input === "/file",
    describeMatch: ({ config }) => ({
      filePath: config.assets.file.path,
    }),
    buildReply: ({ config }) => ({
      kind: MessageKind.FILE,
      filePath: config.assets.file.path,
      fileName: config.assets.file.fileName,
      text: "Sending the bundled example file.",
    }),
  },
  {
    name: "/image",
    help: "/image",
    matches: (input) => input === "/image",
    describeMatch: ({ config }) => ({
      filePath: config.assets.image.path,
    }),
    buildReply: ({ config }) => ({
      kind: MessageKind.IMAGE,
      filePath: config.assets.image.path,
      text: "Sending the bundled example image.",
    }),
  },
  {
    name: "/video",
    help: "/video",
    matches: (input) => input === "/video",
    describeMatch: ({ config }) => ({
      filePath: config.assets.video.path,
    }),
    buildReply: ({ config }) => ({
      kind: MessageKind.VIDEO,
      filePath: config.assets.video.path,
      text: "Sending the bundled example video.",
    }),
  },
];

function createHelpReply(): string {
  return [
    "Available commands:",
    ...TEXT_COMMANDS.map((command) => `- ${command.help}`),
  ].join("\n");
}

function createUnknownCommandReply(input: string): string {
  return [`I received: ${input}`, "", createHelpReply()].join("\n");
}

export async function handleTextMessage(
  ctx: BotContext,
  message: TextBotMessage,
  config: ExampleConfig,
  debug?: ExampleDebugLogger,
): Promise<void> {
  const input = message.text.trim();
  const commandDebug = debug?.child("commands");

  commandDebug?.log("received", {
    input,
    messageId: message.id,
    fromUserId: message.fromUserId,
  });

  const matchedCommand = TEXT_COMMANDS.find((command) =>
    command.matches(input),
  );
  if (matchedCommand) {
    commandDebug?.log("matched", {
      command: matchedCommand.name,
      ...(matchedCommand.describeMatch?.({ config, input }) ?? {}),
    });
    await ctx.reply(matchedCommand.buildReply({ input, config }));
    return;
  }

  commandDebug?.log("matched", { command: "unknown" });
  await ctx.reply(createUnknownCommandReply(input));
}
