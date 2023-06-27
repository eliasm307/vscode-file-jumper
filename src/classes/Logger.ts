import type * as vscode from "vscode";

/* eslint-disable no-console */
export const EXTENSION_KEY = "[file-jumper]";

function normaliseReplacer(inputKey: string, inputValue: unknown): unknown {
  if (inputValue === undefined) {
    return "undefined";
  }

  if (inputValue instanceof Error) {
    return `Error("${inputValue.message}")`;
  }

  if (typeof inputValue === "function") {
    return "[Function]";
  }

  if (typeof inputValue === "symbol") {
    return `Symbol("${inputValue.description}")`;
  }

  if (inputValue instanceof Promise) {
    return "[Promise]";
  }

  if (inputValue instanceof Map) {
    const normalisedMap: Record<string, unknown> = {};
    for (const [key, value] of inputValue.entries()) {
      normalisedMap[key] = value;
    }
    return normalisedMap;
  }

  if (inputValue instanceof RegExp) {
    return inputValue.toString();
  }

  if (inputValue instanceof Set) {
    return Array.from<unknown>(inputValue);
  }

  return inputValue;
}

function stringify(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, normaliseReplacer, 2);
}

function getSortedMapEntries(map: Map<string, unknown>) {
  return Object.fromEntries(
    Array.from(map.entries()).sort(([aKey], [bKey]) => aKey.localeCompare(bKey)),
  );
}

export type LogOutputChannel = Pick<vscode.LogOutputChannel, "info" | "warn" | "error">;

let outputChannel: LogOutputChannel | undefined;

let enabled = false;

const Logger = {
  reset: () => {
    enabled = false;
    outputChannel = undefined;
  },
  setEnabled: (value: boolean) => (enabled = value),
  isEnabled: () => enabled,
  hasOutputChannel: () => !!outputChannel,
  setOutputChannel: (channel: LogOutputChannel) => (outputChannel = channel),
  info: (...messages: unknown[]) => output({ level: "info", messages }),
  warn: (...messages: unknown[]) => output({ level: "warn", messages }),
  error: (...messages: unknown[]) => output({ level: "error", messages }),
  count,
  startTimer,
};

const topicTimers = new Map<string, number>();

const logTopicTimersDebounced = debounce(() => {
  output({ level: "info", messages: ["TIMERS (MS):", getSortedMapEntries(topicTimers)] });
}, 2000);

function startTimer(
  topicKey: string,
  subKey?: string,
  options: { logIfTimeGreaterThanMs: number } = { logIfTimeGreaterThanMs: 2 },
): () => void {
  if (!Logger.isEnabled() || !topicKey) {
    return () => null;
  }
  const startTimeMs = Date.now();
  logTopicTimersDebounced();
  return () => {
    const durationMs = Date.now() - startTimeMs;
    if (durationMs > options.logIfTimeGreaterThanMs) {
      Logger.info(
        `⏱️ ${topicKey}${subKey ? `(${subKey})` : ""} took ${Date.now() - startTimeMs}ms`,
      );
    }

    const newTopicDurationMs = (topicTimers.get(topicKey) ?? 0) + durationMs;
    topicTimers.set(topicKey, newTopicDurationMs);
    logTopicTimersDebounced();
  };
}

function output({
  level,
  messages,
}: {
  messages: unknown[];
  level: "info" | "warn" | "error";
}): void {
  if (!Logger.isEnabled() || !messages.length) {
    return;
  }
  messages = messages.map(stringify);
  console[level](EXTENSION_KEY, ...messages);
  outputChannel?.[level](EXTENSION_KEY, ...messages, "\n");
}

function debounce<T extends (...args: unknown[]) => unknown>(func: T, waitMs: number): T {
  let timeout: NodeJS.Timeout;
  const debounced = (...args: unknown[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitMs);
  };
  return debounced as T;
}

const counters = new Map<string, number>();

const logCountersDebounced = debounce(() => {
  output({ level: "info", messages: ["COUNTS:", getSortedMapEntries(counters)] });
}, 2000);

function count(key: string): void {
  if (!Logger.isEnabled() || !key) {
    return;
  }
  const newCount = (counters.get(key) ?? 0) + 1;
  counters.set(key, newCount);
  logCountersDebounced();
}

export default Logger;
