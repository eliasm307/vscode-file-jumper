/* eslint-disable no-console */
const EXTENSION_KEY = "[co-locate]";

const Logger = {
  log: (...messages: unknown[]) => {
    // eslint-disable-next-line no-console
    console.log(EXTENSION_KEY, ...messages);
  },
  warn: (...messages: unknown[]) => {
    console.warn(EXTENSION_KEY, ...messages);
  },
  error: (...messages: unknown[]) => {
    console.error(EXTENSION_KEY, ...messages);
  },
  startTimer: (key: string) => {
    key = `${EXTENSION_KEY} ${key}`;
    console.time(key);

    return () => console.timeEnd(key);
  },
};

export default Logger;
