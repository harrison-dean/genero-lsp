// utils/arrayUtils.ts
export function flatMap<T, U>(
  array: T[],
  callback: (value: T, index: number, array: T[]) => U[]
): U[] {
  return array.reduce<U[]>((acc, val, idx, arr) => 
    acc.concat(callback(val, idx, arr)), 
    []
  );
}
