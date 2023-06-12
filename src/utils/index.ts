import type { NormalisedPath } from "../types";

const MAX_PATH_LENGTH = 80;

export function shortenPath(path: string): string {
  if (path.length <= MAX_PATH_LENGTH) {
    return path;
  }

  const parts = path.split("/");
  const firstPart = parts.shift();
  const PATH_START = `${firstPart}/.../`;
  const REMAINING_PATH_ALLOWANCE = MAX_PATH_LENGTH - PATH_START.length;
  let shortenedSuffixPath = parts.join("/");
  while (shortenedSuffixPath.length > REMAINING_PATH_ALLOWANCE) {
    parts.shift();
    shortenedSuffixPath = parts.join("/");
  }

  return `${PATH_START}${shortenedSuffixPath}`;
}

export function normalisePath(path: string): NormalisedPath {
  return path.toLowerCase() as NormalisedPath;
}
