import type * as vscode from "vscode";

/* eslint-disable no-console */
export const EXTENSION_KEY = "[co-locate]";

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
  // todo use locally scoped replacer
  return JSON.stringify(value, normaliseReplacer, 2);
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
  startTimer: (key: string): (() => void) => {
    if (!Logger.isEnabled()) {
      return () => null;
    }
    const startTimeMs = Date.now();
    return () => Logger.info(`⏱️ ${key} took ${Date.now() - startTimeMs}ms`);
  },
};

function output({ level, messages }: { messages: unknown[]; level: "info" | "warn" | "error" }): void {
  if (!Logger.isEnabled() || !messages.length) {
    return;
  }
  messages = messages.map(stringify);
  console[level](EXTENSION_KEY, ...messages);
  outputChannel?.[level](EXTENSION_KEY, ...messages, "\n");
}

export default Logger;
