import { useCallback, useSyncExternalStore } from "react";

/**
 * Tracks whether the viewport is at or below `breakpoint` (px).
 *
 * Uses `useSyncExternalStore` rather than `useState` + `useEffect` so there is
 * no synchronous setState-in-effect, no hydration flash, and a stable
 * server snapshot (always `false` on the server).
 */
export function useIsMobile(breakpoint = 640): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [breakpoint]
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(`(max-width: ${breakpoint}px)`).matches,
    [breakpoint]
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
