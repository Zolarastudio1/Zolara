import { useEffect, useState } from "react";

/**
 * Small useDebounce hook — returns the debounced value after delay ms.
 */
export default function useDebounce<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
