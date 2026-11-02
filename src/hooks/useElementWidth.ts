import { useEffect, useRef, type RefObject } from 'react';

/**
 * 요소의 너비가 바뀔 때마다 onWidth를 부른다(ResizeObserver).
 * step 단위로 반올림해 아주 작은 변화로 다시 그리는 것을 막는다.
 */
export function useElementWidth<T extends HTMLElement>(
  onWidth: (width: number) => void,
  step = 20,
): RefObject<T> {
  const ref = useRef<T>(null);
  const callback = useRef(onWidth);
  useEffect(() => {
    callback.current = onWidth;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last = -1;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round((entry?.contentRect.width ?? 0) / step) * step;
      if (w > 0 && w !== last) {
        last = w;
        callback.current(w);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [step]);

  return ref;
}
