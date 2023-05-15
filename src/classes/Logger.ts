import type * as vscode from "vscode";

/* eslint-disable no-console */
export const EXTENSION_KEY = "[co-locate]";

/**
 * Recursively normalise an object to a plain object so this can be logged in any console
 */
function normaliseRecursively(obj: unknown): unknown {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (obj instanceof Error) {
    return {
      message: obj.message,
      stack: obj.stack,
    };
  }

  if (obj instanceof Map) {
    const normalisedMap: Record<string, unknown> = {};
    for (const [key, value] of obj.entries()) {
      normalisedMap[key] = normaliseRecursively(value);
    }
    return normalisedMap;
  }

  if (obj instanceof Set) {
    return Array.from(obj).map(normaliseRecursively);
  }

  if (Array.isArray(obj)) {
    return obj.map(normaliseRecursively);
  }

  const normalisedObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    normalisedObj[key] = normaliseRecursively(value);
  }
  return normalisedObj;
}

function stringify(value: unknown): string {
  // todo use locally scoped replacer
  return JSON.stringify(value, null, 2);
}

let outputChannel: vscode.LogOutputChannel | undefined;

const Logger = {
  setOutputChannel: (channel: vscode.LogOutputChannel) => {
    outputChannel = channel;
  },
  log: (...messages: unknown[]) => {
    messages = messages.map(normaliseRecursively).map(stringify);
    console.log(EXTENSION_KEY, ...messages);
    outputChannel?.info(EXTENSION_KEY, ...messages, "\n");
  },
  warn: (...messages: unknown[]) => {
    messages = messages.map(normaliseRecursively).map(stringify);
    console.warn(EXTENSION_KEY, ...messages);
    outputChannel?.warn(EXTENSION_KEY, ...messages, "\n");
  },
  error: (...messages: unknown[]) => {
    messages = messages.map(normaliseRecursively).map(stringify);
    console.error(EXTENSION_KEY, ...messages);
    outputChannel?.error(EXTENSION_KEY, "❌", ...messages, "\n");
  },
  startTimer: (key: string) => {
    const startTimeMs = Date.now();
    return () => {
      Logger.log(`⏱️ ${key} took ${Date.now() - startTimeMs}ms`);
    };
  },
};

export default Logger;
