import { useEffect, useState } from 'react';

/** value가 delay(ms) 동안 바뀌지 않으면 그 값을 돌려준다. */
export function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), Math.max(0, delay));
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
