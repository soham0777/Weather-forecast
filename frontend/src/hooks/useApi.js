import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../services/api';

/**
 * Loads data with loading / error state. A request runs whenever `deps` change or `reload()`
 * is called; responses from outdated requests are ignored. Previous data stays visible while
 * the next page/filter loads.
 */
export function useApi(fetcher, deps = []) {
  const [version, setVersion] = useState(0);
  const key = JSON.stringify([...deps, version]);
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => fetcherRef.current())
      .then(
        (data) => { if (active) setResult({ key, data, error: null }); },
        (err) => { if (active) setResult((r) => ({ key, data: r.data, error: getErrorMessage(err) })); },
      );
    return () => { active = false; };
  }, [key]);

  const setData = useCallback((updater) => {
    setResult((r) => ({ ...r, data: typeof updater === 'function' ? updater(r.data) : updater }));
  }, []);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const loading = result.key !== key;
  return { data: result.data, setData, loading, error: loading ? null : result.error, reload };
}
