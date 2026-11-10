/** Compare small presentation snapshots while retaining unchanged collection references. */
export function shallowEqual<T extends object>(previous: T, next: T): boolean {
  const keys = Object.keys(previous) as (keyof T)[];
  return (
    keys.length === Object.keys(next).length &&
    keys.every((key) => Object.is(previous[key], next[key]))
  );
}
