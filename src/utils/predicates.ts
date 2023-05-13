export function isTruthy<T>(x: T | undefined | null | "" | 0 | false): x is T {
  return !!x;
}
