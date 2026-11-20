import { useCallback, useEffect, useState } from 'react';

interface AsyncState<T> {
  data?: T;
  error?: unknown;
  loading: boolean;
}

/** Charge des données asynchrones ; `reload` relance la requête. */
export function useAsync<T>(load: () => Promise<T>, deps: ReadonlyArray<unknown>) {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, loading: true }));
    load()
      .then((data) => alive && setState({ data, loading: false }))
      .catch((error: unknown) => alive && setState({ error, loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
