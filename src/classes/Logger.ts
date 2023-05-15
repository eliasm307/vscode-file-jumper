/* eslint-disable no-console */
export const EXTENSION_KEY = "[co-locate]";

const activeTimerKeys = new Set<string>();

function getUniqueTimerKey(key: string) {
  let i = 0;
  let uniqueKey = `${EXTENSION_KEY} ${key}`;
  while (activeTimerKeys.has(uniqueKey)) {
    uniqueKey = `${EXTENSION_KEY} ${key} (${++i})`;
  }
  return uniqueKey;
}

const Logger = {
  log: (...messages: unknown[]) => {
    console.log(EXTENSION_KEY, ...messages);
  },
  warn: (...messages: unknown[]) => {
    console.warn(EXTENSION_KEY, ...messages);
  },
  error: (...messages: unknown[]) => {
    console.error(EXTENSION_KEY, ...messages);
  },
  startTimer: (key: string) => {
    const uniqueKey = getUniqueTimerKey(key);
    console.time(uniqueKey);
    activeTimerKeys.add(uniqueKey);

    return () => {
      console.timeEnd(uniqueKey);
      activeTimerKeys.delete(uniqueKey);
    };
  },
};

export default Logger;
