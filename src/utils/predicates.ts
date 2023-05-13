export function isTruthy<T>(x: T | undefined | null | "" | 0): x is T {
  return !!x;
}
