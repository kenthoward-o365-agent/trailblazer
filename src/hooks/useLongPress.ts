import { useCallback, useRef } from "react";

interface LongPressHandlers {
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onTouchMove: () => void;
}

export function useLongPress(
  callback: () => void,
  delay: number = 500
): LongPressHandlers {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      callback();
    }, delay);
  }, [callback, delay]);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchCancel: clear,
    onTouchMove: clear,
  };
}
