import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Bookmark-friendly URL-backed filter state.
 * Values are strings; use "" to clear a key.
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => {
    const out = { ...defaults };
    (Object.keys(defaults) as Array<keyof T>).forEach((k) => {
      const v = params.get(k as string);
      if (v !== null) (out as Record<string, string>)[k as string] = v;
    });
    return out;
  }, [params, defaults]);

  const set = useCallback(
    (patch: Partial<T>) => {
      const next = new URLSearchParams(params);
      Object.entries(patch).forEach(([k, v]) => {
        if (!v || v === defaults[k as keyof T]) next.delete(k);
        else next.set(k, String(v));
      });
      setParams(next, { replace: true });
    },
    [params, setParams, defaults],
  );

  const reset = useCallback(() => {
    const next = new URLSearchParams(params);
    Object.keys(defaults).forEach((k) => next.delete(k));
    setParams(next, { replace: true });
  }, [params, setParams, defaults]);

  return { values, set, reset };
}