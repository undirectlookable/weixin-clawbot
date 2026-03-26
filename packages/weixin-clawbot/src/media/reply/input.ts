import { MessageKind, type ReplyInput } from "../../public-types.js";

export type NormalizedReplyInput = Exclude<ReplyInput, string>;

export function normalizeReplyInput(input: ReplyInput): NormalizedReplyInput {
  if (typeof input === "string") {
    return {
      kind: MessageKind.TEXT,
      text: input,
    };
  }

  return input;
}

export function describeReplyInput(
  input: NormalizedReplyInput,
): Record<string, unknown> {
  switch (input.kind) {
    case MessageKind.TEXT:
      return {
        kind: input.kind,
        text: input.text,
      };
    case MessageKind.IMAGE:
    case MessageKind.VOICE:
    case MessageKind.FILE:
    case MessageKind.VIDEO:
      return {
        kind: input.kind,
        filePath: input.filePath,
        text: input.text,
        fileName: "fileName" in input ? input.fileName : undefined,
        thumbnailPath:
          "thumbnailPath" in input ? input.thumbnailPath : undefined,
      };
    default:
      return assertUnreachable(input);
  }
}

export function assertUnreachable(value: never): never {
  throw new Error(`Unsupported reply input: ${JSON.stringify(value)}`);
}
