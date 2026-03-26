export type BotEventMap = Record<
  string,
  (...args: never[]) => void | Promise<void>
>;

export type HandlerSets<TEvents extends BotEventMap> = {
  [K in keyof TEvents]: Set<TEvents[K]>;
};

export function addHandler<
  TEvents extends BotEventMap,
  K extends keyof TEvents,
>(handlers: HandlerSets<TEvents>, event: K, handler: TEvents[K]): void {
  handlers[event].add(handler);
}

export function removeHandler<
  TEvents extends BotEventMap,
  K extends keyof TEvents,
>(handlers: HandlerSets<TEvents>, event: K, handler: TEvents[K]): void {
  handlers[event].delete(handler);
}

export function emitHandlers<
  TEvents extends BotEventMap,
  K extends keyof TEvents,
>(
  handlers: HandlerSets<TEvents>,
  event: K,
  emitError: (error: Error) => void,
  toError: (error: unknown) => Error,
  ...args: Parameters<TEvents[K]>
): void {
  for (const handler of handlers[event]) {
    try {
      const result = (
        handler as (
          ...handlerArgs: Parameters<TEvents[K]>
        ) => void | Promise<void>
      )(...args);
      if (result && typeof (result as Promise<void>).then === "function") {
        void (result as Promise<void>).catch((error: unknown) => {
          if (event !== "error") {
            emitError(toError(error));
          }
        });
      }
    } catch (error) {
      if (event !== "error") {
        emitError(toError(error));
      }
    }
  }
}
