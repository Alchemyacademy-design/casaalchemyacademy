import { useCallback, useMemo, useState } from "react";

export function useSelection<T extends string | number>(all: T[] = []) {
  const [ids, setIds] = useState<Set<T>>(new Set());

  const toggle = useCallback((id: T) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setIds(new Set()), []);

  const selectAll = useCallback(() => setIds(new Set(all)), [all]);

  const isSelected = useCallback((id: T) => ids.has(id), [ids]);

  const allSelected = useMemo(
    () => all.length > 0 && all.every((id) => ids.has(id)),
    [all, ids],
  );

  return {
    ids: Array.from(ids),
    count: ids.size,
    toggle,
    clear,
    selectAll,
    isSelected,
    allSelected,
    setIds: (next: T[]) => setIds(new Set(next)),
  };
}