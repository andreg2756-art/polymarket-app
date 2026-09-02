import { useCallback, useEffect, useState } from "react";

// Fetches `url` on mount (and whenever it changes), tracking loading and error
// so client pages get a consistent skeleton → error-with-retry → data flow
// without hand-rolling a try/catch in every component. `reload` re-runs the
// request — pass it to a retry button. A non-2xx response counts as an error,
// not as data.
export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
