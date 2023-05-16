const MAX_PATH_LENGTH = 70;

export function shortenPath(path: string): string {
  if (path.length <= MAX_PATH_LENGTH) {
    return path;
  }

  const parts = path.split("/");
  const firstPart = parts.shift();
  if (!firstPart) {
    return path;
  }

  const PATH_START = `${firstPart}/.../`;
  const REMAINING_PATH_ALLOWANCE = MAX_PATH_LENGTH - PATH_START.length;

  while (parts.join("/").length > REMAINING_PATH_ALLOWANCE) {
    parts.shift();
  }

  return `${PATH_START}${parts.join("/")}`;
}
